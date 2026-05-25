use dioxus::prelude::*;
use crate::models::user::UserProfile;

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
fn is_valid_email(email: &str) -> bool {
    let trimmed = email.trim();
    let mut parts = trimmed.split('@');
    let local = parts.next().unwrap_or_default();
    let domain = parts.next().unwrap_or_default();
    local.len() >= 1 && domain.contains('.') && parts.next().is_none()
}

/// Fungsi Server untuk Mendaftarkan Pengguna Baru
#[server]
pub async fn register_user(full_name: String, email: String, password_plain: String) -> Result<String, ServerFnError> {
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

    let email_trimmed = email.trim().to_string();

    let result = sqlx::query(
        "INSERT INTO users (full_name, email, password_hash, preferred_language, score) VALUES ($1, $2, $3, $4, 0)"
    )
    .bind(full_name.trim())
    .bind(&email_trimmed)
    .bind(hashed_password)
    .bind("English")
    .execute(pool)
    .await;
    
    match result {
        Ok(_) => {},
        Err(sqlx::Error::Database(db_err)) if db_err.is_unique_violation() => {
            return Err(ServerFnError::new("Email sudah digunakan, silakan gunakan email lain."));
        }
        Err(e) => return Err(ServerFnError::new(format!("Database error: {}", e))),
    };

    // Generate Verification Token
    let token = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO email_verification_tokens (email, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')"
    )
    .bind(&email_trimmed)
    .bind(&token)
    .execute(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal membuat token verifikasi: {}", e)))?;

    // Send Verification Email
    let smtp_username = std::env::var("SMTP_USERNAME").unwrap_or_else(|_| "lingomindid@gmail.com".to_string());
    let smtp_password = std::env::var("SMTP_PASSWORD").ok();
    let app_url = std::env::var("APP_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());
    let verify_link = format!("{}/verify-email?token={}", app_url, token);
    
    let subject = "Verifikasi Akun - LingoMind";
    let body = format!(
        "Halo {},\n\nTerima kasih telah mendaftar di LingoMind!\n\n\
        Silakan klik link berikut untuk mengaktifkan akun Anda (berlaku 24 jam):\n\
        {}\n\n\
        Jika Anda tidak merasa mendaftar, abaikan email ini.\n\n\
        Salam,\nLingoMind Team",
        full_name.trim(), verify_link
    );

    if let Some(pwd) = smtp_password {
        let email_msg = Message::builder()
            .from(format!("LingoMind <{}>", smtp_username).parse().unwrap())
            .to(email_trimmed.parse().unwrap())
            .subject(subject)
            .body(body)
            .map_err(|e| ServerFnError::new(format!("Gagal menyusun email verifikasi: {}", e)))?;

        let creds = Credentials::new(smtp_username.clone(), pwd);
        let mailer = SmtpTransport::relay("smtp.gmail.com")
            .unwrap()
            .credentials(creds)
            .port(587)
            .build();

        let _ = tokio::task::spawn_blocking(move || mailer.send(&email_msg)).await;
    }

    Ok("Pendaftaran berhasil! Tautan verifikasi telah dikirim ke email Anda. Silakan periksa folder Inbox atau Spam.".to_string())
}

/// Fungsi Server untuk Masuk Log (Login) Kontrol Password
#[server]
pub async fn login_user(email: String, password_plain: String) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();
    if !is_valid_email(&email) {
        return Err(ServerFnError::new("Format email tidak valid."));
    }

    let row = sqlx::query("SELECT full_name, email, password_hash, preferred_language, score, is_verified, role FROM users WHERE email = $1")
        .bind(email.trim())
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

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

    let is_verified: bool = user_record.get("is_verified");
    if !is_verified {
        return Err(ServerFnError::new("UNVERIFIED:Akun Anda belum diverifikasi. Silakan cek email Anda."));
    }

    let levels_rows = sqlx::query("SELECT language_id, base_level, topic_idx FROM user_language_progress WHERE email = $1")
        .bind(email.trim())
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

    let mut current_level_map = HashMap::new();
    for l_row in levels_rows {
        let lang_id: String = l_row.get("language_id");
        let base_lvl: String = l_row.get("base_level");
        let t_idx: i32 = l_row.get("topic_idx");
        current_level_map.insert(lang_id, format!("{}.{}", base_lvl, t_idx));
    }

    Ok(UserProfile {
        full_name: user_record.get("full_name"),
        email: user_record.get("email"),
        preferred_language: user_record.get("preferred_language"),
        score: user_record.get::<i32, _>("score"),
        current_level: current_level_map,
        role: user_record.get::<String, _>("role"),
    })
}

/// Fungsi Server untuk Memperbarui Skor & Evaluasi Naik Level Spesifik per Bahasa setelah Kuis Selesai
#[server]
pub async fn update_user_score(email: String, language: String, score_delta: i32, played_topic: Option<String>) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();

    // 1. Ambil data skor global dari database
    let _ = sqlx::query("SELECT score FROM users WHERE email = $1")
        .bind(&email)
        .fetch_one(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("User tidak ditemukan: {}", e)))?;

    let levels_rows = sqlx::query("SELECT language_id, base_level, topic_idx FROM user_language_progress WHERE email = $1")
        .bind(&email)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

    let mut current_level = std::collections::HashMap::new();
    for l_row in levels_rows {
        let lang_id: String = l_row.get("language_id");
        let base_lvl: String = l_row.get("base_level");
        let t_idx: i32 = l_row.get("topic_idx");
        current_level.insert(lang_id, format!("{}.{}", base_lvl, t_idx));
    }

    let current_user_level_for_lang = current_level.get(&language).cloned().unwrap_or_else(|| "A1.0".to_string());

    // Memecah menjadi base_level dan topic_idx
    let (mut base_level, mut topic_idx) = if let Some(idx) = current_user_level_for_lang.find('.') {
        let base = current_user_level_for_lang[..idx].to_string();
        let topic = current_user_level_for_lang[idx + 1..].parse::<usize>().unwrap_or(0);
        (base, topic)
    } else {
        (current_user_level_for_lang.clone(), 0)
    };

    let topics_res = crate::services::curriculum::get_all_curriculum().await.unwrap_or_default();
    
    // Mastery Flow: Jika user mendapat nilai sempurna di kuis saat ini (5/5 benar).
    let pts_per_question = topics_res.iter().find(|c| c.level == base_level).map(|c| c.base_reward_points).unwrap_or(20);
    let required_score = pts_per_question * 5;

    // Cari tahu indeks topik yang sedang dimainkan
    let mut played_topic_idx = 999;
    if let Some(ref pt) = played_topic {
        let decoded_pt = urlencoding::decode(pt).unwrap_or(std::borrow::Cow::Borrowed(pt)).into_owned();
        if let Some(level_data) = topics_res.iter().find(|c| c.level == base_level) {
            if let Some(idx) = level_data.topics.iter().position(|t| *t == decoded_pt.as_str()) {
                played_topic_idx = idx;
            }
        }
    }

    // Insert the progress log (Marksflow)
    let passed = score_delta >= required_score && played_topic_idx == topic_idx;
    let topic_name = played_topic.clone().unwrap_or_else(|| "Unknown Topic".to_string());
    let _ = sqlx::query(
        "INSERT INTO user_progress_logs (email, language, activity_type, topic, score_gained, passed, base_level, topic_idx) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
    )
    .bind(&email)
    .bind(&language)
    .bind("quiz")
    .bind(&topic_name)
    .bind(score_delta)
    .bind(passed)
    .bind(&base_level)
    .bind(topic_idx as i32)
    .execute(pool)
    .await;

    let mut topics_in_level = 4;
    if let Some(level_data) = topics_res.iter().find(|c| c.level == base_level) {
        topics_in_level = level_data.topics.len();
    }

    // Hanya naikkan level jika user BENAR-BENAR memainkan topik maksimum yang sedang ter-unlock
    if passed && (topic_idx as usize) < topics_in_level {
        topic_idx += 1;
    }

    let _ = sqlx::query(
        "INSERT INTO user_language_progress (email, language_id, base_level, topic_idx) VALUES ($1, $2, $3, $4) ON CONFLICT (email, language_id) DO UPDATE SET base_level = EXCLUDED.base_level, topic_idx = EXCLUDED.topic_idx, updated_at = NOW()"
    )
    .bind(&email)
    .bind(&language)
    .bind(&base_level)
    .bind(topic_idx as i32)
    .execute(pool)
    .await
    .map_err(|e| ServerFnError::new(e.to_string()))?;

    let update_row = sqlx::query(
        "UPDATE users SET score = score + $1 WHERE email = $2 RETURNING full_name, email, preferred_language, score, role"
    )
    .bind(score_delta)
    .bind(&email)
    .fetch_one(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal memperbarui data user: {}", e)))?;

    let levels_rows = sqlx::query("SELECT language_id, base_level, topic_idx FROM user_language_progress WHERE email = $1")
        .bind(&email)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

    let mut final_level_map = std::collections::HashMap::new();
    for l_row in levels_rows {
        let lang_id: String = l_row.get("language_id");
        let base_lvl: String = l_row.get("base_level");
        let t_idx: i32 = l_row.get("topic_idx");
        final_level_map.insert(lang_id, format!("{}.{}", base_lvl, t_idx));
    }

    Ok(UserProfile {
        full_name: update_row.get("full_name"),
        email: update_row.get("email"),
        preferred_language: update_row.get("preferred_language"),
        score: update_row.get("score"),
        current_level: final_level_map,
        role: update_row.get("role"),
    })
}

#[server]
pub async fn update_preferred_language_server(email: String, preferred_language: String) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();
    let lang_check = sqlx::query("SELECT id FROM languages WHERE id ILIKE $1")
        .bind(preferred_language.trim())
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

    let Some(lang_row) = lang_check else {
        return Err(ServerFnError::new("Bahasa tidak valid."));
    };
    let trimmed_lang: String = lang_row.get("id");

    let row = sqlx::query(
        "UPDATE users SET preferred_language = $1 WHERE email = $2 RETURNING full_name, email, preferred_language, score, role"
    )
    .bind(&trimmed_lang)
    .bind(email.trim())
    .fetch_one(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal memperbarui bahasa aktif: {}", e)))?;

    let levels_rows = sqlx::query("SELECT language_id, base_level, topic_idx FROM user_language_progress WHERE email = $1")
        .bind(email.trim())
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

    let mut current_level_map = HashMap::new();
    for l_row in levels_rows {
        let lang_id: String = l_row.get("language_id");
        let base_lvl: String = l_row.get("base_level");
        let t_idx: i32 = l_row.get("topic_idx");
        current_level_map.insert(lang_id, format!("{}.{}", base_lvl, t_idx));
    }

    Ok(UserProfile {
        full_name: row.get("full_name"),
        email: row.get("email"),
        preferred_language: row.get("preferred_language"),
        score: row.get::<i32, _>("score"),
        current_level: current_level_map,
        role: row.get("role"),
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
        let mailer = lettre::AsyncSmtpTransport::<lettre::Tokio1Executor>::from_url("smtps://smtp.gmail.com")
            .unwrap()
            .credentials(creds)
            .build();

        use lettre::AsyncTransport;
        tokio::spawn(async move {
            match mailer.send(email_msg).await {
                Ok(_) => {
                    println!("====== EMAIL RESET SENT TO {} (via SMTP) ======", email_trimmed);
                }
                Err(e) => {
                    println!("====== SMTP SEND FAILED! Error: {} ======", e);
                    println!("====== RESET LINK FOR {}: {} ======", email_trimmed, reset_link);
                }
            }
        });
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

#[server]
pub async fn verify_email_server(token: String) -> Result<String, ServerFnError> {
    let pool = super::db::get_pool();

    let row = sqlx::query("SELECT email FROM email_verification_tokens WHERE token = $1 AND expires_at > NOW()")
        .bind(&token)
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal memvalidasi token: {}", e)))?;

    let record = match row {
        Some(r) => r,
        None => return Err(ServerFnError::new("Token verifikasi tidak valid atau sudah kedaluwarsa.")),
    };

    let email: String = record.get("email");

    sqlx::query("UPDATE users SET is_verified = true WHERE email = $1")
        .bind(&email)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal memverifikasi user: {}", e)))?;

    let _ = sqlx::query("DELETE FROM email_verification_tokens WHERE email = $1")
        .bind(&email)
        .execute(pool)
        .await;

    Ok("Akun Anda berhasil diverifikasi! Silakan login.".to_string())
}

#[server]
pub async fn resend_verification_email_server(email: String) -> Result<String, ServerFnError> {
    let pool = super::db::get_pool();
    let email_trimmed = email.trim().to_string();

    let user_row = sqlx::query("SELECT is_verified, full_name FROM users WHERE email = $1")
        .bind(&email_trimmed)
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Database error: {}", e)))?;

    let (is_verified, full_name) = match user_row {
        Some(r) => {
            let verified: bool = r.get("is_verified");
            let name: String = r.get("full_name");
            (verified, name)
        },
        None => return Err(ServerFnError::new("Email tidak terdaftar.")),
    };

    if is_verified {
        return Err(ServerFnError::new("Akun ini sudah diverifikasi."));
    }

    let token = uuid::Uuid::new_v4().to_string();
    let _ = sqlx::query("DELETE FROM email_verification_tokens WHERE email = $1")
        .bind(&email_trimmed)
        .execute(pool)
        .await;

    sqlx::query(
        "INSERT INTO email_verification_tokens (email, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')"
    )
    .bind(&email_trimmed)
    .bind(&token)
    .execute(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal membuat token: {}", e)))?;

    let smtp_username = std::env::var("SMTP_USERNAME").unwrap_or_else(|_| "lingomindid@gmail.com".to_string());
    let smtp_password = std::env::var("SMTP_PASSWORD").ok();
    let app_url = std::env::var("APP_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());
    let verify_link = format!("{}/verify-email?token={}", app_url, token);
    
    let subject = "Verifikasi Akun - LingoMind";
    let body = format!(
        "Halo {},\n\nTerima kasih telah mendaftar di LingoMind!\n\n\
        Silakan klik link berikut untuk mengaktifkan akun Anda (berlaku 24 jam):\n\
        {}\n\n\
        Jika Anda tidak merasa mendaftar, abaikan email ini.\n\n\
        Salam,\nLingoMind Team",
        full_name, verify_link
    );

    if let Some(pwd) = smtp_password {
        let email_msg = Message::builder()
            .from(format!("LingoMind <{}>", smtp_username).parse().unwrap())
            .to(email_trimmed.parse().unwrap())
            .subject(subject)
            .body(body)
            .map_err(|e| ServerFnError::new(format!("Gagal menyusun email verifikasi: {}", e)))?;

        let creds = Credentials::new(smtp_username.clone(), pwd);
        let mailer = SmtpTransport::relay("smtp.gmail.com")
            .unwrap()
            .credentials(creds)
            .port(587)
            .build();

        let _ = tokio::task::spawn_blocking(move || mailer.send(&email_msg)).await;
    }

    Ok("Tautan verifikasi telah dikirim ulang ke email Anda.".to_string())
}

/// Fungsi Server untuk memverifikasi dan mencatat kelulusan Exam
#[server]
pub async fn submit_exam_result(email: String, language: String, passed: bool, score_gained: i32) -> Result<UserProfile, ServerFnError> {
    let pool = super::db::get_pool();

    let row = sqlx::query("SELECT score FROM users WHERE email = $1")
        .bind(&email)
        .fetch_one(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal mengambil data user: {}", e)))?;

    let mut final_score = row.get::<i32, _>("score");
    final_score += score_gained;

    let levels_rows = sqlx::query("SELECT language_id, base_level, topic_idx FROM user_language_progress WHERE email = $1")
        .bind(&email)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

    let mut current_level = std::collections::HashMap::new();
    for l_row in levels_rows {
        let lang_id: String = l_row.get("language_id");
        let base_lvl: String = l_row.get("base_level");
        let t_idx: i32 = l_row.get("topic_idx");
        current_level.insert(lang_id, format!("{}.{}", base_lvl, t_idx));
    }

    let current_user_level_for_lang = current_level.get(&language).cloned().unwrap_or_else(|| "A1.0".to_string());

    let (mut base_level, mut topic_idx) = if let Some(idx) = current_user_level_for_lang.find('.') {
        let base = current_user_level_for_lang[..idx].to_string();
        let topic = current_user_level_for_lang[idx + 1..].parse::<usize>().unwrap_or(0);
        (base, topic)
    } else {
        (current_user_level_for_lang.clone(), 0)
    };

    let _ = sqlx::query(
        "INSERT INTO user_progress_logs (email, language, activity_type, topic, score_gained, passed, base_level, topic_idx) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
    )
    .bind(&email)
    .bind(&language)
    .bind("exam")
    .bind("Level Exam")
    .bind(score_gained)
    .bind(passed)
    .bind(&base_level)
    .bind(topic_idx as i32)
    .execute(pool)
    .await;

    let topics_res = crate::services::curriculum::get_all_curriculum().await.unwrap_or_default();
    let mut topics_in_level = 4;
    let mut current_level_pos = 0;
    for (i, lvl) in topics_res.iter().enumerate() {
        if lvl.level == base_level {
            topics_in_level = lvl.topics.len();
            current_level_pos = i;
            break;
        }
    }

    if passed && (topic_idx as usize) >= topics_in_level {
        topic_idx = 0;
        if current_level_pos + 1 < topics_res.len() {
            base_level = topics_res[current_level_pos + 1].level.clone();
        }
    }

    let _ = sqlx::query(
        "INSERT INTO user_language_progress (email, language_id, base_level, topic_idx) VALUES ($1, $2, $3, $4) ON CONFLICT (email, language_id) DO UPDATE SET base_level = EXCLUDED.base_level, topic_idx = EXCLUDED.topic_idx, updated_at = NOW()"
    )
    .bind(&email)
    .bind(&language)
    .bind(&base_level)
    .bind(topic_idx as i32)
    .execute(pool)
    .await
    .map_err(|e| ServerFnError::new(e.to_string()))?;

    let update_row = sqlx::query(
        "UPDATE users SET score = $1 WHERE email = $2 RETURNING full_name, email, preferred_language, score, role"
    )
    .bind(final_score)
    .bind(&email)
    .fetch_one(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal memperbarui nilai database: {}", e)))?;

    let levels_rows = sqlx::query("SELECT language_id, base_level, topic_idx FROM user_language_progress WHERE email = $1")
        .bind(&email)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

    let mut final_level_map = std::collections::HashMap::new();
    for l_row in levels_rows {
        let lang_id: String = l_row.get("language_id");
        let base_lvl: String = l_row.get("base_level");
        let t_idx: i32 = l_row.get("topic_idx");
        final_level_map.insert(lang_id, format!("{}.{}", base_lvl, t_idx));
    }

    Ok(UserProfile {
        full_name: update_row.get("full_name"),
        email: update_row.get("email"),
        preferred_language: update_row.get("preferred_language"),
        score: final_score,
        current_level: final_level_map,
        role: update_row.get("role"),
    })
}
