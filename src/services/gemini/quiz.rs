// src/services/gemini/quiz.rs
use dioxus::prelude::*;
use crate::models::quiz::QuizContainer;

#[server(GenerateQuiz)]
pub async fn generate_quiz_server(language: String, level: String, goal: String) -> Result<QuizContainer, ServerFnError> {
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
        "Buatlah 5 soal kuis pilihan ganda untuk pengujian bahasa {} khusus untuk tingkat kesulitan CEFR {} dengan tujuan belajar: {}. \
        \n\nPanduan Ketat Tingkat Kesulitan:\
        \n- Jika A1/A2 (Pemula): Gunakan HANYA kosakata dasar sehari-hari, kalimat sangat pendek, dan tata bahasa dasar (seperti present atau simple past tense).\
        \n- Jika B1/B2 (Menengah): Gunakan kosakata yang lebih bervariasi, idiom dasar, dan tata bahasa kompleks (seperti perfect tenses, conditional, kalimat majemuk bertingkat).\
        \n- Jika C1/C2 (Mahir): Gunakan kosakata akademik/profesional tingkat tinggi, idiom native kompleks, nuansa makna tersirat, dan struktur tata bahasa tingkat lanjut.\
        \n\nInstruksi Output:\
        \nBerikan 4 opsi jawaban, tunjukkan kunci jawaban yang benar, dan berikan penjelasan singkat (dalam Bahasa Indonesia) kenapa jawaban tersebut benar secara tata bahasa atau konteks.",
        language, level, goal
    );

    let payload = json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "questions": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "question": { "type": "STRING" },
                                "options": { "type": "ARRAY", "items": { "type": "STRING" } },
                                "correct_answer": { "type": "STRING" },
                                "explanation": { "type": "STRING" }
                            },
                            "required": ["question", "options", "correct_answer", "explanation"]
                        }
                    }
                },
                "required": ["questions"]
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

    let quiz: QuizContainer = serde_json::from_str(cleaned_text)
        .map_err(|e| ServerFnError::new(format!("Gagal menerjemahkan respons AI ke Kuis: {e}")))?;

    if quiz.questions.len() != 5 || quiz.questions.iter().any(|q| q.options.len() != 4) {
        return Err(ServerFnError::new("Format kuis tidak valid: wajib 5 pertanyaan dan tiap pertanyaan 4 opsi."));
    }

    Ok(quiz)
}

#[server(GenerateWeaknessPracticeQuiz)]
pub async fn generate_weakness_practice_quiz_server(language: String, level: String, weakness_topic: String) -> Result<QuizContainer, ServerFnError> {
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
        "Buat 3 soal latihan fokus kelemahan untuk bahasa {} CEFR {}. Kelemahan utama: {}. \
        Format soal pilihan ganda 4 opsi, sertakan correct_answer dan explanation singkat Bahasa Indonesia.",
        language, level, weakness_topic
    );

    let payload = json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "questions": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "question": { "type": "STRING" },
                                "options": { "type": "ARRAY", "items": { "type": "STRING" } },
                                "correct_answer": { "type": "STRING" },
                                "explanation": { "type": "STRING" }
                            },
                            "required": ["question", "options", "correct_answer", "explanation"]
                        }
                    }
                },
                "required": ["questions"]
            }
        }
    });

    let response = client.post(&url).json(&payload).send().await
        .map_err(|e| ServerFnError::new(format!("Gagal menghubungi jaringan Gemini API: {e}")))?;
    let status = response.status();
    let json_response: serde_json::Value = response.json().await
        .map_err(|e| ServerFnError::new(format!("Format JSON salah: {e}")))?;
    if !status.is_success() {
        let error_msg = json_response.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).unwrap_or("Gemini API gagal");
        return Err(ServerFnError::new(format!("Gemini API error ({}): {}", status, error_msg)));
    }

    let text_content = json_response["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| ServerFnError::new("Respons API Gemini tidak berisi kandidat teks yang benar."))?;
    let cleaned_text = text_content.trim().strip_prefix("```json").unwrap_or(text_content).strip_prefix("```").unwrap_or(text_content).strip_suffix("```").unwrap_or(text_content).trim();
    let quiz: QuizContainer = serde_json::from_str(cleaned_text)
        .map_err(|e| ServerFnError::new(format!("Gagal parsing practice quiz: {e}")))?;

    if quiz.questions.len() != 3 || quiz.questions.iter().any(|q| q.options.len() != 4) {
        return Err(ServerFnError::new("Format practice quiz tidak valid: wajib 3 pertanyaan dan tiap pertanyaan 4 opsi."));
    }

    Ok(quiz)
}
