// src/services/gemini/chat.rs
use dioxus::prelude::*;
use crate::models::chat::ChatMessage;

#[server(SendChatMessage)]
pub async fn send_chat_message_server(
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

    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let trimmed_message = user_message.trim();
    if trimmed_message.is_empty() {
        return Err(ServerFnError::new("Pesan tidak boleh kosong."));
    }

    let pool = super::super::db::get_pool();

    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;

    sqlx::query("INSERT INTO chat_messages (session_id, sender, content) VALUES ($1, $2, $3)")
        .bind(session_id)
        .bind("user")
        .bind(trimmed_message)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal menyimpan pesan user: {e}")))?;

    let rows = sqlx::query("SELECT id, session_id, sender, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC")
        .bind(session_id)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal mengambil riwayat chat: {e}")))?;

    let mut db_messages = Vec::new();
    for row in rows {
        db_messages.push(ChatMessage {
            id: row.get::<i32, _>("id"),
            session_id: row.get::<i32, _>("session_id"),
            sender: row.get::<String, _>("sender"),
            content: row.get::<String, _>("content"),
        });
    }

    let mut contents_payload = Vec::new();
    for msg in &db_messages {
        let role = if msg.sender == "user" { "user" } else { "model" };
        contents_payload.push(json!({ "role": role, "parts": [{ "text": msg.content }] }));
    }

    let system_instruction = format!(
        "Anda adalah penutur asli bahasa {0} di lingkungan '{1}'. User belajar di CEFR {2} dengan tujuan belajar {3}. Balas utama dalam bahasa {0}. Di akhir, tambahkan bagian 'Koreksi:' dalam Bahasa Indonesia untuk mengoreksi pesan user terakhir secara singkat.",
        language, setting, level, goal
    );

    let client_http = Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={}",
        gemini_api_key
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

    let ai_text = json_response["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| ServerFnError::new("AI mengembalikan respons kosong."))?;

    sqlx::query("INSERT INTO chat_messages (session_id, sender, content) VALUES ($1, $2, $3)")
        .bind(session_id)
        .bind("ai")
        .bind(ai_text)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal menyimpan respon AI: {e}")))?;

    db_messages.push(ChatMessage {
        id: 0,
        session_id,
        sender: "ai".to_string(),
        content: ai_text.to_string(),
    });

    Ok(db_messages)
}

#[server(GetOrCreateSession)]
pub async fn get_or_create_session_server(
    username: String,
    language: String,
    level: String,
    setting: String,
) -> Result<i32, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let pool = super::super::db::get_pool();

    let row_opt = sqlx::query("SELECT id FROM chat_sessions WHERE username = $1 AND language = $2 AND level = $3 AND roleplay_setting = $4 LIMIT 1")
        .bind(&username)
        .bind(&language)
        .bind(&level)
        .bind(&setting)
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal query session: {e}")))?;

    if let Some(row) = row_opt {
        return Ok(row.get::<i32, _>("id"));
    }

    let row = sqlx::query("INSERT INTO chat_sessions (username, language, level, roleplay_setting) VALUES ($1, $2, $3, $4) RETURNING id")
        .bind(&username)
        .bind(&language)
        .bind(&level)
        .bind(&setting)
        .fetch_one(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal membuat sesi baru: {e}")))?;

    let new_id: i32 = row.get("id");

    let opening_prompt = match setting.as_str() {
        "Cafe" => "Halo! Selamat datang di kafe kami. Ada yang bisa saya bantu untuk pesanan Anda hari ini?",
        "Hotel" => "Selamat datang di meja resepsionis hotel kami. Apakah Anda ingin melakukan check-in kamar?",
        _ => "Halo! Senang bertemu dengan Anda. Mari kita mulai mengobrol!",
    };

    let ai_opening = format!(
        "Mulai simulasi dalam Bahasa {}.\n\n(AI Peran {}): \"{}\"",
        language, setting, opening_prompt
    );

    sqlx::query("INSERT INTO chat_messages (session_id, sender, content) VALUES ($1, $2, $3)")
        .bind(new_id)
        .bind("ai")
        .bind(&ai_opening)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal menyimpan pembuka sesi: {e}")))?;

    Ok(new_id)
}
