use dioxus::prelude::*;
use crate::models::story::StoryData;

#[server]
pub async fn generate_story_server(language: String, level: String, goal: String) -> Result<StoryData, ServerFnError> {
    use reqwest::Client;
    use serde_json::json;

    #[cfg(not(target_arch = "wasm32"))]
    dotenvy::dotenv().ok();

    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let gemini_model = super::model_for_quiz(); // Use same model for stories
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        gemini_model, gemini_api_key
    );

    let prompt = format!(
        "Buatkan sebuah cerita pendek interaktif (Interactive Story) untuk melatih Listening Comprehension dalam bahasa {} level CEFR {} dengan tema/topik '{}'.\n\
        Aturan:\n\
        1. Cerita dibagi menjadi persis 4 segmen pendek.\n\
        2. Teks cerita (text) dan speaker WAJIB dalam bahasa {}.\n\
        3. Setiap segmen HARUS memiliki pertanyaan komprehensi (question) yang relevan dengan segmen tersebut.\n\
        4. Pertanyaan (question_text), opsi jawaban (options), dan jawaban benar (correct_answer) WAJIB dalam bahasa Indonesia.\n\
        5. 'translation' adalah terjemahan bahasa Indonesia untuk teks cerita di segmen tersebut.\n\
        6. Hanya boleh ada 1 jawaban benar di antara 4 opsi.\n\
        Keluarkan dalam format JSON murni tanpa markdown fence.",
        language, level, goal, language
    );

    let payload = json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "temperature": 0.7,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "title": { "type": "STRING", "description": "Judul cerita dalam bahasa target" },
                    "title_translation": { "type": "STRING", "description": "Terjemahan judul cerita" },
                    "segments": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "text": { "type": "STRING", "description": "Teks cerita atau dialog yang akan diucapkan TTS" },
                                "speaker": { "type": "STRING", "description": "Nama karakter yang bicara, atau null jika narator", "nullable": true },
                                "translation": { "type": "STRING", "description": "Terjemahan teks cerita" },
                                "question": {
                                    "type": "OBJECT",
                                    "nullable": true,
                                    "properties": {
                                        "question_text": { "type": "STRING" },
                                        "options": { "type": "ARRAY", "items": { "type": "STRING" } },
                                        "correct_answer": { "type": "STRING" },
                                        "explanation": { "type": "STRING" }
                                    },
                                    "required": ["question_text", "options", "correct_answer", "explanation"]
                                }
                            },
                            "required": ["text", "translation"]
                        }
                    }
                },
                "required": ["title", "title_translation", "segments"]
            }
        }
    });

    let json_response = super::gemini_post_with_retry(&client, &url, &payload, 3).await?;

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

    serde_json::from_str::<StoryData>(cleaned_text)
        .map_err(|e| ServerFnError::new(format!("Gagal parsing respons cerita: {e}")))
}
