use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DailyMission {
    pub language: String,
    pub lesson_target: i32,
    pub quiz_target: i32,
    pub weakness_target: i32,
    pub flashcard_target: i32,
    pub lesson_progress: i32,
    pub quiz_progress: i32,
    pub weakness_progress: i32,
    pub flashcard_progress: i32,
    pub is_completed: bool,
    pub reward_claimed: bool,
}
