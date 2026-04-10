use tauri::State;

use crate::db::{self, DbState};
use crate::error::AppError;
use crate::models::tag::*;

macro_rules! lock_conn {
    ($db:expr) => {
        $db.conn
            .lock()
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?
    };
}

#[tauri::command]
pub fn get_tags_by_board(db: State<'_, DbState>, board_id: String) -> Result<Vec<Tag>, AppError> {
    let conn = lock_conn!(db);
    db::repository::get_tags_by_board(&conn, &board_id)
}

#[tauri::command]
pub fn create_tag(db: State<'_, DbState>, input: CreateTagInput) -> Result<Tag, AppError> {
    let conn = lock_conn!(db);
    db::repository::create_tag(&conn, &input)
}

#[tauri::command]
pub fn update_tag(db: State<'_, DbState>, input: UpdateTagInput) -> Result<Tag, AppError> {
    let conn = lock_conn!(db);
    db::repository::update_tag(&conn, &input)
}

#[tauri::command]
pub fn delete_tag(db: State<'_, DbState>, tag_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::delete_tag(&conn, &tag_id)
}

#[tauri::command]
pub fn get_tags_for_task(db: State<'_, DbState>, task_id: String) -> Result<Vec<Tag>, AppError> {
    let conn = lock_conn!(db);
    db::repository::get_tags_for_task(&conn, &task_id)
}

#[tauri::command]
pub fn add_tag_to_task(
    db: State<'_, DbState>,
    task_id: String,
    tag_id: String,
) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::add_tag_to_task(&conn, &task_id, &tag_id)
}

#[tauri::command]
pub fn remove_tag_from_task(
    db: State<'_, DbState>,
    task_id: String,
    tag_id: String,
) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::remove_tag_from_task(&conn, &task_id, &tag_id)
}
