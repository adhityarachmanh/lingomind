use dioxus::prelude::*;
use crate::models::user::UserProfile;

#[cfg(feature = "server")]
use crate::models::constants::LANGUAGE_COURSES;
#[cfg(feature = "server")]
use std::collections::HashMap;

#[cfg(feature = "server")]
use sqlx::Row;
#[cfg(feature = "server")]
use lettre::{
    transport::smtp::authentication::Credentials,
    Message, SmtpTransport, Transport,
};

#[cfg(feature = "server")]
fn generate_default_levels() -> HashMap<String, String> {
    let mut default_map = HashMap::new();
    for course in LANGUAGE_COURSES {
        default_map.insert(course.id.to_string(), "A1".to_string());
    }
    default_map
}

#[cfg(feature = "server")]
fn is_valid_email(email: &str) -> bool {
    let trimmed = email.trim();
    let mut parts = trimmed.split('@');
    let local = parts.next().unwrap_or_default();
    let domain = parts.next().unwrap_or_default();
    local.len() >= 1 && domain.contains('.') && parts.next().is_none()
}

/// Fungsi Server untuk Mendaftarkan Pengguna Baru
#[server]
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
        "INSERT INTO users (full_name, email, password_hash, preferred_language, score, current_level) VALUES ($1, $2, $3, $4, 0, $5) RETURNING full_name, email, preferred_language, score, current_level"
    )
    .bind(full_name.trim())
    .bind(email.trim())
    .bind(hashed_password)
    .bind("English")
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
        preferred_language: row.get("preferred_language"),
        score: row.get::<Option<i32>, _>("score").unwrap_or(0),
        current_level: current_level_map,
    })
}

/// Fungsi Server untuk Masuk Log (Login) Kontrol Password
#[server]
pub async fn login_user(email: String, password_plain: String) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();
    if !is_valid_email(&email) {
        return Err(ServerFnError::new("Format email tidak valid."));
    }

    let row = sqlx::query("SELECT full_name, email, password_hash, preferred_language, score, current_level FROM users WHERE email = $1")
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
        preferred_language: user_record.get("preferred_language"),
        score: user_record.get::<Option<i32>, _>("score").unwrap_or(0),
        current_level: current_level_map,
    })
}

/// Fungsi Server untuk Memperbarui Skor & Evaluasi Naik Level Spesifik per Bahasa setelah Kuis Selesai
#[server]
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

    let current_user_level_for_lang = level_map.get(&language).cloned().unwrap_or_else(|| "A1".to_string());

    // Mastery Flow: Level naik jika user mendapat nilai sempurna di kuis saat ini (5/5 benar = 100 poin).
    // Ini memisahkan XP global dengan proficiency bahasa, mencegah bug lintas bahasa.
    let mut calculated_level = current_user_level_for_lang.clone();
    if score_delta >= 100 {
        calculated_level = match current_user_level_for_lang.as_str() {
            "A1" => "A2".to_string(),
            "A2" => "B1".to_string(),
            "B1" => "B2".to_string(),
            "B2" => "C1".to_string(),
            "C1" => "C2".to_string(),
            _ => current_user_level_for_lang,
        };
    }

    // Perbarui entri map bahasa spesifik tersebut
    level_map.insert(language, calculated_level);
    let updated_levels_json = serde_json::to_value(&level_map).unwrap_or_default();

    // 3. Update database secara atomik untuk akumulasi score dan struktur JSONB yang baru
    let update_row = sqlx::query(
        "UPDATE users SET score = score + $1, current_level = $2 WHERE email = $3 RETURNING full_name, email, preferred_language, score"
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
        preferred_language: update_row.get("preferred_language"),
        score: final_score,
        current_level: level_map,
    })
}

#[server]
pub async fn update_preferred_language_server(email: String, preferred_language: String) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();
    let canonical_lang = LANGUAGE_COURSES
        .iter()
        .find(|course| course.id.eq_ignore_ascii_case(preferred_language.trim()))
        .map(|course| course.id.to_string());
    let Some(trimmed_lang) = canonical_lang else {
        return Err(ServerFnError::new("Bahasa tidak valid."));
    };

    let row = sqlx::query(
        "UPDATE users SET preferred_language = $1 WHERE email = $2 RETURNING full_name, email, preferred_language, score, current_level"
    )
    .bind(&trimmed_lang)
    .bind(email.trim())
    .fetch_one(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal memperbarui bahasa aktif: {}", e)))?;

    let raw_level: serde_json::Value = row.get("current_level");
    let current_level_map: HashMap<String, String> = serde_json::from_value(raw_level)
        .unwrap_or_else(|_| generate_default_levels());

    Ok(UserProfile {
        full_name: row.get("full_name"),
        email: row.get("email"),
        preferred_language: row.get("preferred_language"),
        score: row.get::<Option<i32>, _>("score").unwrap_or(0),
        current_level: current_level_map,
    })
}

#[server]
pub async fn send_reset_password_email(email: String) -> Result<String, ServerFnError> {
    let pool = super::db::get_pool();
    let email_trimmed = email.trim().to_string();

    // 1. Verify if user exists
    let user_exists = sqlx::query("SELECT email FROM users WHERE email = $1")
        .bind(&email_trimmed)
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Database error: {}", e)))?;

    if user_exists.is_none() {
        return Err(ServerFnError::new("Email tidak terdaftar di sistem kami."));
    }

    // 2. Generate a secure token
    let token = uuid::Uuid::new_v4().to_string();

    // 3. Save token in database
    // Delete any old resets for this email to keep it clean
    let _ = sqlx::query("DELETE FROM password_resets WHERE email = $1")
        .bind(&email_trimmed)
        .execute(pool)
        .await;

    sqlx::query(
        "INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')"
    )
    .bind(&email_trimmed)
    .bind(&token)
    .execute(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal membuat token reset: {}", e)))?;

    // 4. Send email
    // Check if SMTP configuration is set in .env
    let smtp_username = std::env::var("SMTP_USERNAME").unwrap_or_else(|_| "lingomindid@gmail.com".to_string());
    let smtp_password = std::env::var("SMTP_PASSWORD").ok(); // Gmail app password

    let app_url = std::env::var("APP_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());
    let reset_link = format!("{}/reset-password?token={}", app_url, token);
    
    let subject = "Reset Password - LingoMind";
    let body = format!(
        "Halo,\n\nKami menerima permintaan untuk mereset password akun LingoMind Anda.\n\n\
        Silakan klik link berikut untuk mereset password Anda (berlaku selama 1 jam):\n\
        {}\n\n\
        Jika Anda tidak merasa mengajukan ini, abaikan email ini.\n\n\
        Salam,\nLingoMind Team",
        reset_link
    );

    // If SMTP_PASSWORD is not provided, print to server console and return success
    if let Some(pwd) = smtp_password {
        let email_msg = Message::builder()
            .from(format!("LingoMind <{}>", smtp_username).parse().unwrap())
            .to(email_trimmed.parse().unwrap())
            .subject(subject)
            .body(body)
            .map_err(|e| ServerFnError::new(format!("Gagal menyusun email: {}", e)))?;

        let creds = Credentials::new(smtp_username.clone(), pwd);
        let mailer = SmtpTransport::relay("smtp.gmail.com")
            .unwrap()
            .credentials(creds)
            .port(587)
            .build();

        let mailer_clone = mailer.clone();
        let email_msg_clone = email_msg.clone();
        let send_res = tokio::task::spawn_blocking(move || {
            mailer_clone.send(&email_msg_clone)
        }).await;

        match send_res {
            Ok(Ok(_)) => {
                println!("====== EMAIL RESET SENT TO {} (via SMTP) ======", email_trimmed);
            }
            _ => {
                println!("====== SMTP SEND FAILED! ======");
                println!("====== RESET LINK FOR {}: {} ======", email_trimmed, reset_link);
            }
        }
    } else {
        println!("====== SMTP NOT CONFIGURRED IN .env ======");
        println!("====== RESET LINK FOR {}: {} ======", email_trimmed, reset_link);
    }

    Ok("Instruksi reset password telah dikirim. Periksa email Anda (atau server console untuk testing).".to_string())
}

#[server]
pub async fn reset_password_server(token: String, new_password_plain: String) -> Result<String, ServerFnError> {
    let pool = super::db::get_pool();

    if new_password_plain.len() < 6 {
        return Err(ServerFnError::new("Password baru minimal harus berukuran 6 karakter."));
    }

    // 1. Check if token is valid and not expired
    let row = sqlx::query("SELECT email FROM password_resets WHERE token = $1 AND expires_at > NOW()")
        .bind(&token)
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal memvalidasi token: {}", e)))?;

    let record = match row {
        Some(r) => r,
        None => return Err(ServerFnError::new("Token reset tidak valid atau sudah kedaluwarsa.")),
    };

    let email: String = record.get("email");

    // 2. Hash new password
    let hashed_password = match bcrypt::hash(&new_password_plain, bcrypt::DEFAULT_COST) {
        Ok(h) => h,
        Err(_) => return Err(ServerFnError::new("Gagal memproses keamanan password.")),
    };

    // 3. Update user password
    sqlx::query("UPDATE users SET password_hash = $1 WHERE email = $2")
        .bind(hashed_password)
        .bind(&email)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal memperbarui password user: {}", e)))?;

    // 4. Delete token to prevent reuse
    let _ = sqlx::query("DELETE FROM password_resets WHERE email = $1")
        .bind(&email)
        .execute(pool)
        .await;

    Ok("Password Anda berhasil direset! Silakan login dengan password baru Anda.".to_string())
}
