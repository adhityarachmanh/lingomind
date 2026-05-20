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
}

impl UserProfile {
    /// Helper untuk mengambil level bahasa tertentu, jika belum ada otomatis beri "A1"
    pub fn get_language_level(&self, language: &str) -> String {
        self.current_level
            .get(language)
            .cloned()
            .unwrap_or_else(|| "A1".to_string())
    }
}
