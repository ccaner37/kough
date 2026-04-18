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
pub fn get_app_usage_summary(
    db: State<'_, DbState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<AppUsageSummary>, AppError> {
    let conn = lock_conn!(db);
    db::activity_repository::get_app_usage_summary(&conn, &start_date, &end_date)
}

#[tauri::command]
pub fn get_browser_usage_summary(
    db: State<'_, DbState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<BrowserUsageSummary>, AppError> {
    let conn = lock_conn!(db);
    db::activity_repository::get_browser_usage_summary(&conn, &start_date, &end_date)
}

#[tauri::command]
pub fn get_active_tracking() -> Result<ActiveTracking, AppError> {
    let current = crate::tracker::get_current_tracking();
    match current {
        Some(t) => Ok(ActiveTracking {
            app_name: t.app_name,
            domain: t.domain,
        }),
        None => Ok(ActiveTracking {
            app_name: String::new(),
            domain: None,
        }),
    }
}
