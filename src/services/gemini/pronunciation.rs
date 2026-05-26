use dioxus::prelude::*;
use crate::models::pronunciation::PronunciationEvaluation;

#[server]
pub async fn evaluate_pronunciation_server(
    language: String,
    target_sentence: String,
    spoken_transcript: String,
) -> Result<PronunciationEvaluation, ServerFnError> {
    use reqwest::Client;
    use serde_json::json;

    #[cfg(not(target_arch = "wasm32"))]
    dotenvy::dotenv().ok();

    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let gemini_model = super::model_for_chat(); 
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        gemini_model, gemini_api_key
    );

    let prompt = format!(
        "Anda adalah ahli evaluasi pengucapan bahasa {language}.
Kalimat target yang seharusnya diucapkan: '{target_sentence}'
Teks Speech-to-Text hasil ucapan pengguna: '{spoken_transcript}'

Evaluasi pengucapan pengguna. STT mungkin memiliki salah ejaan jika pengucapannya salah. Jika STT kosong, berarti gagal mendengarkan.
Tentukan skor 0-100 dan berikan feedback singkat dalam bahasa Indonesia.
Beri status tiap kata dari kalimat target: 'correct', 'incorrect', atau 'missing'.
Kata-kata dalam array 'word_results' HARUS SAMA PERSIS dengan kata-kata di kalimat target secara berurutan. Abaikan tanda baca dalam field 'word'.",
        language = language,
        target_sentence = target_sentence,
        spoken_transcript = spoken_transcript
    );

    let payload = json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "score": { "type": "INTEGER" },
                    "feedback": { "type": "STRING" },
                    "word_results": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "word": { "type": "STRING" },
                                "status": { "type": "STRING" }
                            },
                            "required": ["word", "status"]
                        }
                    }
                },
                "required": ["score", "feedback", "word_results"]
            }
        }
    });

    let json_response = super::gemini_post_with_retry(&client, &url, &payload, 2).await?;

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
        .map_err(|e| ServerFnError::new(format!("Gagal parsing respons evaluasi pronunciation: {e}")))
}

#[server]
pub async fn generate_pronunciation_sentences_server(
    language: String,
    level: String,
) -> Result<Vec<String>, ServerFnError> {
    use reqwest::Client;
    use serde_json::json;

    #[cfg(not(target_arch = "wasm32"))]
    dotenvy::dotenv().ok();

    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let gemini_model = super::model_for_chat(); 
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        gemini_model, gemini_api_key
    );

    let prompt = format!(
        "Buat 5 kalimat dalam bahasa {} yang sesuai untuk level CEFR {} untuk latihan pronunciation.
Kembalikan dalam bentuk JSON array string. Jangan sertakan terjemahannya, hanya kalimat bahasa target. Panjang kalimat 4 hingga 12 kata.",
        language, level
    );

    let payload = json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "temperature": 0.7,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "ARRAY",
                "items": { "type": "STRING" }
            }
        }
    });

    let json_response = super::gemini_post_with_retry(&client, &url, &payload, 2).await?;

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
        .map_err(|e| ServerFnError::new(format!("Gagal parsing respons kalimat pronunciation: {e}")))
}
