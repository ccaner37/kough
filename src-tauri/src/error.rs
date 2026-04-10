use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Validation error: {0}")]
    Validation(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field(
            "kind",
            match self {
                AppError::Database(_) => "database",
                AppError::NotFound(_) => "not_found",
                AppError::Serialization(_) => "serialization",
                AppError::Validation(_) => "validation",
            },
        )?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}
