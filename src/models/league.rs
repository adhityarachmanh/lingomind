use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LeagueMember {
    pub email: String,
    pub full_name: String,
    pub league_score: i32,
    pub rank: i32,
    pub division: String,
    pub status_zone: String, // "promosi", "aman", "degradasi"
    pub active_frame: Option<String>,
    pub active_title: Option<String>,
    pub active_name_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WeeklyLeagueData {
    pub division: String,
    pub members: Vec<LeagueMember>,
    pub days_left: i32,
}
