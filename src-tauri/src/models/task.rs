use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub column_id: String,
    pub title: String,
    pub description_md: String,
    pub position: f64,
    pub priority: String,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskInput {
    pub column_id: String,
    pub title: String,
    pub description_md: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTaskInput {
    pub id: String,
    pub title: Option<String>,
    pub description_md: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveTaskInput {
    pub task_id: String,
    pub target_column_id: String,
    pub new_position: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReorderTaskInput {
    pub task_id: String,
    pub new_position: f64,
}
