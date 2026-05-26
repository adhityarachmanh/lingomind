use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserEngagementStats {
    pub current_streak: i32,
    pub longest_streak: i32,
    pub total_quiz_completed: i32,
    pub total_points_earned: i32,
    pub coins: i32,
    pub streak_freezes: i32,
    pub previous_streak: i32,
    pub double_xp_until: Option<chrono::DateTime<chrono::Utc>>,
    pub exam_retake_tickets: i32,
}
