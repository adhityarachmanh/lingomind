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

fn is_valid_email(email: &str) -> bool {
    let trimmed = email.trim();
    let mut parts = trimmed.split('@');
    let local = parts.next().unwrap_or_default();
    let domain = parts.next().unwrap_or_default();
    local.len() >= 1 && domain.contains('.') && parts.next().is_none()
}

/// Fungsi Server untuk Mendaftarkan Pengguna Baru
#[server(RegisterUser)]
pub async fn register_user(full_name: String, email: String, password_plain: String) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();

    if full_name.trim().is_empty() || email.trim().is_empty() || password_plain.len() < 6 {
        return Err(ServerFnError::new("Nama lengkap, email wajib diisi dan password minimal 6 karakter."));
    }
    if !is_valid_email(&email) {
        return Err(ServerFnError::new("Format email tidak valid."));
    }

    let hashed_password = match bcrypt::hash(&password_plain, bcrypt::DEFAULT_COST) {
        Ok(h) => h,
        Err(_) => return Err(ServerFnError::new("Gagal memproses keamanan password.")),
    };

    // Buat objek default level secara dinamis dan serahkan ke query berupa Value JSON
    let default_levels = generate_default_levels();
    let levels_json = serde_json::to_value(&default_levels).unwrap_or_default();

    let result = sqlx::query(
        "INSERT INTO users (full_name, email, password_hash, score, current_level) VALUES ($1, $2, $3, 0, $4) RETURNING full_name, email, score, current_level"
    )
    .bind(full_name.trim())
    .bind(email.trim())
    .bind(hashed_password)
    .bind(levels_json)
    .fetch_one(pool)
    .await;

    let row = match result {
        Ok(r) => r,
        Err(sqlx::Error::Database(db_err)) if db_err.is_unique_violation() => {
            return Err(ServerFnError::new("Email sudah digunakan, silakan gunakan email lain."));
        }
        Err(e) => return Err(ServerFnError::new(format!("Database error: {}", e))),
    };

    // Ekstraksi nilai JSONB dari PostgreSQL kembali menjadi HashMap Rust
    let raw_level: serde_json::Value = row.get("current_level");
    let current_level_map: HashMap<String, String> = serde_json::from_value(raw_level)
        .unwrap_or_else(|_| default_levels);

    Ok(UserProfile {
        full_name: row.get("full_name"),
        email: row.get("email"),
        score: row.get::<Option<i32>, _>("score").unwrap_or(0),
        current_level: current_level_map,
    })
}

/// Fungsi Server untuk Masuk Log (Login) Kontrol Password
#[server(LoginUser)]
pub async fn login_user(email: String, password_plain: String) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();
    if !is_valid_email(&email) {
        return Err(ServerFnError::new("Format email tidak valid."));
    }

    let row = sqlx::query("SELECT full_name, email, password_hash, score, current_level FROM users WHERE email = $1")
        .bind(email.trim())
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal mengambil data user: {}", e)))?;

    let user_record = match row {
        Some(u) => u,
        None => return Err(ServerFnError::new("Email atau password salah.")),
    };

    let db_password_hash: String = user_record.get("password_hash");
    let is_password_match = match bcrypt::verify(&password_plain, &db_password_hash) {
        Ok(matched) => matched,
        Err(_) => false,
    };

    if !is_password_match {
        return Err(ServerFnError::new("Email atau password salah."));
    }

    // Ekstraksi nilai JSONB ke HashMap, fallback ke dinamis generator jika kosong
    let raw_level: serde_json::Value = user_record.get("current_level");
    let current_level_map: HashMap<String, String> = serde_json::from_value(raw_level)
        .unwrap_or_else(|_| generate_default_levels());

    Ok(UserProfile {
        full_name: user_record.get("full_name"),
        email: user_record.get("email"),
        score: user_record.get::<Option<i32>, _>("score").unwrap_or(0),
        current_level: current_level_map,
    })
}

/// Fungsi Server untuk Memperbarui Skor & Evaluasi Naik Level Spesifik per Bahasa setelah Kuis Selesai
#[server(UpdateUserScore)]
pub async fn update_user_score(email: String, language: String, score_delta: i32) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();

    // 1. Ambil data skor global dan map level saat ini dari database
    let row = sqlx::query("SELECT score, current_level FROM users WHERE email = $1")
        .bind(&email)
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
        "UPDATE users SET score = score + $1, current_level = $2 WHERE email = $3 RETURNING full_name, email, score"
    )
    .bind(score_delta)
    .bind(updated_levels_json)
    .bind(email)
    .fetch_one(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal memperbarui nilai database: {}", e)))?;

    Ok(UserProfile {
        full_name: update_row.get("full_name"),
        email: update_row.get("email"),
        score: final_score,
        current_level: level_map,
    })
}
