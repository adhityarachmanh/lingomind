// src/models/leaderboard.rs
use serde::{Deserialize, Serialize};

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub email: String,
    pub full_name: String,
    pub score: i32,
    pub current_streak: i32,
    pub total_quiz_completed: i32,
}
