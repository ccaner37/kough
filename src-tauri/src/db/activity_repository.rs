use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::activity::*;

pub fn upsert_app_usage(conn: &Connection, app_name: &str, date: &str, secs: i64) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO app_usage (id, app_name, date, total_secs) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(app_name, date) DO UPDATE SET total_secs = total_secs + ?4",
        params![Uuid::now_v7().to_string(), app_name, date, secs],
    )?;
    Ok(())
}

pub fn upsert_browser_usage(conn: &Connection, domain: &str, date: &str, secs: i64) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO browser_usage (id, domain, date, total_secs) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(domain, date) DO UPDATE SET total_secs = total_secs + ?4",
        params![Uuid::now_v7().to_string(), domain, date, secs],
    )?;
    Ok(())
}

pub fn get_app_usage_summary(conn: &Connection, start_date: &str, end_date: &str) -> Result<Vec<AppUsageSummary>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT app_name, SUM(total_secs) as total_secs
         FROM app_usage
         WHERE date >= ?1 AND date < ?2
         GROUP BY app_name
         ORDER BY total_secs DESC",
    )?;
    let summaries = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok(AppUsageSummary {
                app_name: row.get(0)?,
                total_secs: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(summaries)
}

pub fn get_browser_usage_summary(conn: &Connection, start_date: &str, end_date: &str) -> Result<Vec<BrowserUsageSummary>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT domain, SUM(total_secs) as total_secs
         FROM browser_usage
         WHERE date >= ?1 AND date < ?2
         GROUP BY domain
         ORDER BY total_secs DESC",
    )?;
    let summaries = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok(BrowserUsageSummary {
                domain: row.get(0)?,
                total_secs: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(summaries)
}
