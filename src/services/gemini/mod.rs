// src/services/gemini/mod.rs
pub mod quiz;
pub mod lesson;
pub mod chat; // <-- Tambahkan ini
pub mod tts;

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
pub use chat::{send_chat_message_server, get_or_create_session_server}; // <-- Ekspor ini
pub use tts::generate_tts_audio_server;
pub use tts::resolve_tts_lang_code;
pub use tts::sanitize_tts_text;
pub use tts::split_tts_segments;
