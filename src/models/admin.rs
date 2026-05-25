use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AppConfigItem {
    pub key: String,
    pub value: String,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct MissionConfigItem {
    pub id: i32,
    pub name: String,
    pub lesson_target: i32,
    pub quiz_target: i32,
    pub weakness_target: i32,
    pub flashcard_target_min: i32,
    pub flashcard_target_max: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ShopItemAdmin {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub cost: i32,
    pub effect_type: String,
    pub icon_name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct LanguageAdmin {
    pub id: String,
    pub name: String,
    pub native_name: String,
    pub flag: String,
    pub description: String,
    pub theme_class: String,
    pub button_class: String,
    pub category: String,
    pub tts_lang_code: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct LevelAdminItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub base_reward_points: i32,
    pub order_index: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct TopicAdminItem {
    pub id: i32,
    pub level_id: String,
    pub title: String,
    pub order_index: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct UserAdminItem {
    pub email: String,
    pub full_name: String,
    pub role: String,
    pub coins: i32,
    pub streak_days: i32,
    pub is_verified: bool,
    pub score: i32,
}
