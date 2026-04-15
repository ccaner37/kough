use rusqlite::Connection;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::Duration;

use super::windows;
use crate::db::activity_repository;

pub fn run(db_conn: Arc<Mutex<Connection>>, running: &AtomicBool) {
    let mut current_session_id: Option<String> = None;
    let mut current_app: Option<String> = None;

    while running.load(Ordering::SeqCst) {
        let app_info = windows::get_foreground_app();

        if let Some(info) = app_info {
            let app_changed = current_app.as_ref() != Some(&info.process_name);

            if app_changed {
                if let Some(ref session_id) = current_session_id {
                    if let Ok(conn) = db_conn.lock() {
                        let _ = activity_repository::end_session(&conn, session_id);
                    }
                }

                if let Ok(conn) = db_conn.lock() {
                    if let Ok(session) = activity_repository::start_session(
                        &conn,
                        &info.process_name,
                        &info.window_title,
                    ) {
                        current_session_id = Some(session.id);
                        current_app = Some(info.process_name);
                    }
                }
            }
        }

        std::thread::sleep(Duration::from_secs(1));
    }

    if let Some(ref session_id) = current_session_id {
        if let Ok(conn) = db_conn.lock() {
            let _ = activity_repository::end_session(&conn, session_id);
        }
    }
}
