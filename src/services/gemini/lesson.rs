// src/services/gemini/lesson.rs
#![allow(dead_code)]
use dioxus::prelude::*;
use crate::models::lesson::LessonContainer;

#[cfg(not(target_arch = "wasm32"))]
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

    let json_response = super::gemini_post_with_retry(client, url, &payload, 3).await?;

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

#[cfg(not(target_arch = "wasm32"))]
fn is_rich_lesson(lesson: &LessonContainer) -> bool {
    let content_len = lesson.content.trim().chars().count();
    let vocab_len = lesson.vocabulary.len();
    let examples_len = lesson.example_sentences.len();
    content_len >= 700 && vocab_len >= 6 && examples_len >= 6
}

#[server]
pub async fn generate_lesson_server(language: String, level: String, goal: String, part: i32) -> Result<LessonContainer, ServerFnError> {
    use reqwest::Client;

    #[cfg(not(target_arch = "wasm32"))]
    dotenvy::dotenv().ok();

    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let gemini_model = super::model_for_lesson();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        gemini_model, gemini_api_key
    );

    let part_value = part.max(1);
    let part_note = if part_value <= 1 {
        "Ini bagian pertama."
    } else {
        "Ini materi lanjutan. Hindari mengulang penjelasan inti yang sama persis dengan bagian sebelumnya. Tambahkan variasi pola, konteks, dan contoh berbeda."
    };

    let prompt = format!(
        "Buat satu materi pelajaran KOMPREHENSIF untuk bahasa {} level CEFR {} dengan tujuan belajar: {}.\
        \n\nSerial materi: Bagian ke-{}. {}\
        \n\nPedoman level:\
        \n- A1/A2: konkret, sederhana, fokus pola dasar.\
        \n- B1/B2: lebih variatif, kontras penggunaan, situasi nyata.\
        \n- C1/C2: nuansa makna, register formal/informal, konteks natural.\
        \n\nKualitas wajib:\
        \n- content harus cukup detail untuk belajar mandiri 10-15 menit.\
        \n- content tulis dalam Bahasa Indonesia.\
        \n- content WAJIB dipisah rapi dengan format persis seperti ini (label ada di baris sendiri):\
        \n[Konsep Inti]\
        \n<isi konsep inti>\
        \n[Pola]\
        \n<isi pola>\
        \n[Kesalahan Umum]\
        \n<isi kesalahan umum>\
        \n[Tips Praktik]\
        \n<isi tips praktik>.\
        \n- vocabulary minimal 8 item relevan topik.\
        \n- example_sentences minimal 8 kalimat; setiap item format: \"<kalimat target> || <arti Indonesia>\".\
        \n- hindari penjelasan terlalu umum.",
        language, level, goal, part_value, part_note
    );

    let mut lesson = request_lesson_from_gemini(&client, &url, prompt).await?;

    if !is_rich_lesson(&lesson) {
        let enrich_prompt = format!(
            "Perbaiki JSON materi berikut agar lebih kaya dan tetap satu topik.\n\
            Syarat: content detail untuk 10-15 menit belajar, minimal 700 karakter, label bagian [Konsep Inti], [Pola], [Kesalahan Umum], [Tips Praktik] harus ada dan masing-masing berada di baris sendiri, vocabulary minimal 8, example_sentences minimal 8 format \"kalimat || arti\".\n\
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
