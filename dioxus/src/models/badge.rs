use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Badge {
    pub id: i32,
    pub name: String,
    pub description: String,
    pub icon_name: String,
    pub requirement_type: String,
    pub requirement_value: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserBadge {
    pub email: String,
    pub badge_id: i32,
    pub earned_at: String, // String ISO8601
}
