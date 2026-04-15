mod commands;
mod db;
mod error;
mod models;

use db::DbState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let conn = db::connection::init_db(app.handle())?;
            app.manage(DbState {
                conn: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::board::get_boards,
            commands::board::create_board,
            commands::board::update_board,
            commands::board::delete_board,
            commands::column::get_columns_by_board,
            commands::column::create_column,
            commands::column::update_column,
            commands::column::delete_column,
            commands::column::reorder_columns,
            commands::task::get_tasks_by_column,
            commands::task::get_tasks_by_board,
            commands::task::create_task,
            commands::task::update_task,
            commands::task::move_task,
            commands::task::reorder_task,
            commands::task::delete_task,
            commands::tag::get_tags_by_board,
            commands::tag::create_tag,
            commands::tag::update_tag,
            commands::tag::delete_tag,
            commands::tag::get_tags_for_task,
            commands::tag::add_tag_to_task,
            commands::tag::remove_tag_from_task,
            commands::activity::get_activity_summary,
            commands::activity::get_activity_sessions,
            commands::activity::get_active_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
