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
    
    // Tiered Missions
    pub correct_answers_today: i32,
    pub pvp_wins_today: i32,
    pub tier1_claimed: bool,
    pub tier2_claimed: bool,
    pub tier3_claimed: bool,
}
