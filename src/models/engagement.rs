use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserEngagementStats {
    pub current_streak: i32,
    pub longest_streak: i32,
    pub total_quiz_completed: i32,
    pub total_points_earned: i32,
}
