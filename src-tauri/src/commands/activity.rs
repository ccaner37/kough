use tauri::State;

use crate::db::{self, DbState};
use crate::error::AppError;
use crate::models::activity::*;

macro_rules! lock_conn {
    ($db:expr) => {
        $db.conn
            .lock()
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?
    };
}

#[tauri::command]
pub fn get_activity_summary(
    db: State<'_, DbState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<AppUsageSummary>, AppError> {
    let conn = lock_conn!(db);
    db::activity_repository::get_activity_summary(&conn, &start_date, &end_date)
}

#[tauri::command]
pub fn get_activity_sessions(
    db: State<'_, DbState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<ActivitySession>, AppError> {
    let conn = lock_conn!(db);
    db::activity_repository::get_activity_sessions(&conn, &start_date, &end_date)
}

#[tauri::command]
pub fn get_active_session(db: State<'_, DbState>) -> Result<Option<ActivitySession>, AppError> {
    let conn = lock_conn!(db);
    db::activity_repository::get_active_session(&conn)
}
