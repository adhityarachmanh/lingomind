// src/services/gemini/placement.rs
use dioxus::prelude::*;

#[server]
pub async fn evaluate_placement_server(email: String, language: String, chat_history: Vec<(String, String)>) -> Result<String, ServerFnError> {
    use reqwest::Client;
    #[cfg(not(target_arch = "wasm32"))]
    dotenvy::dotenv().ok();
    
    let mut history_str = String::new();
    for (role, msg) in chat_history {
        history_str.push_str(&format!("{}: {}\n", role, msg));
    }

    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let gemini_model = super::model_for_chat();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        gemini_model, gemini_api_key
    );

    let prompt = format!(
        "Evaluasi kemampuan bahasa {} pengguna berdasarkan percakapan berikut:\n\n{}\n\n\
        Tugas: Tentukan level CEFR yang paling tepat (A1, A2, B1, B2, C1, atau C2).\
        Hanya kembalikan dua karakter, yaitu kode level CEFR-nya (misalnya 'A1' atau 'B2'). Tanpa spasi, tanpa teks tambahan.",
        language, history_str
    );

    let payload = serde_json::json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
    });

    let json_response = super::gemini_post_with_retry(&client, &url, &payload, 2).await?;

    let text_content = json_response["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("A1")
        .trim();

    let valid_levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    let mut final_level = "A1.0".to_string();
    for vl in valid_levels.iter() {
        if text_content.contains(vl) {
            final_level = format!("{}.0", vl);
            break;
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = crate::services::db::get_pool();
        
        let user_opt = sqlx::query("SELECT current_level FROM users WHERE email = $1 LIMIT 1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
            
        if let Some(row) = user_opt {
            let mut levels_json: serde_json::Value = row.get("current_level");
            if let Some(obj) = levels_json.as_object_mut() {
                obj.insert(language.clone(), serde_json::json!(final_level));
            } else {
                let mut map = serde_json::Map::new();
                map.insert(language.clone(), serde_json::json!(final_level));
                levels_json = serde_json::Value::Object(map);
            }
            
            let _ = sqlx::query("UPDATE users SET current_level = $1 WHERE email = $2")
                .bind(levels_json)
                .bind(&email)
                .execute(pool)
                .await;
        }
    }

    Ok(final_level)
}
