use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppUsageSummary {
    pub app_name: String,
    pub total_secs: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserUsageSummary {
    pub domain: String,
    pub total_secs: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveTracking {
    pub app_name: String,
    pub domain: Option<String>,
}
