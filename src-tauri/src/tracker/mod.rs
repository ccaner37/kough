#[cfg(windows)]
pub mod tracker;
#[cfg(windows)]
pub mod windows;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct TrackerHandle {
    running: Arc<AtomicBool>,
}

impl TrackerHandle {
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}

pub fn start_tracker(db_conn: Arc<std::sync::Mutex<rusqlite::Connection>>) -> TrackerHandle {
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();
    std::thread::spawn(move || {
        #[cfg(windows)]
        tracker::run(db_conn, &running_clone);
    });
    TrackerHandle { running }
}
