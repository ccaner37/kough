# AGENTS.md — Kough

Kanban-style desktop app built with **Tauri v2** (Rust backend + React frontend).

## Commands

- `npm run tauri dev` — full desktop app with hot reload (not just `npm run dev`, which only starts Vite)
- `npm run build` — frontend only (`tsc && vite build`)
- `npm run tauri build` — production desktop bundle (frontend + Rust)
- No test runner, linter, or formatter is configured

## Architecture

```
src/                  # React frontend (Vite entry at src/main.tsx)
  components/         # board/, layout/, tags/, task/, ui/ (shadcn)
  stores/             # Zustand stores (boardStore, taskStore, tagStore, uiStore)
  lib/invoke.ts       # typed wrapper around Tauri invoke — all backend calls go here
  types/index.ts      # shared TS types mirroring Rust models
src-tauri/            # Rust backend
  src/commands/       # Tauri command handlers (board, column, task, tag)
  src/db/             # SQLite init, migrations, repository layer
  src/models/         # Rust structs (Board, Column, Task, Tag)
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

## Backend gotchas

- **Database**: SQLite stored in Tauri's app data dir (`kough.db`), opened with WAL mode and foreign keys ON
- **Migrations**: defined inline in `src-tauri/src/db/migrations.rs` — schema changes go there as new entries in the `MIGRATIONS` array
- **IDs**: UUID v7 generated on the Rust side (crate `uuid` with `v7` feature)
- **Error handling**: `AppError` has a manual `Serialize` impl — adding variants requires updating the match in `error.rs`
- **Lib name**: Cargo lib is named `kough_lib` (not `kough`) to avoid Windows naming conflict; don't rename it
- `src-tauri/src/main.rs` has `windows_subsystem = "windows"` for release builds — do not remove
