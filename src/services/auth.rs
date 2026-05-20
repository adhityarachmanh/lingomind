// src/services/auth.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::models::constants::LANGUAGE_COURSES; // Import konstanta global dinamis
use std::collections::HashMap;

// Mengurung import sqlx dan penunjang server agar tidak dibaca oleh frontend WASM
#[cfg(not(target_arch = "wasm32"))]
use sqlx::Row;

/// Helper lokal server untuk membangun nilai level awal secara dinamis dari constants
#[cfg(not(target_arch = "wasm32"))]
fn generate_default_levels() -> HashMap<String, String> {
    let mut default_map = HashMap::new();
    // Melakukan iterasi langsung dari konstanta global daftar kursus bahasa
    for course in LANGUAGE_COURSES {
        default_map.insert(course.id.to_string(), "A1".to_string());
    }
    default_map
}

/// Fungsi Server untuk Mendaftarkan Pengguna Baru
#[server(RegisterUser)]
pub async fn register_user(username: String, password_plain: String) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();

    if username.trim().is_empty() || password_plain.len() < 6 {
        return Err(ServerFnError::new("Username tidak boleh kosong dan password minimal 6 karakter."));
    }

    let hashed_password = match bcrypt::hash(&password_plain, bcrypt::DEFAULT_COST) {
        Ok(h) => h,
        Err(_) => return Err(ServerFnError::new("Gagal memproses keamanan password.")),
    };

    // Buat objek default level secara dinamis dan serahkan ke query berupa Value JSON
    let default_levels = generate_default_levels();
    let levels_json = serde_json::to_value(&default_levels).unwrap_or_default();

    let result = sqlx::query(
        "INSERT INTO users (username, password_hash, score, current_level) VALUES ($1, $2, 0, $3) RETURNING username, score, current_level"
    )
    .bind(username.trim())
    .bind(hashed_password)
    .bind(levels_json)
    .fetch_one(pool)
    .await;

    let row = match result {
        Ok(r) => r,
        Err(sqlx::Error::Database(db_err)) if db_err.is_unique_violation() => {
            return Err(ServerFnError::new("Username sudah digunakan, silakan pilih nama lain."));
        }
        Err(e) => return Err(ServerFnError::new(format!("Database error: {}", e))),
    };

    // Ekstraksi nilai JSONB dari PostgreSQL kembali menjadi HashMap Rust
    let raw_level: serde_json::Value = row.get("current_level");
    let current_level_map: HashMap<String, String> = serde_json::from_value(raw_level)
        .unwrap_or_else(|_| default_levels);

    Ok(UserProfile {
        username: row.get("username"),
        score: row.get::<Option<i32>, _>("score").unwrap_or(0),
        current_level: current_level_map,
    })
}

/// Fungsi Server untuk Masuk Log (Login) Kontrol Password
#[server(LoginUser)]
pub async fn login_user(username: String, password_plain: String) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();

    let row = sqlx::query("SELECT username, password_hash, score, current_level FROM users WHERE username = $1")
        .bind(username.trim())
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal mengambil data user: {}", e)))?;

    let user_record = match row {
        Some(u) => u,
        None => return Err(ServerFnError::new("Username atau password salah.")),
    };

    let db_password_hash: String = user_record.get("password_hash");
    let is_password_match = match bcrypt::verify(&password_plain, &db_password_hash) {
        Ok(matched) => matched,
        Err(_) => false,
    };

    if !is_password_match {
        return Err(ServerFnError::new("Username atau password salah."));
    }

    // Ekstraksi nilai JSONB ke HashMap, fallback ke dinamis generator jika kosong
    let raw_level: serde_json::Value = user_record.get("current_level");
    let current_level_map: HashMap<String, String> = serde_json::from_value(raw_level)
        .unwrap_or_else(|_| generate_default_levels());

    Ok(UserProfile {
        username: user_record.get("username"),
        score: user_record.get::<Option<i32>, _>("score").unwrap_or(0),
        current_level: current_level_map,
    })
}

/// Fungsi Server untuk Memperbarui Skor & Evaluasi Naik Level Spesifik per Bahasa setelah Kuis Selesai
#[server(UpdateUserScore)]
pub async fn update_user_score(username: String, language: String, score_delta: i32) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();

    // 1. Ambil data skor global dan map level saat ini dari database
    let row = sqlx::query("SELECT score, current_level FROM users WHERE username = $1")
        .bind(&username)
        .fetch_one(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal mengambil data user: {}", e)))?;

    let final_score = row.get::<Option<i32>, _>("score").unwrap_or(0) + score_delta;
    let raw_level: serde_json::Value = row.get("current_level");
    let mut level_map: HashMap<String, String> = serde_json::from_value(raw_level)
        .unwrap_or_else(|_| generate_default_levels());

    // 2. Evaluasi level baru HANYA untuk kunci bahasa yang sedang dikerjakan kuisnya
    let current_lang_level = level_map.get(&language).cloned().unwrap_or_else(|| "A1".to_string());
    let mut calculated_level = current_lang_level;

    if final_score >= 300 {
        calculated_level = "B1".to_string();
    } else if final_score >= 100 {
        calculated_level = "A2".to_string();
    } else {
        calculated_level = "A1".to_string();
    }

    // Perbarui entri map bahasa spesifik tersebut
    level_map.insert(language, calculated_level);
    let updated_levels_json = serde_json::to_value(&level_map).unwrap_or_default();

    // 3. Update database secara atomik untuk akumulasi score dan struktur JSONB yang baru
    let update_row = sqlx::query(
        "UPDATE users SET score = score + $1, current_level = $2 WHERE username = $3 RETURNING username, score"
    )
    .bind(score_delta)
    .bind(updated_levels_json)
    .bind(username)
    .fetch_one(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal memperbarui nilai database: {}", e)))?;

    Ok(UserProfile {
        username: update_row.get("username"),
        score: final_score,
        current_level: level_map,
    })
}