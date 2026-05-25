// src/services/gemini/mod.rs
pub mod quiz;
pub mod lesson;
pub mod chat;
pub mod tts;
pub mod placement;
pub mod exam;
pub mod story;

const DEFAULT_LITE_MODEL: &str = "gemini-2.5-flash-lite";

fn read_model_env(key: &str) -> Option<String> {
    let raw = std::env::var(key).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let valid = trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_');
    if !valid {
        return None;
    }
    Some(trimmed.to_string())
}

fn resolve_feature_model(feature_key: &str) -> String {
    let lite = read_model_env("GEMINI_MODEL_LITE").unwrap_or_else(|| DEFAULT_LITE_MODEL.to_string());
    read_model_env(feature_key)
        .or_else(|| read_model_env("GEMINI_MODEL_DEFAULT"))
        .unwrap_or(lite)
}

pub fn model_for_chat() -> String {
    resolve_feature_model("GEMINI_MODEL_CHAT")
}

pub fn model_for_quiz() -> String {
    resolve_feature_model("GEMINI_MODEL_QUIZ")
}

pub fn model_for_lesson() -> String {
    resolve_feature_model("GEMINI_MODEL_LESSON")
}

pub use quiz::generate_quiz_server;
pub use quiz::generate_weakness_practice_quiz_server;
pub use lesson::generate_lesson_server;
pub use chat::{send_chat_message_server, get_or_create_session_server};
pub use placement::evaluate_placement_server;
pub use tts::generate_tts_audio_server;
pub use tts::resolve_tts_lang_code;
pub use tts::sanitize_tts_text;
pub use tts::split_tts_segments;
pub use exam::generate_exam_server;
pub use story::generate_story_server;

#[cfg(not(target_arch = "wasm32"))]
pub async fn gemini_post_with_retry(
    client: &reqwest::Client,
    url: &str,
    payload: &serde_json::Value,
    max_retries: u32,
) -> Result<serde_json::Value, dioxus::prelude::ServerFnError> {
    use std::time::Duration;
    use tokio::time::sleep;

    let mut attempt = 0;
    loop {
        attempt += 1;
        let response = client.post(url).json(payload).send().await;

        match response {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    let json_resp: serde_json::Value = resp
                        .json()
                        .await
                        .map_err(|e| dioxus::prelude::ServerFnError::new(format!("Format JSON salah: {e}")))?;
                    return Ok(json_resp);
                } else if status.is_server_error() || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                    if attempt >= max_retries {
                        return Err(dioxus::prelude::ServerFnError::new(format!(
                            "Server AI sedang sibuk (Error {}). Silakan coba lagi beberapa saat lagi.",
                            status
                        )));
                    }
                    let delay = Duration::from_millis(500 * (1 << (attempt - 1))); // Exponential backoff: 500ms, 1s, 2s...
                    sleep(delay).await;
                } else {
                    let json_response: serde_json::Value = resp.json().await.unwrap_or_default();
                    let error_msg = json_response
                        .get("error")
                        .and_then(|e| e.get("message"))
                        .and_then(|m| m.as_str())
                        .unwrap_or("Gemini API mengembalikan status gagal");
                    return Err(dioxus::prelude::ServerFnError::new(format!("Gemini API error ({}): {}", status, error_msg)));
                }
            }
            Err(_e) => {
                if attempt >= max_retries {
                    return Err(dioxus::prelude::ServerFnError::new(format!(
                        "Gagal menghubungi server AI setelah {} percobaan. Periksa koneksi internet Anda.",
                        max_retries
                    )));
                }
                let delay = Duration::from_millis(500 * (1 << (attempt - 1)));
                sleep(delay).await;
            }
        }
    }
}
