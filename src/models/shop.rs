use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShopItem {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub cost: i32,
    pub effect_type: String,
    pub icon_name: Option<String>,
    pub is_owned: bool,
}

use crate::models::engagement::UserEngagementStats;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShopSummary {
    pub items: Vec<ShopItem>,
    pub engagement: Option<UserEngagementStats>,
}
