// src/models/constants.rs
use serde::{Deserialize, Serialize};

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct LanguageCourse {
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

pub const COURSE_CATEGORIES: &[&str] = &["All", "Eropa", "Amerika", "Asia", "Timur Tengah"];

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct CurriculumLevel {
    pub level: String,
    pub title: String,
    pub description: String,
    pub base_reward_points: i32,
    pub topics: Vec<String>,
}
