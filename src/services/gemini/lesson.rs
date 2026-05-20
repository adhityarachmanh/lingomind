// src/services/gemini/lesson.rs
use dioxus::prelude::*;
use crate::models::lesson::LessonContainer;

async fn request_lesson_from_gemini(
    client: &reqwest::Client,
    url: &str,
    prompt: String,
) -> Result<LessonContainer, ServerFnError> {
    use serde_json::json;

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
        .post(url)
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

    serde_json::from_str(cleaned_text)
        .map_err(|e| ServerFnError::new(format!("Gagal parsing respons lesson: {e}")))
}

fn is_rich_lesson(lesson: &LessonContainer) -> bool {
    let content_len = lesson.content.trim().chars().count();
    let vocab_len = lesson.vocabulary.len();
    let examples_len = lesson.example_sentences.len();
    content_len >= 700 && vocab_len >= 6 && examples_len >= 6
}

#[server(GenerateLesson)]
pub async fn generate_lesson_server(language: String, level: String, goal: String) -> Result<LessonContainer, ServerFnError> {
    use reqwest::Client;

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
        "Buat satu materi pelajaran KOMPREHENSIF untuk bahasa {} level CEFR {} dengan tujuan belajar: {}.\
        \n\nPedoman level:\
        \n- A1/A2: konkret, sederhana, fokus pola dasar.\
        \n- B1/B2: lebih variatif, kontras penggunaan, situasi nyata.\
        \n- C1/C2: nuansa makna, register formal/informal, konteks natural.\
        \n\nKualitas wajib:\
        \n- content harus cukup detail untuk belajar mandiri 10-15 menit.\
        \n- content tulis dalam Bahasa Indonesia dan pecah jelas dengan label bagian: [Konsep Inti], [Pola], [Kesalahan Umum], [Tips Praktik].\
        \n- vocabulary minimal 8 item relevan topik.\
        \n- example_sentences minimal 8 kalimat; setiap item format: \"<kalimat target> || <arti Indonesia>\".\
        \n- hindari penjelasan terlalu umum.",
        language, level, goal
    );

    let mut lesson = request_lesson_from_gemini(&client, &url, prompt).await?;

    if !is_rich_lesson(&lesson) {
        let enrich_prompt = format!(
            "Perbaiki JSON materi berikut agar lebih kaya dan tetap satu topik.\n\
            Syarat: content detail untuk 10-15 menit belajar, minimal 700 karakter, punya label bagian [Konsep Inti], [Pola], [Kesalahan Umum], [Tips Praktik], vocabulary minimal 8, example_sentences minimal 8 format \"kalimat || arti\".\n\
            Kembalikan JSON dengan schema yang sama, tanpa teks lain.\n\
            JSON awal:\n{}",
            serde_json::to_string(&lesson).unwrap_or_default()
        );
        lesson = request_lesson_from_gemini(&client, &url, enrich_prompt).await?;
    }

    if lesson.title.trim().is_empty() || lesson.content.trim().is_empty() {
        return Err(ServerFnError::new("Respons lesson tidak valid: judul atau konten kosong."));
    }

    Ok(lesson)
}
