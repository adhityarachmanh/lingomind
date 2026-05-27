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
    pub active_frame: Option<String>,
    pub active_title: Option<String>,
    pub active_name_color: Option<String>,
}

use crate::models::league::WeeklyLeagueData;
use crate::models::social::SocialUser;

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct LeaderboardSummary {
    pub weekly_league: Option<WeeklyLeagueData>,
    pub global: Vec<LeaderboardEntry>,
    pub following: Vec<SocialUser>,
}
