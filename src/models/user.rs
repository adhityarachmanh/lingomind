// src/models/user.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct UserProfile {
    pub email: String,
    pub full_name: String,
    pub preferred_language: String,
    pub score: i32,
    // Menggunakan HashMap -> {"English": "A2", "German": "A1"}
    pub current_level: HashMap<String, String>,
    pub role: String,
}

impl UserProfile {
    /// Helper untuk mengambil level mentah (bisa berupa "A1" atau "A1.2")
    pub fn get_language_level(&self, language: &str) -> String {
        self.current_level
            .get(language)
            .cloned()
            .unwrap_or_else(|| "A1.0".to_string())
    }

    /// Helper untuk mengambil level dasar (tanpa titik, misal "A1")
    pub fn base_level(&self, language: &str) -> String {
        let level = self.get_language_level(language);
        if let Some(idx) = level.find('.') {
            level[..idx].to_string()
        } else {
            level
        }
    }

    /// Helper untuk mengambil indeks topik yang terbuka di level saat ini
    pub fn topic_index(&self, language: &str) -> usize {
        let level = self.get_language_level(language);
        if let Some(idx) = level.find('.') {
            level[idx + 1..].parse::<usize>().unwrap_or(0)
        } else {
            0
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PublicProfile {
    pub email: String,
    pub full_name: String,
    pub score: i32,
    pub current_streak: i32,
    pub longest_streak: i32,
    pub active_frame: Option<String>,
    pub joined_date: String,
    pub badges: Vec<crate::models::badge::Badge>,
}
