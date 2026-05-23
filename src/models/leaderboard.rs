// src/models/leaderboard.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub full_name: String,
    pub score: i32,
    pub current_streak: i32,
    pub total_quiz_completed: i32,
}
