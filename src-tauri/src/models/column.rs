use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Column {
    pub id: String,
    pub board_id: String,
    pub title: String,
    pub position: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateColumnInput {
    pub board_id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReorderColumnsInput {
    pub column_id: String,
    pub new_position: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateColumnInput {
    pub id: String,
    pub title: String,
}
