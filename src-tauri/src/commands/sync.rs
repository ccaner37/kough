use rusqlite::params;
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::sync::SyncState;

const EPOCH: &str = "1970-01-01T00:00:00.000Z";

#[derive(serde::Serialize, Clone)]
pub struct SyncSettings {
    pub enabled: bool,
    pub server_url: String,
    pub sync_key: String,
    pub last_sync: String,
}

fn read_meta(conn: &rusqlite::Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM sync_meta WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
    .ok()
}

fn write_meta(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

fn read_pull_cursor(conn: &rusqlite::Connection) -> String {
    read_meta(conn, "pull_cursor")
        .or_else(|| read_meta(conn, "last_sync"))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| EPOCH.to_string())
}

fn read_push_cursor(conn: &rusqlite::Connection) -> String {
    read_meta(conn, "push_cursor")
        .or_else(|| read_meta(conn, "last_sync"))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| EPOCH.to_string())
}

fn now_millis_z() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

#[tauri::command]
pub fn get_sync_settings(db: State<'_, DbState>) -> Result<SyncSettings, AppError> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
    })?;
    Ok(SyncSettings {
        enabled: read_meta(&conn, "sync_enabled").unwrap_or_default() == "true",
        server_url: read_meta(&conn, "server_url").unwrap_or_default(),
        sync_key: read_meta(&conn, "sync_key").unwrap_or_default(),
        last_sync: read_meta(&conn, "last_sync")
            .or_else(|| read_meta(&conn, "pull_cursor"))
            .unwrap_or_default(),
    })
}

#[tauri::command]
pub fn save_sync_settings(
    db: State<'_, DbState>,
    enabled: bool,
    server_url: String,
    sync_key: String,
) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
    })?;
    write_meta(&conn, "sync_enabled", &enabled.to_string())?;
    write_meta(&conn, "server_url", &server_url)?;
    write_meta(&conn, "sync_key", &sync_key)?;
    if read_meta(&conn, "pull_cursor").is_none() && read_meta(&conn, "last_sync").is_none() {
        write_meta(&conn, "pull_cursor", EPOCH)?;
        write_meta(&conn, "push_cursor", EPOCH)?;
        write_meta(&conn, "last_sync", EPOCH)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn run_sync(
    db: State<'_, DbState>,
    mode: Option<String>,
) -> Result<serde_json::Value, AppError> {
    let mode = mode.unwrap_or_else(|| "push".to_string());
    let is_pull_only = mode == "pull";

    let (server_url, sync_key, pull_cursor, push_cursor) = {
        let conn = db.conn.lock().map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;
        let enabled = read_meta(&conn, "sync_enabled").unwrap_or_default() == "true";
        if !enabled {
            return Ok(serde_json::json!({ "status": "disabled" }));
        }
        let url = read_meta(&conn, "server_url").unwrap_or_default();
        let key = read_meta(&conn, "sync_key").unwrap_or_default();
        if url.is_empty() || key.is_empty() {
            return Ok(serde_json::json!({ "status": "not_configured" }));
        }
        (
            url,
            key,
            read_pull_cursor(&conn),
            read_push_cursor(&conn),
        )
    };

    let (local_changes, sync_started) = if is_pull_only {
        (std::collections::HashMap::new(), None)
    } else {
        let started = now_millis_z();
        let conn = db.conn.lock().map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;
        let changes = crate::sync::changes::collect_changes(&conn, &push_cursor)
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e)))?;
        (changes, Some(started))
    };

    let sync_state = SyncState::new(server_url, sync_key, pull_cursor.clone());
    let response = sync_state
        .push_and_pull(local_changes, &mode)
        .await
        .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e)))?;

    let result = {
        let mut conn = db.conn.lock().map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;
        let res = crate::sync::apply::apply_changes(&mut conn, &response.changes)
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e)))?;

        if res.failed.is_empty() {
            write_meta(&conn, "pull_cursor", &response.server_time)?;
            write_meta(&conn, "last_sync", &response.server_time)?;
            if let Some(started) = sync_started {
                write_meta(&conn, "push_cursor", &started)?;
            }
        }

        res
    };

    Ok(serde_json::json!({
        "status": "ok",
        "server_time": response.server_time,
        "applied": result.applied,
        "failed": result.failed,
        "mode": mode,
    }))
}

#[tauri::command]
pub fn force_resync(db: State<'_, DbState>) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
    })?;
    write_meta(&conn, "pull_cursor", EPOCH)?;
    write_meta(&conn, "push_cursor", EPOCH)?;
    write_meta(&conn, "last_sync", EPOCH)?;
    Ok(())
}
