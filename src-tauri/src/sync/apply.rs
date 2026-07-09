use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;

const SYNC_TABLES: &[&str] = &["boards", "columns", "tasks", "tags", "task_tags"];

#[derive(Debug, Serialize)]
pub struct FailedRow {
    pub table: String,
    pub id: Option<String>,
    pub error: String,
}

#[derive(Debug, Serialize)]
pub struct ApplyResult {
    pub applied: u32,
    pub failed: Vec<FailedRow>,
}

pub fn apply_changes(
    conn: &mut Connection,
    changes: &HashMap<String, Vec<serde_json::Value>>,
) -> Result<ApplyResult, String> {
    let mut applied = 0u32;
    let mut failed: Vec<FailedRow> = Vec::new();

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    for table in SYNC_TABLES {
        let rows = match changes.get(*table) {
            Some(r) => r,
            None => continue,
        };

        for (idx, row) in rows.iter().enumerate() {
            let sp_name = format!("sp_{}_{}", table, idx);

            if let Err(e) = tx.execute(&format!("SAVEPOINT {}", sp_name), []) {
                failed.push(FailedRow {
                    table: table.to_string(),
                    id: extract_id(row),
                    error: format!("Savepoint failed: {}", e),
                });
                continue;
            }

            match apply_row(&tx, table, row) {
                Ok(_) => match tx.execute(&format!("RELEASE {}", sp_name), []) {
                    Ok(_) => applied += 1,
                    Err(e) => failed.push(FailedRow {
                        table: table.to_string(),
                        id: extract_id(row),
                        error: format!("Release savepoint failed: {}", e),
                    }),
                },
                Err(e) => {
                    let _ = tx.execute(&format!("ROLLBACK TO {}", sp_name), []);
                    let _ = tx.execute(&format!("RELEASE {}", sp_name), []);
                    failed.push(FailedRow {
                        table: table.to_string(),
                        id: extract_id(row),
                        error: e,
                    });
                }
            }
        }
    }

    if let Err(e) = tx.execute("DELETE FROM task_tags WHERE deleted_at IS NOT NULL", []) {
        failed.push(FailedRow {
            table: "task_tags".to_string(),
            id: None,
            error: format!("Cleanup failed: {}", e),
        });
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit: {}", e))?;

    Ok(ApplyResult { applied, failed })
}

fn apply_row(
    conn: &Connection,
    table: &str,
    row: &serde_json::Value,
) -> Result<(), String> {
    let obj = row
        .as_object()
        .ok_or_else(|| "Row is not an object".to_string())?;

    let columns: Vec<&str> = obj.keys().map(|s| s.as_str()).collect();
    let placeholders: Vec<String> = (0..columns.len()).map(|i| format!("?{}", i + 1)).collect();

    let update_clauses: Vec<String> = columns
        .iter()
        .filter(|&&c| c != "id" && c != "task_id" && c != "tag_id")
        .map(|c| format!("{} = excluded.{}", c, c))
        .collect();

    let sql = if table == "task_tags" {
        format!(
            "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT(task_id, tag_id) DO UPDATE SET {} WHERE excluded.updated_at >= {}.updated_at OR {}.updated_at IS NULL",
            table,
            columns.join(", "),
            placeholders.join(", "),
            update_clauses.join(", "),
            table,
            table
        )
    } else {
        format!(
            "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT(id) DO UPDATE SET {} WHERE excluded.updated_at >= {}.updated_at OR {}.updated_at IS NULL",
            table,
            columns.join(", "),
            placeholders.join(", "),
            update_clauses.join(", "),
            table,
            table
        )
    };

    let values: Vec<rusqlite::types::Value> = columns
        .iter()
        .map(|&c| {
            let v = obj.get(c).unwrap_or(&serde_json::Value::Null);
            match v {
                serde_json::Value::Null => rusqlite::types::Value::Null,
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        rusqlite::types::Value::Integer(i)
                    } else if let Some(f) = n.as_f64() {
                        rusqlite::types::Value::Real(f)
                    } else {
                        rusqlite::types::Value::Null
                    }
                }
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                _ => rusqlite::types::Value::Text(v.to_string()),
            }
        })
        .collect();

    conn.execute(&sql, rusqlite::params_from_iter(values.iter()))
        .map_err(|e| format!("SQL error: {}", e))?;

    Ok(())
}

fn extract_id(row: &serde_json::Value) -> Option<String> {
    row.as_object()
        .and_then(|obj| obj.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}
