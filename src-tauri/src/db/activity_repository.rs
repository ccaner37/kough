use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::activity::*;

pub fn start_session(
    conn: &Connection,
    app_name: &str,
    app_title: &str,
) -> Result<ActivitySession, AppError> {
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO activity_sessions (id, app_name, app_title, started_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, app_name, app_title, now],
    )?;
    Ok(ActivitySession {
        id,
        app_name: app_name.to_string(),
        app_title: app_title.to_string(),
        started_at: now,
        ended_at: None,
        duration_secs: None,
    })
}

pub fn end_session(conn: &Connection, session_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE activity_sessions SET ended_at = ?1, duration_secs = CAST((julianday(?1) - julianday(started_at)) * 86400 AS INTEGER) WHERE id = ?2",
        params![now, session_id],
    )?;
    Ok(())
}

pub fn end_active_session(conn: &Connection) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE activity_sessions SET ended_at = ?1, duration_secs = CAST((julianday(?1) - julianday(started_at)) * 86400 AS INTEGER) WHERE ended_at IS NULL",
        params![now],
    )?;
    Ok(())
}

pub fn get_active_session(conn: &Connection) -> Result<Option<ActivitySession>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, app_name, app_title, started_at, ended_at, duration_secs FROM activity_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
    )?;
    let result = stmt
        .query_map([], |row| {
            Ok(ActivitySession {
                id: row.get(0)?,
                app_name: row.get(1)?,
                app_title: row.get(2)?,
                started_at: row.get(3)?,
                ended_at: row.get(4)?,
                duration_secs: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(result.into_iter().next())
}

pub fn get_activity_summary(
    conn: &Connection,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<AppUsageSummary>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT app_name, SUM(duration_secs) as total_secs, COUNT(*) as session_count
         FROM activity_sessions
         WHERE started_at >= ?1 AND started_at < ?2 AND ended_at IS NOT NULL
         GROUP BY app_name
         ORDER BY total_secs DESC",
    )?;
    let summaries = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok(AppUsageSummary {
                app_name: row.get(0)?,
                total_secs: row.get(1)?,
                session_count: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(summaries)
}

pub fn get_activity_sessions(
    conn: &Connection,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<ActivitySession>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, app_name, app_title, started_at, ended_at, duration_secs
         FROM activity_sessions
         WHERE started_at >= ?1 AND started_at < ?2 AND ended_at IS NOT NULL
         ORDER BY started_at DESC",
    )?;
    let sessions = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok(ActivitySession {
                id: row.get(0)?,
                app_name: row.get(1)?,
                app_title: row.get(2)?,
                started_at: row.get(3)?,
                ended_at: row.get(4)?,
                duration_secs: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(sessions)
}
