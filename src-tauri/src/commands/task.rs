use tauri::State;

use crate::db::{self, DbState};
use crate::error::AppError;
use crate::models::task::*;

macro_rules! lock_conn {
    ($db:expr) => {
        $db.conn
            .lock()
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?
    };
}

#[tauri::command]
pub fn get_tasks_by_column(
    db: State<'_, DbState>,
    column_id: String,
) -> Result<Vec<Task>, AppError> {
    let conn = lock_conn!(db);
    db::repository::get_tasks_by_column(&conn, &column_id)
}

#[tauri::command]
pub fn get_tasks_by_board(db: State<'_, DbState>, board_id: String) -> Result<Vec<Task>, AppError> {
    let conn = lock_conn!(db);
    db::repository::get_tasks_by_board(&conn, &board_id)
}

#[tauri::command]
pub fn create_task(db: State<'_, DbState>, input: CreateTaskInput) -> Result<Task, AppError> {
    let conn = lock_conn!(db);
    db::repository::create_task(&conn, &input)
}

#[tauri::command]
pub fn update_task(db: State<'_, DbState>, input: UpdateTaskInput) -> Result<Task, AppError> {
    let conn = lock_conn!(db);
    db::repository::update_task(&conn, &input)
}

#[tauri::command]
pub fn move_task(db: State<'_, DbState>, input: MoveTaskInput) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::move_task(
        &conn,
        &input.task_id,
        &input.target_column_id,
        input.new_position,
    )
}

#[tauri::command]
pub fn reorder_task(db: State<'_, DbState>, input: ReorderTaskInput) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::reorder_task(&conn, &input.task_id, input.new_position)
}

#[tauri::command]
pub fn delete_task(db: State<'_, DbState>, task_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::delete_task(&conn, &task_id)
}
