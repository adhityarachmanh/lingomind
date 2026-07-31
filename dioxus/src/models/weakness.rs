use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WeaknessItem {
    pub topic: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WeaknessAnalyticsItem {
    pub topic: String,
    pub count_7d: i64,
    pub count_30d: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SkillProgressPoint {
    pub day: String,
    pub grammar: i64,
    pub vocabulary: i64,
    pub listening: i64,
}
