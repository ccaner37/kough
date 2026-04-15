# Activity Tracking + System Tray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic foreground app tracking (Screen Time-like) and system tray integration to Kough.

**Architecture:** A Rust background thread polls the foreground window every 1 second using Win32 APIs, writing sessions to SQLite. The window hides to system tray on close. A new "Activity" sidebar tab shows usage charts with a date range picker.

**Tech Stack:** Tauri v2, `windows` crate (Win32 API), SQLite, React + Zustand, Tailwind CSS v4

---

### Task 1: Add Rust dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add `tray-icon` feature to tauri and add `windows` crate**

Change line 21 of `Cargo.toml` from:
```toml
tauri = { version = "2", features = [] }
```
to:
```toml
tauri = { version = "2", features = ["tray-icon"] }
```

Then add at the end of the file:
```toml
[target.'cfg(windows)'.dependencies]
windows = { version = "0.61", features = ["Win32_Foundation", "Win32_UI_WindowsAndMessaging", "Win32_System_Threading", "Win32_System_ProcessStatus"] }
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors (may download `windows` crate)

- [ ] **Step 3: Commit**
```bash
git add src-tauri/Cargo.toml
git commit -m "Add tray-icon feature and windows crate dependency"
```

---

### Task 2: Activity database migration

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`

- [ ] **Step 1: Add migration #2 for `activity_sessions` table**

Add a second entry to the `MIGRATIONS` array in `migrations.rs`. After the closing `"` of the first migration and before `];`, add:

```rust
,"
CREATE TABLE IF NOT EXISTS activity_sessions (
    id              TEXT PRIMARY KEY,
    app_name        TEXT NOT NULL,
    app_title       TEXT NOT NULL DEFAULT '',
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    duration_secs   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_activity_app ON activity_sessions(app_name);
CREATE INDEX IF NOT EXISTS idx_activity_started ON activity_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_activity_ended ON activity_sessions(ended_at);
"
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 3: Commit**
```bash
git add src-tauri/src/db/migrations.rs
git commit -m "Add activity_sessions table migration"
```

---

### Task 3: Activity models

**Files:**
- Create: `src-tauri/src/models/activity.rs`
- Modify: `src-tauri/src/models/mod.rs`

- [ ] **Step 1: Create `models/activity.rs`**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivitySession {
    pub id: String,
    pub app_name: String,
    pub app_title: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_secs: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppUsageSummary {
    pub app_name: String,
    pub total_secs: i64,
    pub session_count: i64,
}
```

- [ ] **Step 2: Register module in `models/mod.rs`**

Change `src-tauri/src/models/mod.rs` to:
```rust
pub mod activity;
pub mod board;
pub mod column;
pub mod tag;
pub mod task;
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 4: Commit**
```bash
git add src-tauri/src/models/activity.rs src-tauri/src/models/mod.rs
git commit -m "Add ActivitySession and AppUsageSummary models"
```

---

### Task 4: Activity repository

**Files:**
- Create: `src-tauri/src/db/activity_repository.rs`
- Modify: `src-tauri/src/db/mod.rs`

- [ ] **Step 1: Create `db/activity_repository.rs`**

```rust
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
```

- [ ] **Step 2: Register module in `db/mod.rs`**

Change `src-tauri/src/db/mod.rs` to:
```rust
pub mod activity_repository;
pub mod connection;
pub mod migrations;
pub mod repository;

pub use connection::DbState;
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 4: Commit**
```bash
git add src-tauri/src/db/activity_repository.rs src-tauri/src/db/mod.rs
git commit -m "Add activity repository with session CRUD and summary queries"
```

---

### Task 5: Activity Tauri commands

**Files:**
- Create: `src-tauri/src/commands/activity.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create `commands/activity.rs`**

```rust
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
pub fn get_active_session(
    db: State<'_, DbState>,
) -> Result<Option<ActivitySession>, AppError> {
    let conn = lock_conn!(db);
    db::activity_repository::get_active_session(&conn)
}
```

- [ ] **Step 2: Register module in `commands/mod.rs`**

Change `src-tauri/src/commands/mod.rs` to:
```rust
pub mod activity;
pub mod board;
pub mod column;
pub mod tag;
pub mod task;
```

- [ ] **Step 3: Register commands in `lib.rs` invoke_handler**

Add these entries to the `generate_handler![]` macro in `src-tauri/src/lib.rs`:
```rust
commands::activity::get_activity_summary,
commands::activity::get_activity_sessions,
commands::activity::get_active_session,
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 5: Commit**
```bash
git add src-tauri/src/commands/activity.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "Add activity Tauri commands for summary, sessions, and active session"
```

---

### Task 6: Tracker module — Win32 foreground window detection

**Files:**
- Create: `src-tauri/src/tracker/mod.rs`
- Create: `src-tauri/src/tracker/windows.rs`
- Create: `src-tauri/src/tracker/tracker.rs`

- [ ] **Step 1: Create `tracker/mod.rs`**

```rust
#[cfg(windows)]
pub mod tracker;
#[cfg(windows)]
pub mod windows;

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

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
```

- [ ] **Step 2: Create `tracker/windows.rs`**

```rust
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::core::PWSTR;

pub struct ForegroundApp {
    pub process_name: String,
    pub window_title: String,
}

pub fn get_foreground_app() -> Option<ForegroundApp> {
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.is_invalid() || hwnd == HWND::default() {
            return None;
        }

        let window_title = get_window_title(hwnd);
        let process_name = get_process_name(hwnd);

        Some(ForegroundApp {
            process_name,
            window_title,
        })
    }
}

fn get_window_title(hwnd: HWND) -> String {
    unsafe {
        let mut buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut buf);
        if len == 0 {
            return String::new();
        }
        String::from_utf16_lossy(&buf[..len as usize])
    }
}

fn get_process_name(hwnd: HWND) -> String {
    unsafe {
        let mut pid: u32 = 0;
        windows::Win32::System::Threading::GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return "unknown".to_string();
        }

        let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return "unknown".to_string();
        };

        let mut len: u32 = 512;
        let mut buf = [0u16; 512];
        let result = QueryFullProcessImageNameW(
            process,
            windows::Win32::System::Threading::PROCESS_NAME_WIN32,
            PWSTR(buf.as_mut_ptr()),
            &mut len,
        );

        if result.is_err() || len == 0 {
            return "unknown".to_string();
        }

        let full_path = String::from_utf16_lossy(&buf[..len as usize]);
        full_path
            .rsplit('\\')
            .next()
            .unwrap_or("unknown")
            .to_string()
    }
}
```

- [ ] **Step 3: Create `tracker/tracker.rs`**

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::Duration;
use rusqlite::Connection;

use crate::db::activity_repository;
use super::windows;

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
                    if let Ok(session) =
                        activity_repository::start_session(&conn, &info.process_name, &info.window_title)
                    {
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
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Note: The `windows` crate feature flags may need adjustment based on compile errors.

- [ ] **Step 5: Commit**
```bash
git add src-tauri/src/tracker/
git commit -m "Add tracker module with Win32 foreground window polling"
```

---

### Task 7: System tray + window close interception

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Update `lib.rs` with tray, tracker startup, and close interception**

The tracker needs its own SQLite connection (separate from the Tauri-managed one) to avoid mutex contention. Open a second connection to the same database file.

Full updated `lib.rs`:
```rust
mod commands;
mod db;
mod error;
mod models;
mod tracker;

use std::sync::Arc;
use std::sync::Mutex;
use db::DbState;
use tauri::Manager;
use tauri::WindowEvent;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let conn = db::connection::init_db(app.handle())?;
            app.manage(DbState {
                conn: Mutex::new(conn),
            });

            let tracker_conn = {
                let app_dir = app.path().app_data_dir().map_err(|e| {
                    crate::error::AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
                })?;
                let db_path = std::path::PathBuf::from(&app_dir).join("kough.db");
                let conn = rusqlite::Connection::open(&db_path)?;
                conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
                Arc::new(Mutex::new(conn))
            };

            let _tracker_handle = tracker::start_tracker(tracker_conn);

            let show_item = MenuItemBuilder::with_id("show", "Show Kough").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &quit_item])
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let win = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                });
            }

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
```

- [ ] **Step 2: Update capabilities to add tray permissions**

Change `src-tauri/capabilities/default.json` to:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:tray:default",
    "opener:default"
  ]
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`

- [ ] **Step 4: Commit**
```bash
git add src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "Add system tray, window close interception, and tracker startup"
```

---

### Task 8: Update TitleBar close button to hide

**Files:**
- Modify: `src/components/layout/TitleBar.tsx`

- [ ] **Step 1: Change close button from `.close()` to `.hide()`**

In `src/components/layout/TitleBar.tsx`, change:
```tsx
          onClick={() => getCurrentWindow().close()}
```
to:
```tsx
          onClick={() => getCurrentWindow().hide()}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/components/layout/TitleBar.tsx
git commit -m "Change close button to hide window instead of closing"
```

---

### Task 9: Add TypeScript types for activity

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add ActivitySession and AppUsageSummary types**

Add at the end of `src/types/index.ts`:

```typescript
export interface ActivitySession {
  id: string;
  app_name: string;
  app_title: string;
  started_at: string;
  ended_at: string | null;
  duration_secs: number | null;
}

export interface AppUsageSummary {
  app_name: string;
  total_secs: number;
  session_count: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/types/index.ts
git commit -m "Add ActivitySession and AppUsageSummary TypeScript types"
```

---

### Task 10: Add activity API methods

**Files:**
- Modify: `src/lib/invoke.ts`

- [ ] **Step 1: Add activity namespace to the API**

Update imports in `src/lib/invoke.ts` to include the new types:
```typescript
import type {
  Board, Column, Task, Tag,
  CreateBoardInput, UpdateBoardInput,
  CreateColumnInput, UpdateColumnInput,
  CreateTaskInput, UpdateTaskInput, MoveTaskInput, ReorderTaskInput,
  CreateTagInput, UpdateTagInput,
  ActivitySession, AppUsageSummary,
} from "@/types";
```

Add a new namespace to the `api` object:
```typescript
  activity: {
    summary: (startDate: string, endDate: string) =>
      cmd<AppUsageSummary[]>("get_activity_summary", { startDate, endDate }),
    sessions: (startDate: string, endDate: string) =>
      cmd<ActivitySession[]>("get_activity_sessions", { startDate, endDate }),
    activeSession: () => cmd<ActivitySession | null>("get_active_session"),
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/lib/invoke.ts
git commit -m "Add activity API methods to invoke wrapper"
```

---

### Task 11: Add activeView to UI store

**Files:**
- Modify: `src/stores/uiStore.ts`

- [ ] **Step 1: Add `activeView` state and setter**

Full updated `src/stores/uiStore.ts`:
```typescript
import { create } from "zustand";

type ViewType = "board" | "activity";

interface UIState {
  sidebarOpen: boolean;
  taskDetailOpen: boolean;
  activeTaskId: string | null;
  editingColumnId: string | null;
  activeView: ViewType;

  toggleSidebar: () => void;
  openTaskDetail: (taskId: string) => void;
  closeTaskDetail: () => void;
  setEditingColumn: (columnId: string | null) => void;
  setActiveView: (view: ViewType) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  taskDetailOpen: false,
  activeTaskId: null,
  editingColumnId: null,
  activeView: "board",

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  openTaskDetail: (taskId: string) =>
    set({ taskDetailOpen: true, activeTaskId: taskId }),

  closeTaskDetail: () =>
    set({ taskDetailOpen: false, activeTaskId: null }),

  setEditingColumn: (columnId: string | null) =>
    set({ editingColumnId: columnId }),

  setActiveView: (view: ViewType) =>
    set({ activeView: view }),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/stores/uiStore.ts
git commit -m "Add activeView state to UI store for board/activity switching"
```

---

### Task 12: Activity Zustand store

**Files:**
- Create: `src/stores/activityStore.ts`

- [ ] **Step 1: Create `stores/activityStore.ts`**

```typescript
import { create } from "zustand";
import { api } from "@/lib/invoke";
import type { ActivitySession, AppUsageSummary } from "@/types";

interface ActivityState {
  summary: AppUsageSummary[];
  sessions: ActivitySession[];
  activeSession: ActivitySession | null;
  loading: boolean;
  startDate: string;
  endDate: string;

  fetchSummary: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchActiveSession: () => Promise<void>;
  setDateRange: (start: string, end: string) => void;
}

function today(): string {
  return new Date().toISOString().split("T")[0] + "T00:00:00Z";
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0] + "T00:00:00Z";
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  summary: [],
  sessions: [],
  activeSession: null,
  loading: false,
  startDate: today(),
  endDate: tomorrow(),

  fetchSummary: async () => {
    const { startDate, endDate } = get();
    set({ loading: true });
    const summary = await api.activity.summary(startDate, endDate);
    set({ summary, loading: false });
  },

  fetchSessions: async () => {
    const { startDate, endDate } = get();
    const sessions = await api.activity.sessions(startDate, endDate);
    set({ sessions });
  },

  fetchActiveSession: async () => {
    const activeSession = await api.activity.activeSession();
    set({ activeSession });
  },

  setDateRange: (start: string, end: string) => {
    set({ startDate: start, endDate: end });
  },
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/stores/activityStore.ts
git commit -m "Add activity Zustand store with date range and data fetching"
```

---

### Task 13: Update Sidebar with Board/Activity tabs

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add tab navigation to Sidebar**

Full updated `src/components/layout/Sidebar.tsx`:
```tsx
import { useState } from "react";
import { Plus, Trash2, Kanban, Clock } from "lucide-react";
import { useBoardStore } from "@/stores/boardStore";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { boards, activeBoardId, createBoard, setActiveBoard, deleteBoard } =
    useBoardStore();
  const { activeView, setActiveView } = useUIStore();
  const [newTitle, setNewTitle] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleCreate = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const board = await createBoard(trimmed);
    setNewTitle("");
    setShowInput(false);
    setActiveBoard(board.id);
  };

  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-1 px-2 pt-3 pb-2">
        <button
          onClick={() => setActiveView("board")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            activeView === "board"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Kanban size={14} />
          Board
        </button>
        <button
          onClick={() => setActiveView("activity")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            activeView === "activity"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Clock size={14} />
          Activity
        </button>
      </div>

      {activeView === "board" && (
        <>
          <div className="flex-1 overflow-y-auto px-2">
            {boards.map((board) => (
              <div
                key={board.id}
                className={cn(
                  "group flex items-center justify-between rounded-md px-3 py-2 cursor-pointer text-sm transition-colors",
                  board.id === activeBoardId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
                onClick={() => setActiveBoard(board.id)}
              >
                <span className="truncate">{board.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteBoard(board.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-border p-2">
            {showInput ? (
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setShowInput(false);
                      setNewTitle("");
                    }
                  }}
                  placeholder="Board name..."
                  className="w-full rounded bg-secondary px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ) : (
              <button
                onClick={() => setShowInput(true)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <Plus size={14} />
                New Board
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/components/layout/Sidebar.tsx
git commit -m "Add Board/Activity tab navigation to sidebar"
```

---

### Task 14: Activity view — Summary cards component

**Files:**
- Create: `src/components/activity/SummaryCards.tsx`

- [ ] **Step 1: Create `activity/SummaryCards.tsx`**

```tsx
import type { AppUsageSummary } from "@/types";

interface SummaryCardsProps {
  summary: AppUsageSummary[];
  totalSessions: number;
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function SummaryCards({ summary, totalSessions }: SummaryCardsProps) {
  const totalSecs = summary.reduce((acc, s) => acc + s.total_secs, 0);
  const topApp = summary.length > 0 ? summary[0] : null;

  const cards = [
    { label: "Total Screen Time", value: formatDuration(totalSecs) },
    {
      label: "Most Used App",
      value: topApp ? topApp.app_name.replace(".exe", "") : "—",
    },
    { label: "Sessions", value: totalSessions.toString() },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-xl font-semibold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/components/activity/SummaryCards.tsx
git commit -m "Add SummaryCards component for activity stats"
```

---

### Task 15: Activity view — Bar chart component

**Files:**
- Create: `src/components/activity/ActivityChart.tsx`

- [ ] **Step 1: Create `activity/ActivityChart.tsx`**

```tsx
import type { AppUsageSummary } from "@/types";

interface ActivityChartProps {
  summary: AppUsageSummary[];
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const BAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-cyan-500", "bg-yellow-500", "bg-red-500",
  "bg-indigo-500", "bg-teal-500",
];

export function ActivityChart({ summary }: ActivityChartProps) {
  if (summary.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No activity data for this period
      </div>
    );
  }

  const maxSecs = summary[0].total_secs;

  return (
    <div className="space-y-2">
      {summary.map((item, i) => {
        const widthPercent = Math.max((item.total_secs / maxSecs) * 100, 2);
        const color = BAR_COLORS[i % BAR_COLORS.length];
        return (
          <div key={item.app_name} className="flex items-center gap-3">
            <span className="w-32 truncate text-sm text-muted-foreground text-right">
              {item.app_name.replace(".exe", "")}
            </span>
            <div className="flex-1 h-6 bg-secondary rounded overflow-hidden">
              <div
                className={`h-full rounded ${color} transition-all`}
                style={{ width: `${widthPercent}%` }}
              />
            </div>
            <span className="w-16 text-sm text-right">
              {formatDuration(item.total_secs)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/components/activity/ActivityChart.tsx
git commit -m "Add ActivityChart horizontal bar chart component"
```

---

### Task 16: Activity view — Session timeline component

**Files:**
- Create: `src/components/activity/SessionTimeline.tsx`

- [ ] **Step 1: Create `activity/SessionTimeline.tsx`**

```tsx
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ActivitySession } from "@/types";

interface SessionTimelineProps {
  sessions: ActivitySession[];
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SessionTimeline({ sessions }: SessionTimelineProps) {
  const grouped = groupByApp(sessions);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (app: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(app)) next.delete(app);
      else next.add(app);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Sessions</h3>
      {grouped.map(([app, sessions]) => {
        const isOpen = expanded.has(app);
        const totalSecs = sessions.reduce((a, s) => a + (s.duration_secs ?? 0), 0);
        return (
          <div key={app} className="rounded-md border border-border">
            <button
              onClick={() => toggle(app)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>{app.replace(".exe", "")}</span>
                <span className="text-xs text-muted-foreground">
                  ({sessions.length} sessions)
                </span>
              </div>
              <span className="text-muted-foreground">{formatDuration(totalSecs)}</span>
            </button>
            {isOpen && (
              <div className="border-t border-border px-3 py-1">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-1.5 text-xs text-muted-foreground border-b border-border last:border-0"
                  >
                    <span className="truncate mr-2 flex-1">{s.app_title || "—"}</span>
                    <span>
                      {formatTime(s.started_at)} → {formatTime(s.ended_at!)}
                    </span>
                    <span className="ml-3 w-12 text-right">
                      {formatDuration(s.duration_secs ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function groupByApp(sessions: ActivitySession[]): [string, ActivitySession[]][] {
  const map = new Map<string, ActivitySession[]>();
  for (const s of sessions) {
    const list = map.get(s.app_name) ?? [];
    list.push(s);
    map.set(s.app_name, list);
  }
  return [...map.entries()];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/components/activity/SessionTimeline.tsx
git commit -m "Add SessionTimeline expandable session list component"
```

---

### Task 17: Activity view — Main container with date range picker

**Files:**
- Create: `src/components/activity/ActivityView.tsx`

- [ ] **Step 1: Create `activity/ActivityView.tsx`**

```tsx
import { useEffect } from "react";
import { useActivityStore } from "@/stores/activityStore";
import { SummaryCards } from "./SummaryCards";
import { ActivityChart } from "./ActivityChart";
import { SessionTimeline } from "./SessionTimeline";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Today", offset: 0 },
  { label: "Yesterday", offset: -1 },
  { label: "Last 7 Days", offset: -7 },
  { label: "Last 30 Days", offset: -30 },
  { label: "All Time", offset: null },
] as const;

function toDateStr(offset: number | null): { start: string; end: string } {
  if (offset === null) {
    return { start: "2000-01-01T00:00:00Z", end: farFuture() };
  }
  const d = new Date();
  if (offset < 0) d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  const start = d.toISOString();
  const endD = new Date(d);
  if (offset === 0 || offset === -1) {
    endD.setDate(endD.getDate() + 1);
  } else {
    endD.setDate(new Date().getDate() + 1);
  }
  return { start, end: endD.toISOString() };
}

function farFuture(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 10);
  return d.toISOString();
}

export function ActivityView() {
  const {
    summary, sessions, activeSession, loading,
    fetchSummary, fetchSessions, fetchActiveSession,
    setDateRange,
  } = useActivityStore();

  useEffect(() => {
    fetchSummary();
    fetchSessions();
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchActiveSession, 5000);
    fetchActiveSession();
    return () => clearInterval(interval);
  }, []);

  const handlePreset = (offset: number | null) => {
    const { start, end } = toDateStr(offset);
    setDateRange(start, end);
    useActivityStore.setState({ startDate: start, endDate: end });
    fetchSummary();
    fetchSessions();
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Activity</h2>
          {activeSession && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Tracking: {activeSession.app_name.replace(".exe", "")}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p.offset)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                "text-muted-foreground hover:bg-accent/50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Loading...
        </div>
      ) : (
        <>
          <SummaryCards summary={summary} totalSessions={sessions.length} />
          <ActivityChart summary={summary} />
          <SessionTimeline sessions={sessions} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/components/activity/ActivityView.tsx
git commit -m "Add ActivityView main container with date range picker"
```

---

### Task 18: Wire up MainContent to switch between Board and Activity

**Files:**
- Modify: `src/components/layout/MainContent.tsx`

- [ ] **Step 1: Add ActivityView to MainContent**

Full updated `src/components/layout/MainContent.tsx`:
```tsx
import { useEffect } from "react";
import { useBoardStore } from "@/stores/boardStore";
import { useTaskStore } from "@/stores/taskStore";
import { useTagStore } from "@/stores/tagStore";
import { useUIStore } from "@/stores/uiStore";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { Board } from "@/components/board/Board";
import { ActivityView } from "@/components/activity/ActivityView";
import { TaskDetailModal } from "@/components/task/TaskDetailModal";
import { TagFilter } from "@/components/tags/TagFilter";

export function MainContent() {
  const { activeBoardId, fetchBoards } = useBoardStore();
  const { fetchTasks } = useTaskStore();
  const { fetchTags } = useTagStore();
  const { sidebarOpen, taskDetailOpen, activeView } = useUIStore();

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    if (activeBoardId) {
      fetchTasks(activeBoardId);
      fetchTags(activeBoardId);
    }
  }, [activeBoardId, fetchTasks, fetchTags]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}
        <main className="flex flex-1 flex-col overflow-hidden">
          {activeView === "board" && (
            <>
              <TagFilter />
              <Board />
            </>
          )}
          {activeView === "activity" && <ActivityView />}
        </main>
      </div>
      {taskDetailOpen && <TaskDetailModal />}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/components/layout/MainContent.tsx
git commit -m "Wire up Board/Activity view switching in MainContent"
```

---

### Task 19: Full integration test

**Files:** None (verification only)

- [ ] **Step 1: Run full Rust check**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 2: Run full frontend build**

Run: `npm run build`
Expected: No TypeScript errors, Vite build succeeds

- [ ] **Step 3: Run the app in dev mode and manually verify**

Run: `npm run tauri dev`

Verify:
- App launches with kanban board
- System tray icon appears in Windows notification area
- Clicking X hides the window (app stays in tray)
- Right-clicking tray shows "Show Kough" and "Quit"
- "Show Kough" brings window back
- "Quit" exits the app
- Sidebar has "Board" and "Activity" tabs
- Clicking "Activity" shows the activity view with date presets
- Activity data populates as apps are used
