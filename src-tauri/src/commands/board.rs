use tauri::State;

use crate::db::{self, DbState};
use crate::error::AppError;
use crate::models::board::*;

macro_rules! lock_conn {
    ($db:expr) => {
        $db.conn
            .lock()
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?
    };
}

#[tauri::command]
pub fn get_boards(db: State<'_, DbState>) -> Result<Vec<Board>, AppError> {
    let conn = lock_conn!(db);
    db::repository::get_boards(&conn)
}

#[tauri::command]
pub fn create_board(db: State<'_, DbState>, input: CreateBoardInput) -> Result<Board, AppError> {
    let conn = lock_conn!(db);
    db::repository::create_board(&conn, &input)
}

#[tauri::command]
pub fn update_board(db: State<'_, DbState>, input: UpdateBoardInput) -> Result<Board, AppError> {
    let conn = lock_conn!(db);
    db::repository::update_board(&conn, &input)
}

#[tauri::command]
pub fn delete_board(db: State<'_, DbState>, board_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::delete_board(&conn, &board_id)
}
