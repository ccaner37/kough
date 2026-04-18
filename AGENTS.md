# AGENTS.md — Kough

Kanban-style desktop app built with **Tauri v2** (Rust backend + React frontend).

**Roadmap**: Kough will become **peer-to-peer** — the ultimate kanban app that needs no server. Boards sync directly between devices.

## Commands

- `npm run tauri dev` — full desktop app with hot reload (not just `npm run dev`, which only starts Vite)
- `npm run build` — frontend only (`tsc && vite build`)
- `npm run tauri build` — production desktop bundle (frontend + Rust)
- No test runner, linter, or formatter is configured

## Architecture

```
src/                  # React frontend (Vite entry at src/main.tsx)
  components/
    activity/         # ActivityView, ActivityChart, BrowserDetail, CalendarPicker, SummaryCards
    board/            # TaskCard, Column, Board
    layout/           # Sidebar, MainContent, TitleBar
    tags/             # Tag management
    task/             # TaskDetailModal, DescriptionEditor (CodeMirror 6)
    ui/               # shadcn/ui primitives
  stores/             # Zustand stores (boardStore, taskStore, tagStore, uiStore, activityStore)
  lib/invoke.ts       # typed wrapper around Tauri invoke — all backend calls go here
  types/index.ts      # shared TS types mirroring Rust models
src-tauri/            # Rust backend
  src/commands/       # Tauri command handlers (board, column, task, tag, activity)
  src/db/             # SQLite init, migrations, repository layer
  src/models/         # Rust structs (Board, Column, Task, Tag, activity models)
  src/tracker/        # Background activity tracker (tracker.rs, windows.rs)
  src/error.rs        # AppError enum (thiserror + manual Serialize impl)
```

Frontend talks to Rust exclusively through `api.*` in `src/lib/invoke.ts`.

## Key conventions

- **Path alias**: `@/*` maps to `./src/*` (configured in `tsconfig.json` + `vite.config.ts`)
- **UI components**: shadcn/ui (`new-york` style, `rsc: false`, icons from `lucide-react`). Add new ones via the shadcn CLI
- **Styling**: Tailwind CSS v4 — uses `@import "tailwindcss"` in `src/index.css`, not v3 directives
- **Dark mode only**: `<html class="dark">`; custom variant `@custom-variant dark (&:is(.dark *))` in CSS
- **Custom titlebar**: native decorations disabled (`decorations: false`); use `data-tauri-drag-region` for draggable areas
- **Strict TS**: `noUnusedLocals` and `noUnusedParameters` are enabled — dead imports/params will fail `tsc`
- **State**: Zustand stores in `src/stores/`; each store calls `api.*` and manages local cache
- **No comments**: the entire codebase has zero comments — do not add any

## Backend gotchas

- **Database**: SQLite stored in Tauri's app data dir (`kough.db`), opened with WAL mode and foreign keys ON
- **Migrations**: defined inline in `src-tauri/src/db/migrations.rs` — schema changes go there as new entries in the `MIGRATIONS` array
- **IDs**: UUID v7 generated on the Rust side (crate `uuid` with `v7` feature)
- **Error handling**: `AppError` has a manual `Serialize` impl — adding variants requires updating the match in `error.rs`
- **Lib name**: Cargo lib is named `kough_lib` (not `kough`) to avoid Windows naming conflict; don't rename it
- `src-tauri/src/main.rs` has `windows_subsystem = "windows"` for release builds — do not remove

## Activity tracking (Screen Time)

Background tracker polls the foreground window every 1 second and aggregates usage per day into two tables: `app_usage` (app_name, date, total_secs) and `browser_usage` (domain, date, total_secs). Flushes to DB every 10 seconds.

### Browser URL extraction (`src-tauri/src/tracker/windows.rs`)

Uses **UI Automation** (`IUIAutomation` COM API) to read the address bar URL from the foreground browser window. Browser-specific strategies:

- **Firefox**: automation ID `"urlbar-input"`
- **Edge**: automation IDs `"view_1022"` then `"view_1020"`, then falls back to generic Chromium approach
- **Other Chromium** (Chrome, Brave, Opera, Vivaldi, Arc): control type `0xC36E` search (Children then Descendants), then `AccessKey="Ctrl+L"` with control type `0xC354`

COM is initialized per-call (`CoInitializeEx` / `CoUninitialize` with `COINIT_APARTMENTTHREADED`). Domain extraction strips protocol, port, path, and `www.` prefix.

### `windows` crate gotchas

- Version **0.62** with features: `Win32_Foundation`, `Win32_UI_WindowsAndMessaging`, `Win32_System_Threading`, `Win32_System_ProcessStatus`, `Win32_UI_Accessibility`, `Win32_System_Com`, **`Win32_System_Ole`** (required for `VARIANT` + `VariantToStringAlloc`), `Win32_System_Variant`
- `VARIANT` and `VariantToStringAlloc` are gated behind `Win32_System_Ole` in 0.62 — missing this feature causes compile errors
- Read URLs via `GetCurrentPropertyValue(UIA_ValueValuePropertyId)` + `VariantToStringAlloc`, not via `IUIAutomationValuePattern`

### System tray

- App hides to tray on close (via `on_window_event` + `api.prevent_close()`)
- Tray menu: "Show Kough" and "Quit"
- Requires `core:tray:default` and `core:window:allow-hide` in capabilities

### Schema (migration 3)

```
app_usage     (id PK, app_name, date, total_secs)    UNIQUE(app_name, date)
browser_usage (id PK, domain,   date, total_secs)    UNIQUE(domain, date)
```

Old `activity_sessions` data is migrated and table dropped. Kanban tables (`boards`, `columns`, `tasks`, `tags`, `task_tags`) are never touched by activity migrations.

## Markdown editor (CodeMirror 6)

Task descriptions use **CodeMirror 6** with an Obsidian-style **live preview** mode.

- **`src/components/task/DescriptionEditor.tsx`** — React wrapper: creates/destroys `EditorView`, debounced 500ms auto-save to backend, content sync from external changes
- **`src/components/task/livePreview.ts`** — custom `ViewPlugin` decoration layer. On non-active lines, hides markdown syntax markers (`#`, `**`, `*`, backticks, `>`, `~~`, `---`) and applies visual styling (bigger headings, bold, italic, code). On the active line (where cursor is), raw markdown is shown as-is
- **`src/components/task/codemirrorTheme.ts`** — custom dark theme matching existing oklch color palette
- **Task checkboxes** (`- [x]` / `- [ ]`): detected via line-level regex post-pass (not tree-based — lezer doesn't parse `[ ]` as a node). Rendered as clickable checkboxes; clicking toggles `[x]` ↔ `[ ]` in the document
- **CSS**: live preview styling lives in `src/index.css` under `.cm-lp-*` classes
- **Data format**: stored as raw markdown in `description_md` column (SQLite TEXT). CodeMirror reads/writes plain text — no HTML conversion anywhere

### Key dependencies

- `codemirror` (bundles `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`)
- `@codemirror/lang-markdown` (lezer-based markdown parser)
- `@codemirror/language-data` (language modes for fenced code blocks)
