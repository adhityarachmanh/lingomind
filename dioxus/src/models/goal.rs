use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserLanguageGoal {
    pub language: String,
    pub goal: String,
}
