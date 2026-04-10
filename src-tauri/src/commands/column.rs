use tauri::State;

use crate::db::{self, DbState};
use crate::error::AppError;
use crate::models::column::*;

macro_rules! lock_conn {
    ($db:expr) => {
        $db.conn
            .lock()
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?
    };
}

#[tauri::command]
pub fn get_columns_by_board(
    db: State<'_, DbState>,
    board_id: String,
) -> Result<Vec<Column>, AppError> {
    let conn = lock_conn!(db);
    db::repository::get_columns_by_board(&conn, &board_id)
}

#[tauri::command]
pub fn create_column(db: State<'_, DbState>, input: CreateColumnInput) -> Result<Column, AppError> {
    let conn = lock_conn!(db);
    db::repository::create_column(&conn, &input)
}

#[tauri::command]
pub fn update_column(db: State<'_, DbState>, input: UpdateColumnInput) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::update_column(&conn, &input)
}

#[tauri::command]
pub fn delete_column(db: State<'_, DbState>, column_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::delete_column(&conn, &column_id)
}

#[tauri::command]
pub fn reorder_columns(
    db: State<'_, DbState>,
    column_id: String,
    new_position: f64,
) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::reorder_columns(&conn, &column_id, new_position)
}
