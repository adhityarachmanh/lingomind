use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Flashcard {
    pub id: i32,
    pub email: String,
    pub language: String,
    pub front_text: String,
    pub back_text: String,
    pub ease_factor: f64,
    pub interval_days: i32,
    pub repetition: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NewFlashcard {
    pub language: String,
    pub front_text: String,
    pub back_text: String,
}
