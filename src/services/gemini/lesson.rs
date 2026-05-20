// src/services/gemini/lesson.rs
use dioxus::prelude::*;
use crate::models::lesson::LessonContainer;

#[server(GenerateLesson)]
pub async fn generate_lesson_server(language: String, level: String, goal: String) -> Result<LessonContainer, ServerFnError> {
    use reqwest::Client;
    use serde_json::json;

    #[cfg(not(target_arch = "wasm32"))]
    dotenvy::dotenv().ok();

    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={}",
        gemini_api_key
    );

    let prompt = format!(
        "Buatlah satu materi pelajaran singkat untuk belajar bahasa {} khusus untuk tingkat kesulitan CEFR {} dengan tujuan belajar: {}. \
        \n\nPanduan Ketat Tingkat Kesulitan:\
        \n- Jika A1/A2 (Pemula): Fokus pada topik dasar, kalimat pendek, dan grammar dasar.\
        \n- Jika B1/B2 (Menengah): Gunakan kalimat majemuk, kosakata menengah, dan grammar lebih kompleks.\
        \n- Jika C1/C2 (Mahir): Gunakan kosakata tingkat tinggi, struktur ekspresif, dan nuansa kultural.\
        \n\nInstruksi Output:\
        \nFokus pada satu topik grammar atau vocabulary. Berikan judul, penjelasan ringkas Bahasa Indonesia, daftar kosakata penting, dan contoh kalimat bahasa target beserta terjemahannya.",
        language, level, goal
    );

    let payload = json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "title": { "type": "STRING" },
                    "content": { "type": "STRING" },
                    "vocabulary": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "word": { "type": "STRING" },
                                "meaning": { "type": "STRING" }
                            },
                            "required": ["word", "meaning"]
                        }
                    },
                    "example_sentences": {
                        "type": "ARRAY",
                        "items": { "type": "STRING" }
                    }
                },
                "required": ["title", "content", "vocabulary", "example_sentences"]
            }
        }
    });

    let response = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal menghubungi jaringan Gemini API: {e}")))?;

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

    let text_content = json_response["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| ServerFnError::new("Respons API Gemini tidak berisi kandidat teks yang benar."))?;

    let cleaned_text = text_content
        .trim()
        .strip_prefix("```json")
        .unwrap_or(text_content)
        .strip_prefix("```")
        .unwrap_or(text_content)
        .strip_suffix("```")
        .unwrap_or(text_content)
        .trim();

    let lesson: LessonContainer = serde_json::from_str(cleaned_text)
        .map_err(|e| ServerFnError::new(format!("Gagal parsing respons lesson: {e}")))?;

    if lesson.title.trim().is_empty() || lesson.content.trim().is_empty() {
        return Err(ServerFnError::new("Respons lesson tidak valid: judul atau konten kosong."));
    }

    Ok(lesson)
}
