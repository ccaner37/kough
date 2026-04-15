# Activity Tracking + System Tray — Design Spec

**Date**: 2026-04-16
**Status**: Approved

## Overview

Extend Kough from a kanban board into a productivity app by adding automatic activity tracking (like iOS Screen Time) and system tray integration. The app tracks which application is in the foreground, stores it in SQLite, and presents usage data in a new Activity view.

## Decisions

| Area | Decision |
|---|---|
| What to track | Foreground app process name + window title, no grouping/categories |
| Tracking mechanism | Rust background thread, 1-second polling via Win32 `GetForegroundWindow` |
| Storage | `activity_sessions` table in SQLite, keep forever |
| Views | Full date range picker with presets (Today, Yesterday, 7d, 30d, All Time) |
| Charts | Custom horizontal bar chart (no external lib), summary cards, session timeline |
| Navigation | Sidebar tabs: "Board" / "Activity" |
| System tray | Hide-to-tray on close, tray menu: "Show Kough" / "Quit" |
| Tracking control | Always on when app is running (no pause/schedule) |
| Platform | Windows only for now |

## Section 1: System Tray + Window Lifecycle

### Close button behavior

The X button on the custom titlebar calls `getCurrentWindow().hide()` instead of `.close()`, sending the window to the system tray. The app keeps running in the background.

### System tray

A tray icon in the Windows taskbar notification area with two menu items:
- **"Show Kough"** — brings the window back (unhide + focus)
- **"Quit"** — terminates the app (stops tracking thread, closes SQLite, exits process)

### Tauri changes

- Enable `tray-icon` feature on the `tauri` crate in `Cargo.toml`
- Add tray icon setup in `lib.rs` using `tauri::tray::TrayIconBuilder`
- Add `core:tray:default` permission to capabilities
- Intercept `CloseRequested` event on the main window to hide instead of close via `window.on_window_event`
- The tracking thread runs independently of window visibility

### TitleBar.tsx change

The close button calls `getCurrentWindow().hide()` instead of `.close()`.

## Section 2: Activity Tracking Engine (Rust)

### New dependency

Add the `windows` crate to `Cargo.toml` under `[target.'cfg(windows)'.dependencies]` for Windows-only usage.

### New module: `src-tauri/src/tracker/`

- `mod.rs` — module root, exports `start_tracker` and `stop_tracker`
- `windows.rs` — uses Win32 API to get foreground app info:
  - `GetForegroundWindow()` — get the HWND of the active window
  - `GetWindowTextW()` — get the window title
  - `GetWindowThreadProcessId()` + `OpenProcess()` + `GetProcessImageFileNameW()` — get the process executable name
- `tracker.rs` — background thread logic:
  - Spawns on app startup in `lib.rs` setup
  - Every 1 second, polls the foreground window
  - If the foreground app changed since last poll, ends the current session and starts a new one
  - If the same app is still foreground, the session continues (no DB write)
  - On app quit, ends any active session before terminating
  - Uses an `AtomicBool` flag shared between the main thread and tracker thread for clean shutdown. Setting the flag to `false` causes the tracker loop to exit, end any active session, and join the thread.

### Session model

A session = a contiguous time block where the same app was in the foreground. If you're in Chrome for 30 minutes, that's one session row. When you switch to VS Code, the Chrome session gets its `ended_at` set and a new VS Code session starts.

### Data captured per session

- `app_name` — the process executable name (e.g., `chrome.exe`)
- `app_title` — the window title at the start of the session
- `started_at` / `ended_at` — ISO 8601 timestamps

### Thread safety

The tracker thread acquires the same `Mutex<Connection>` that Tauri commands use. Since it only writes on app switches (not every second), contention with the UI is negligible.

## Section 3: Database Schema

### New migration (migration #2 in `migrations.rs`)

```sql
CREATE TABLE activity_sessions (
    id          TEXT PRIMARY KEY,
    app_name    TEXT NOT NULL,
    app_title   TEXT NOT NULL DEFAULT '',
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    duration_secs INTEGER
);

CREATE INDEX idx_activity_app ON activity_sessions(app_name);
CREATE INDEX idx_activity_started ON activity_sessions(started_at);
CREATE INDEX idx_activity_ended ON activity_sessions(ended_at);
```

- `id` — UUID v7 (time-sortable)
- `ended_at` — NULL while session is active
- `duration_secs` — set when session ends; enables fast `SUM(duration_secs)` aggregation

### New repository functions

Located in a new `src-tauri/src/db/activity_repository.rs`:

- `start_session(conn, app_name, app_title)` — insert new row with `started_at`, return the ID
- `end_session(conn, id)` — set `ended_at` and `duration_secs` on the active session
- `get_activity_summary(conn, start_date, end_date)` — aggregate: total seconds per app in date range, returns `Vec<AppUsageSummary>`
- `get_activity_sessions(conn, start_date, end_date)` — individual session rows for date range
- `get_active_session(conn)` — returns the current in-progress session (if any)

## Section 4: Frontend — Activity View UI

### Sidebar update

The sidebar gets two navigation tabs at the top:
- **"Board"** — current kanban view (default)
- **"Activity"** — new activity tracking view (clock/chart icon)

Clicking switches the main content area. Active tab is highlighted.

### Activity view layout

Replaces the board area when "Activity" tab is selected.

1. **Top bar**: Date range picker (from/to date selection). Preset buttons: "Today", "Yesterday", "Last 7 Days", "Last 30 Days", "All Time". Defaults to "Today" on first open.
2. **Summary cards row**: 3 stat cards — "Total Screen Time" (sum), "Most Used App" (top app name + duration), "Session Count".
3. **Bar chart**: Horizontal bars showing each app's total time for the selected range, sorted by duration descending. App name on the left, bar proportional to time, exact duration label on the right. Uses oklch color palette for bar colors.
4. **Session timeline**: Expandable list of individual sessions per app. Shows app name, window title, start time → end time, duration.

### New files

- `src/components/activity/ActivityView.tsx` — main container with date picker + layout
- `src/components/activity/ActivityChart.tsx` — horizontal bar chart
- `src/components/activity/SessionTimeline.tsx` — session detail list
- `src/components/activity/SummaryCards.tsx` — stat cards row
- `src/stores/activityStore.ts` — Zustand store

### No external charting library

The bar chart is built with plain divs + Tailwind. Keeps the bundle lean.

### Status indicator

A small pulse/dot in the activity view header showing "Tracking active" with the current app name. Polls `get_active_session` every 5 seconds.

## Section 5: Tauri Commands + API Layer

### New Rust commands

Located in `src-tauri/src/commands/activity.rs`:

- `get_activity_summary(start_date: String, end_date: String)` — returns `Vec<AppUsageSummary>`
- `get_activity_sessions(start_date: String, end_date: String)` — returns `Vec<ActivitySession>`
- `get_active_session()` — returns `Option<ActivitySession>`

### New Rust models

Located in `src-tauri/src/models/activity.rs`:

```rust
pub struct ActivitySession {
    pub id: String,
    pub app_name: String,
    pub app_title: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_secs: Option<i64>,
}

pub struct AppUsageSummary {
    pub app_name: String,
    pub total_secs: i64,
    pub session_count: i64,
}
```

### New TS types (in `types/index.ts`)

```typescript
interface ActivitySession {
  id: string;
  app_name: string;
  app_title: string;
  started_at: string;
  ended_at: string | null;
  duration_secs: number | null;
}

interface AppUsageSummary {
  app_name: string;
  total_secs: number;
  session_count: number;
}
```

### New API methods (in `lib/invoke.ts`)

```typescript
api.activity.getSummary(startDate: string, endDate: string): Promise<AppUsageSummary[]>
api.activity.getSessions(startDate: string, endDate: string): Promise<ActivitySession[]>
api.activity.getActiveSession(): Promise<ActivitySession | null>
```

## File Changes Summary

### New dependencies
- `tauri` crate: add `tray-icon` feature
- `windows` crate: Win32 API for foreground window (Windows-only via cfg target)

### New files (Rust)
- `src-tauri/src/tracker/mod.rs`
- `src-tauri/src/tracker/tracker.rs`
- `src-tauri/src/tracker/windows.rs`
- `src-tauri/src/commands/activity.rs`
- `src-tauri/src/models/activity.rs`
- `src-tauri/src/db/activity_repository.rs`

### New files (Frontend)
- `src/components/activity/ActivityView.tsx`
- `src/components/activity/ActivityChart.tsx`
- `src/components/activity/SessionTimeline.tsx`
- `src/components/activity/SummaryCards.tsx`
- `src/stores/activityStore.ts`

### Modified files
- `Cargo.toml` — new deps + tray-icon feature
- `src-tauri/src/lib.rs` — tray setup, tracker thread spawn, close event interception, register new commands
- `src-tauri/src/commands/mod.rs` — add activity module
- `src-tauri/src/models/mod.rs` — add activity module
- `src-tauri/src/db/mod.rs` — add activity_repository module
- `src-tauri/src/db/migrations.rs` — new migration
- `src-tauri/capabilities/default.json` — tray permissions
- `src/components/layout/TitleBar.tsx` — close → hide
- `src/components/layout/Sidebar.tsx` — tab navigation
- `src/components/layout/MainContent.tsx` — conditional render based on active tab
- `src/types/index.ts` — new TS types
- `src/lib/invoke.ts` — new API methods
