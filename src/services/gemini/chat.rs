// src/services/gemini/chat.rs
use dioxus::prelude::*;
use crate::models::chat::{ChatMessage, ChatSessionBootstrap};

fn normalize_setting_value(raw: &str) -> Result<String, ServerFnError> {
    let normalized = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return Err(ServerFnError::new("Nama skenario tidak boleh kosong."));
    }
    if normalized.chars().count() > 50 {
        return Err(ServerFnError::new("Nama skenario maksimal 50 karakter."));
    }
    Ok(normalized)
}

#[cfg(not(target_arch = "wasm32"))]
fn extract_gemini_text(json: &serde_json::Value) -> Option<String> {
    json.get("candidates")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .and_then(|cand| cand.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(|parts| parts.as_array())
        .and_then(|parts| parts.first())
        .and_then(|part| part.get("text"))
        .and_then(|text| text.as_str())
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(ToString::to_string)
}

#[cfg(not(target_arch = "wasm32"))]
async fn generate_ai_opening_message(
    client_http: &reqwest::Client,
    gemini_api_key: &str,
    gemini_model: &str,
    language: &str,
    level: &str,
    goal: &str,
    setting: &str,
) -> Result<String, ServerFnError> {
    use serde_json::json;

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        gemini_model, gemini_api_key
    );
    let system_instruction = format!(
        "Anda adalah partner roleplay native untuk bahasa {}. Tugas Anda hanya membuat SATU kalimat pembuka obrolan yang natural untuk skenario {}. \
Bahasa keluaran WAJIB bahasa {}. CEFR user: {}. Goal belajar: {}. \
Jangan pakai label, jangan pakai tanda kutip, jangan pakai terjemahan.",
        language, setting, language, level, goal
    );
    let user_prompt = format!(
        "Berikan satu kalimat pembuka sebagai lawan bicara di skenario {} dalam bahasa {}.",
        setting, language
    );
    let payload = json!({
        "contents": [
            { "role": "user", "parts": [{ "text": user_prompt }] }
        ],
        "systemInstruction": { "parts": [{ "text": system_instruction }] },
        "generationConfig": { "temperature": 0.75, "maxOutputTokens": 90 }
    });

    let response = client_http
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal generate opening AI: {e}")))?;

    let status = response.status();
    let json_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| ServerFnError::new(format!("Format JSON opening salah: {e}")))?;

    if !status.is_success() {
        let error_msg = json_response
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .unwrap_or("Gemini API mengembalikan status gagal");
        return Err(ServerFnError::new(format!("Gemini opening error ({}): {}", status, error_msg)));
    }

    extract_gemini_text(&json_response)
        .ok_or_else(|| ServerFnError::new("AI opening kosong. Coba lagi."))
}

#[cfg(not(target_arch = "wasm32"))]
async fn fetch_session_history(
    pool: &sqlx::PgPool,
    session_id: i32,
    limit: i64,
) -> Result<Vec<ChatMessage>, ServerFnError> {
    use sqlx::Row;

    let rows = sqlx::query(
        "SELECT id, session_id, sender, content
         FROM chat_messages
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT $2",
    )
    .bind(session_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal mengambil riwayat chat: {e}")))?;

    let mut messages = Vec::with_capacity(rows.len());
    for row in rows {
        messages.push(ChatMessage {
            id: row.get::<i32, _>("id"),
            session_id: row.get::<i32, _>("session_id"),
            sender: row.get::<String, _>("sender"),
            content: row.get::<String, _>("content"),
        });
    }
    messages.reverse();
    Ok(messages)
}

#[cfg(not(target_arch = "wasm32"))]
async fn refresh_legacy_opening_if_needed(
    pool: &sqlx::PgPool,
    client_http: &reqwest::Client,
    gemini_api_key: &str,
    gemini_model: &str,
    session_id: i32,
    language: &str,
    level: &str,
    goal: &str,
    setting: &str,
) -> Result<(), ServerFnError> {
    use sqlx::Row;

    let first_row = sqlx::query(
        "SELECT id, sender, content
         FROM chat_messages
         WHERE session_id = $1
         ORDER BY created_at ASC, id ASC
         LIMIT 1",
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal cek opening sesi: {e}")))?;

    let Some(row) = first_row else {
        return Ok(());
    };

    let sender: String = row.get("sender");
    let content: String = row.get("content");
    let msg_id: i32 = row.get("id");

    let normalized = content.trim().to_ascii_lowercase();
    let looks_old_template = matches!(
        normalized.as_str(),
        "welcome to our cafe. what can i get for you today?"
            | "welcome to our hotel reception. are you checking in today?"
            | "hello! nice to meet you. let's start our conversation."
            | "halo! selamat datang di kafe kami. ada yang bisa saya bantu untuk pesanan anda hari ini?"
            | "selamat datang di meja resepsionis hotel kami. apakah anda ingin melakukan check-in kamar?"
            | "halo! senang bertemu dengan anda. mari kita mulai mengobrol!"
    );
    let looks_legacy_opening = sender == "ai"
        && (content.contains("Mulai simulasi dalam Bahasa")
            || content.contains("(AI Peran")
            || looks_old_template);

    if !looks_legacy_opening {
        return Ok(());
    }

    let refreshed = generate_ai_opening_message(
        client_http,
        gemini_api_key,
        gemini_model,
        language,
        level,
        goal,
        setting,
    )
    .await?;
    sqlx::query("UPDATE chat_messages SET content = $1 WHERE id = $2")
        .bind(refreshed)
        .bind(msg_id)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal memperbarui opening legacy: {e}")))?;

    Ok(())
}

#[server(SendChatMessage)]
pub async fn send_chat_message_server(
    email: String,
    session_id: i32,
    language: String,
    level: String,
    goal: String,
    setting: String,
    user_message: String,
) -> Result<Vec<ChatMessage>, ServerFnError> {
    use reqwest::Client;
    use serde_json::json;

    #[cfg(not(target_arch = "wasm32"))]
    dotenvy::dotenv().ok();

    let trimmed_message = user_message.trim();
    if trimmed_message.is_empty() {
        return Err(ServerFnError::new("Pesan tidak boleh kosong."));
    }

    let trimmed_email = email.trim();
    if trimmed_email.is_empty() {
        return Err(ServerFnError::new("Email pengguna tidak ditemukan."));
    }
    let normalized_setting = normalize_setting_value(&setting)?;

    let pool = super::super::db::get_pool();

    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;
    let gemini_model = super::model_for_chat();
    let client_http = Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let owner_ok = sqlx::query(
        "SELECT 1
         FROM chat_sessions
         WHERE id = $1 AND email = $2 AND language = $3 AND level = $4 AND roleplay_setting = $5 AND goal = $6
         LIMIT 1",
    )
    .bind(session_id)
    .bind(trimmed_email)
    .bind(&language)
    .bind(&level)
    .bind(&normalized_setting)
    .bind(&goal)
    .fetch_optional(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal validasi sesi: {e}")))?;

    if owner_ok.is_none() {
        return Err(ServerFnError::new("Sesi chat tidak valid atau tidak lagi sinkron. Coba buka ulang sesi."));
    }

    sqlx::query("INSERT INTO chat_messages (session_id, sender, content) VALUES ($1, $2, $3)")
        .bind(session_id)
        .bind("user")
        .bind(trimmed_message)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal menyimpan pesan user: {e}")))?;

    // Kirim hanya jendela konteks terbaru ke model agar latency/tokens lebih stabil.
    let recent_messages = fetch_session_history(pool, session_id, 18).await?;

    let mut contents_payload = Vec::with_capacity(recent_messages.len());
    for msg in &recent_messages {
        let role = if msg.sender == "user" { "user" } else { "model" };
        contents_payload.push(json!({ "role": role, "parts": [{ "text": msg.content }] }));
    }

    let system_instruction = format!(
        "Anda adalah partner roleplay penutur asli bahasa {0} di lingkungan '{1}'. User belajar level CEFR {2} dengan goal {3}. \
Balas utama dalam bahasa {0}, natural, dan sesuai konteks skenario.\n\
Setelah balasan utama, tambahkan bagian 'Koreksi:' dalam Bahasa Indonesia (maksimal 2 poin ringkas) untuk memperbaiki pesan user terakhir.",
        language, normalized_setting, level, goal
    );

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        gemini_model, gemini_api_key
    );

    let payload = json!({
        "contents": contents_payload,
        "systemInstruction": { "parts": [{ "text": system_instruction }] },
        "generationConfig": { "temperature": 0.7, "maxOutputTokens": 300 }
    });

    let response = client_http
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal menghubungi Gemini API: {e}")))?;

    let status = response.status();
    let json_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| ServerFnError::new(format!("Format JSON salah: {e}")))?;

    if !status.is_success() {
        let error_msg = json_response
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .unwrap_or("Gemini API mengembalikan status gagal");
        return Err(ServerFnError::new(format!("Gemini API error ({}): {}", status, error_msg)));
    }

    let ai_text = extract_gemini_text(&json_response)
        .ok_or_else(|| ServerFnError::new("AI mengembalikan respons kosong."))?;

    sqlx::query("INSERT INTO chat_messages (session_id, sender, content) VALUES ($1, $2, $3)")
        .bind(session_id)
        .bind("ai")
        .bind(&ai_text)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal menyimpan respon AI: {e}")))?;

    fetch_session_history(pool, session_id, 120).await
}

#[server(GetOrCreateSession)]
pub async fn get_or_create_session_server(
    email: String,
    language: String,
    level: String,
    goal: String,
    setting: String,
) -> Result<ChatSessionBootstrap, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;
    use reqwest::Client;

    #[cfg(not(target_arch = "wasm32"))]
    dotenvy::dotenv().ok();

    let trimmed_email = email.trim();
    if trimmed_email.is_empty() {
        return Err(ServerFnError::new("Email pengguna tidak ditemukan."));
    }
    let normalized_setting = normalize_setting_value(&setting)?;

    let pool = super::super::db::get_pool();
    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;
    let gemini_model = super::model_for_chat();
    let client_http = Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let row_opt = sqlx::query(
        "SELECT id
         FROM chat_sessions
         WHERE email = $1 AND language = $2 AND level = $3 AND goal = $4 AND roleplay_setting = $5
         LIMIT 1",
    )
        .bind(trimmed_email)
        .bind(&language)
        .bind(&level)
        .bind(&goal)
        .bind(&normalized_setting)
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal query session: {e}")))?;

    if let Some(row) = row_opt {
        let id = row.get::<i32, _>("id");
        refresh_legacy_opening_if_needed(
            pool,
            &client_http,
            &gemini_api_key,
            &gemini_model,
            id,
            &language,
            &level,
            &goal,
            &normalized_setting,
        )
        .await?;
        let messages = fetch_session_history(pool, id, 120).await?;
        return Ok(ChatSessionBootstrap { session_id: id, messages });
    }

    let row = sqlx::query(
        "INSERT INTO chat_sessions (email, language, level, goal, roleplay_setting)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id",
    )
        .bind(trimmed_email)
        .bind(&language)
        .bind(&level)
        .bind(&goal)
        .bind(&normalized_setting)
        .fetch_one(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal membuat sesi baru: {e}")))?;

    let new_id: i32 = row.get("id");

    let ai_opening = generate_ai_opening_message(
        &client_http,
        &gemini_api_key,
        &gemini_model,
        &language,
        &level,
        &goal,
        &normalized_setting,
    )
    .await?;

    sqlx::query("INSERT INTO chat_messages (session_id, sender, content) VALUES ($1, $2, $3)")
        .bind(new_id)
        .bind("ai")
        .bind(&ai_opening)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal menyimpan pembuka sesi: {e}")))?;

    let messages = fetch_session_history(pool, new_id, 120).await?;
    Ok(ChatSessionBootstrap { session_id: new_id, messages })
}
