use crate::error::AppError;
use rusqlite::Connection;

const MIGRATIONS: &[&str] = &["
CREATE TABLE IF NOT EXISTS boards (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS columns (
    id          TEXT PRIMARY KEY,
    board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    position    REAL NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    column_id       TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description_md  TEXT NOT NULL DEFAULT '',
    position        REAL NOT NULL,
    priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK(priority IN ('low','medium','high','critical')),
    due_date        TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
    id          TEXT PRIMARY KEY,
    board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#6b7280'
);

CREATE TABLE IF NOT EXISTS task_tags (
    task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_columns_board ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tags_board ON tags(board_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);
"];

pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    for (i, sql) in MIGRATIONS.iter().enumerate() {
        conn.execute_batch(sql).map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(format!(
                "Migration {} failed: {}",
                i, e
            )))
        })?;
    }
    Ok(())
}
