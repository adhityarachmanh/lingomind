use dioxus::prelude::*;
use crate::models::quiz::QuizContainer;
use std::collections::{HashMap, HashSet};

fn normalize_ws(input: &str) -> String {
    input.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn strip_choice_prefix(input: &str) -> String {
    let s = input.trim();
    if s.len() >= 2 {
        let mut chars = s.chars();
        let c1 = chars.next().unwrap_or_default();
        let c2 = chars.next().unwrap_or_default();
        if c1.is_ascii_alphanumeric() && (c2 == ')' || c2 == '.' || c2 == ':') {
            return normalize_ws(chars.as_str());
        }
    }
    normalize_ws(s)
}

fn normalize_quiz(mut quiz: QuizContainer) -> QuizContainer {
    for q in &mut quiz.questions {
        q.question = normalize_ws(&q.question);
        q.listen_text = normalize_ws(&q.listen_text);
        q.explanation = normalize_ws(&q.explanation);
        q.question_type = match q.question_type.trim().to_lowercase().as_str() {
            "listening" => "listening".to_string(),
            _ => "text".to_string(),
        };

        q.options = q
            .options
            .iter()
            .map(|o| strip_choice_prefix(o))
            .collect::<Vec<_>>();

        let answer_raw = strip_choice_prefix(&q.correct_answer);
        if let Some(found) = q
            .options
            .iter()
            .find(|opt| opt.eq_ignore_ascii_case(&answer_raw))
            .cloned()
        {
            q.correct_answer = found;
        } else {
            q.correct_answer = answer_raw;
        }

        if q.question_type == "text" && q.listen_text.is_empty() {
            q.listen_text = q.question.clone();
        }
    }
    quiz
}

fn validate_quiz_shape(quiz: &QuizContainer, expected_count: usize, label: &str) -> Result<(), ServerFnError> {
    if quiz.questions.len() != expected_count {
        return Err(ServerFnError::new(format!(
            "Format {label} tidak valid: wajib {expected_count} pertanyaan."
        )));
    }

    let mut listening_count = 0usize;
    for (idx, q) in quiz.questions.iter().enumerate() {
        if q.question.trim().is_empty() {
            return Err(ServerFnError::new(format!(
                "Format {label} tidak valid: pertanyaan ke-{} kosong.",
                idx + 1
            )));
        }
        if q.explanation.trim().is_empty() {
            return Err(ServerFnError::new(format!(
                "Format {label} tidak valid: explanation pertanyaan ke-{} kosong.",
                idx + 1
            )));
        }
        if q.options.len() != 4 {
            return Err(ServerFnError::new(format!(
                "Format {label} tidak valid: pertanyaan ke-{} harus punya 4 opsi.",
                idx + 1
            )));
        }

        let mut normalized_options = HashSet::new();
        for opt in &q.options {
            let normalized = opt.trim().to_lowercase();
            if normalized.is_empty() {
                return Err(ServerFnError::new(format!(
                    "Format {label} tidak valid: ada opsi kosong di pertanyaan ke-{}.",
                    idx + 1
                )));
            }
            normalized_options.insert(normalized);
        }

        if normalized_options.len() != 4 {
            return Err(ServerFnError::new(format!(
                "Format {label} tidak valid: ada opsi duplikat di pertanyaan ke-{}.",
                idx + 1
            )));
        }

        let answer = q.correct_answer.trim().to_lowercase();
        if answer.is_empty() || !normalized_options.contains(&answer) {
            return Err(ServerFnError::new(format!(
                "Format {label} tidak valid: kunci jawaban pertanyaan ke-{} tidak cocok dengan opsi.",
                idx + 1
            )));
        }

        let question_type = q.question_type.trim().to_lowercase();
        if question_type != "text" && question_type != "listening" {
            return Err(ServerFnError::new(format!(
                "Format {label} tidak valid: question_type pertanyaan ke-{} harus 'text' atau 'listening'.",
                idx + 1
            )));
        }
        if question_type == "listening" && q.listen_text.trim().chars().count() < 6 {
            return Err(ServerFnError::new(format!(
                "Format {label} tidak valid: listen_text pertanyaan listening ke-{} terlalu singkat/kosong.",
                idx + 1
            )));
        }
        if question_type == "listening" {
            listening_count += 1;
        }
    }

    let min_listening = if expected_count >= 5 { 2 } else { 1 };
    if listening_count < min_listening {
        return Err(ServerFnError::new(format!(
            "Format {label} tidak valid: minimal {min_listening} soal listening dari {expected_count} soal."
        )));
    }

    Ok(())
}

fn tokenize_lower(input: &str) -> HashSet<String> {
    input
        .split(|c: char| !c.is_alphanumeric())
        .filter(|token| token.len() >= 3)
        .map(|token| token.to_lowercase())
        .collect()
}

fn detect_skill(question: &str, explanation: &str, question_type: &str) -> &'static str {
    if question_type.eq_ignore_ascii_case("listening") {
        return "listening";
    }

    let q = question.to_lowercase();
    let e = explanation.to_lowercase();
    if q.contains("listen")
        || q.contains("audio")
        || q.contains("pronunciation")
        || e.contains("listening")
        || e.contains("pronunciation")
    {
        "listening"
    } else if q.contains("meaning")
        || q.contains("synonym")
        || e.contains("vocabulary")
        || e.contains("word choice")
    {
        "vocabulary"
    } else {
        "grammar"
    }
}

fn quality_issues(
    quiz: &QuizContainer,
    expected_count: usize,
    weakness_focus: Option<&str>,
) -> Vec<String> {
    let mut issues = Vec::new();

    let mut unique_questions = HashSet::new();
    let mut skill_counts: HashMap<&'static str, usize> = HashMap::new();
    let mut answer_position_counts: HashMap<usize, usize> = HashMap::new();
    let mut listening_count = 0usize;

    for (idx, q) in quiz.questions.iter().enumerate() {
        let q_norm = q.question.trim().to_lowercase();
        if !unique_questions.insert(q_norm) {
            issues.push(format!("Pertanyaan ke-{} terduplikasi.", idx + 1));
        }

        if q.question.chars().count() < 15 {
            issues.push(format!("Pertanyaan ke-{} terlalu pendek.", idx + 1));
        }

        if q.explanation.chars().count() < 40 {
            issues.push(format!("Explanation pertanyaan ke-{} terlalu singkat.", idx + 1));
        }

        let q_lower = q.question.to_lowercase();
        if q_lower.contains("all of the above")
            || q_lower.contains("semua jawaban benar")
            || q_lower.contains("both a and b")
        {
            issues.push(format!("Pertanyaan ke-{} mengandung pola opsi ambigu.", idx + 1));
        }

        if q.question_type.eq_ignore_ascii_case("listening") {
            listening_count += 1;
        }

        let skill = detect_skill(&q.question, &q.explanation, &q.question_type);
        *skill_counts.entry(skill).or_insert(0) += 1;

        if let Some(pos) = q
            .options
            .iter()
            .position(|opt| opt.eq_ignore_ascii_case(&q.correct_answer))
        {
            *answer_position_counts.entry(pos).or_insert(0) += 1;
        }
    }

    if expected_count >= 5 && skill_counts.len() < 2 {
        issues.push("Komposisi skill kurang variatif (minimal 2 skill berbeda).".to_string());
    }

    let min_listening = if expected_count >= 5 { 2 } else { 1 };
    if listening_count < min_listening {
        issues.push(format!(
            "Jumlah soal listening kurang: minimal {} dari {} soal.",
            min_listening, expected_count
        ));
    }

    let max_answer_bias = answer_position_counts.values().copied().max().unwrap_or(0);
    if max_answer_bias >= expected_count.saturating_sub(1) && expected_count >= 3 {
        issues.push("Posisi jawaban benar terlalu bias pada pilihan yang sama.".to_string());
    }

    if let Some(topic) = weakness_focus {
        let focus_tokens = tokenize_lower(topic);
        if !focus_tokens.is_empty() {
            let mut matched = 0usize;
            for q in &quiz.questions {
                let combined = format!("{} {} {}", q.question, q.listen_text, q.explanation);
                let q_tokens = tokenize_lower(&combined);
                if !focus_tokens.is_disjoint(&q_tokens) {
                    matched += 1;
                }
            }

            let required_match = expected_count.saturating_sub(1).max(2);
            if matched < required_match {
                issues.push("Soal belum cukup fokus pada topik weakness yang ditargetkan.".to_string());
            }
        }
    }

    issues
}

fn quality_score(issues: &[String]) -> i32 {
    let penalty = (issues.len() as i32) * 10;
    (100 - penalty).max(0)
}

async fn request_quiz_from_gemini(
    client: &reqwest::Client,
    url: &str,
    prompt: String,
) -> Result<QuizContainer, ServerFnError> {
    use serde_json::json;

    let payload = json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "temperature": 0.6,
            "topP": 0.9,
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
                                "question_type": { "type": "STRING" },
                                "listen_text": { "type": "STRING" },
                                "options": { "type": "ARRAY", "items": { "type": "STRING" } },
                                "correct_answer": { "type": "STRING" },
                                "explanation": { "type": "STRING" }
                            },
                            "required": ["question", "question_type", "listen_text", "options", "correct_answer", "explanation"]
                        }
                    }
                },
                "required": ["questions"]
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
        .map_err(|e| ServerFnError::new(format!("Gagal parsing respons quiz: {e}")))
}

fn build_quiz_prompt(language: &str, level: &str, goal: &str, weakness_context: &str) -> String {
    format!(
        "Buat 5 soal kuis pilihan ganda bahasa {} untuk level CEFR {} dan goal '{}'.\n\
        Wajib kualitas:\n\
        1) Setiap soal 4 opsi, hanya 1 benar.\n\
        2) Jangan gunakan opsi 'semua benar', 'both A and B', atau trik ambigu.\n\
        3) Explanation dalam Bahasa Indonesia minimal 2 kalimat singkat dan spesifik.\n\
        4) Variasikan tipe soal: grammar, vocabulary, contextual comprehension, dan listening.\n\
        5) Minimal 2 soal harus bertipe listening.\n\
        6) Pertahankan kosakata sesuai level CEFR.\n\
        7) Sertakan minimal 1 soal model cloze (isian) dengan placeholder '__'.\n\
        8) Gunakan field JSON ini dengan konsisten:\n\
           - question_type: isi 'listening' atau 'text'.\n\
           - listen_text: khusus listening, isi teks audio yang akan dibacakan TTS (kalimat/dialog pendek).\n\
           - question: untuk listening, isi instruksi/pertanyaan TANPA menyalin transcript listen_text.\n\
           - untuk question_type='text', listen_text boleh diisi string kosong.\n\
        9) Pertanyaan (question), opsi (options), kunci jawaban (correct_answer), dan listen_text wajib ditulis dalam bahasa target '{}'. Explanation tetap dalam Bahasa Indonesia.\n\
        10) Jika konteks kelemahan user tersedia, gunakan untuk menyesuaikan soal remedial ringan.\n\
        Konteks kelemahan user:\n{}",
        language, level, goal, language, weakness_context
    )
}

fn build_weakness_prompt(language: &str, level: &str, weakness_topic: &str, weakness_context: &str) -> String {
    format!(
        "Buat 3 soal latihan weakness-focused bahasa {} level CEFR {}.\n\
        Topik kelemahan utama: {}.\n\
        Data konteks kesalahan user terbaru: {}\n\
        Aturan:\n\
        1) Semua soal harus fokus pada topik kelemahan di atas.\n\
        2) Kesulitan bertahap: soal 1 mudah, soal 2 menengah, soal 3 menengah+ (masih sesuai level).\n\
        3) Tiap soal 4 opsi, 1 kunci benar.\n\
        4) Minimal 1 soal harus bertipe listening yang tetap relevan dengan topik kelemahan.\n\
        5) Gunakan field JSON ini dengan konsisten:\n\
           - question_type: isi 'listening' atau 'text'.\n\
           - listen_text: wajib terisi untuk question_type='listening' (teks audio untuk TTS).\n\
           - question: untuk listening, hanya instruksi/pertanyaan tanpa transcript audio.\n\
           - untuk question_type='text', listen_text boleh string kosong.\n\
        6) Pertanyaan (question), opsi (options), kunci jawaban (correct_answer), dan listen_text wajib ditulis dalam bahasa target '{}'. Explanation tetap dalam Bahasa Indonesia.\n\
        7) Explanation Bahasa Indonesia minimal 2 kalimat, jelaskan kenapa user biasanya salah.\n\
        8) Hindari opsi ambigu dan hindari pengulangan pola soal yang sama.",
        language,
        level,
        weakness_topic,
        language,
        if weakness_context.trim().is_empty() {
            "(belum ada catatan detail)"
        } else {
            weakness_context
        }
    )
}

#[cfg(not(target_arch = "wasm32"))]
async fn build_quiz_context(email: &str, language: &str) -> String {
    use sqlx::Row;

    let pool = crate::services::db::get_pool();
    let rows_result = sqlx::query(
        "SELECT topic, COUNT(*)::bigint AS cnt
         FROM weakness_logs
         WHERE email = $1 AND language = $2
         GROUP BY topic
         ORDER BY cnt DESC
         LIMIT 3"
    )
    .bind(email)
    .bind(language)
    .fetch_all(pool)
    .await;

    let rows = match rows_result {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    if rows.is_empty() {
        return "(belum ada riwayat kelemahan)".to_string();
    }

    rows.into_iter()
        .map(|row| {
            let topic: String = row.get("topic");
            let cnt: i64 = row.get("cnt");
            format!("- {} ({}x)", topic, cnt)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(target_arch = "wasm32")]
async fn build_quiz_context(_email: &str, _language: &str) -> String {
    String::new()
}

#[cfg(not(target_arch = "wasm32"))]
async fn build_weakness_context(email: &str, language: &str, weakness_topic: &str) -> String {
    use sqlx::Row;

    let pool = crate::services::db::get_pool();
    let rows_result = sqlx::query(
        "SELECT note FROM weakness_logs WHERE email = $1 AND language = $2 AND topic = $3 ORDER BY created_at DESC LIMIT 6"
    )
    .bind(email)
    .bind(language)
    .bind(weakness_topic)
    .fetch_all(pool)
    .await;

    let rows = match rows_result {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    if rows.is_empty() {
        return String::new();
    }

    rows
        .into_iter()
        .filter_map(|r| {
            let note: String = r.get("note");
            let normalized = normalize_ws(&note);
            if normalized.is_empty() {
                None
            } else {
                let short = normalized.chars().take(140).collect::<String>();
                Some(format!("- {}", short))
            }
        })
        .collect::<Vec<_>>()
        .join("\\n")
}

#[cfg(target_arch = "wasm32")]
async fn build_weakness_context(_email: &str, _language: &str, _weakness_topic: &str) -> String {
    String::new()
}

async fn generate_quiz_with_retries(
    client: &reqwest::Client,
    url: &str,
    base_prompt: String,
    expected_count: usize,
    label: &str,
    weakness_focus: Option<String>,
) -> Result<QuizContainer, ServerFnError> {
    let mut prompt = base_prompt;
    let mut best_candidate: Option<(QuizContainer, i32, Vec<String>)> = None;
    let mut last_error_message = String::new();

    for attempt in 1..=3 {
        match request_quiz_from_gemini(client, url, prompt.clone()).await {
            Ok(raw_quiz) => {
                let quiz = normalize_quiz(raw_quiz);

                if let Err(e) = validate_quiz_shape(&quiz, expected_count, label) {
                    last_error_message = e.to_string();
                    prompt = format!(
                        "Output sebelumnya gagal validasi shape. Error: {}\\nPerbaiki dan kirim ulang JSON sesuai schema tanpa teks lain.",
                        last_error_message
                    );
                    continue;
                }

                let issues = quality_issues(&quiz, expected_count, weakness_focus.as_deref());
                let score = quality_score(&issues);

                let replace_best = match &best_candidate {
                    Some((_, best_score, _)) => score > *best_score,
                    None => true,
                };
                if replace_best {
                    best_candidate = Some((quiz.clone(), score, issues.clone()));
                }

                if issues.is_empty() || score >= 92 {
                    return Ok(quiz);
                }

                if attempt < 3 {
                    let issues_text = issues
                        .iter()
                        .enumerate()
                        .map(|(i, issue)| format!("{}. {}", i + 1, issue))
                        .collect::<Vec<_>>()
                        .join("\\n");

                    let quiz_json = serde_json::to_string(&quiz).unwrap_or_default();
                    prompt = format!(
                        "Perbaiki kualitas quiz berikut dan kirim ulang JSON final tanpa teks tambahan.\\n\\
                        Masalah kualitas yang harus diperbaiki:\\n{}\\n\\
                        JSON sebelumnya:\\n{}",
                        issues_text, quiz_json
                    );
                }
            }
            Err(e) => {
                last_error_message = e.to_string();
                if attempt < 3 {
                    prompt = format!(
                        "Ulangi pembuatan {label}. Permintaan sebelumnya gagal karena: {}.\\n\\
                        Hasilkan JSON bersih sesuai schema, tanpa markdown fence.",
                        last_error_message
                    );
                }
            }
        }
    }

    if let Some((best_quiz, _score, _issues)) = best_candidate {
        return Ok(best_quiz);
    }

    Err(ServerFnError::new(format!(
        "Gagal menghasilkan {label} yang valid setelah beberapa percobaan. Detail terakhir: {}",
        if last_error_message.is_empty() {
            "Unknown error".to_string()
        } else {
            last_error_message
        }
    )))
}

#[server(GenerateQuiz)]
pub async fn generate_quiz_server(email: String, language: String, level: String, goal: String) -> Result<QuizContainer, ServerFnError> {
    use reqwest::Client;

    #[cfg(not(target_arch = "wasm32"))]
    dotenvy::dotenv().ok();

    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let gemini_model = super::model_for_quiz();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        gemini_model, gemini_api_key
    );

    let weakness_context = build_quiz_context(&email, &language).await;
    let prompt = build_quiz_prompt(&language, &level, &goal, &weakness_context);

    generate_quiz_with_retries(&client, &url, prompt, 5, "kuis", None).await
}

#[server(GenerateWeaknessPracticeQuiz)]
pub async fn generate_weakness_practice_quiz_server(
    email: String,
    language: String,
    level: String,
    weakness_topic: String,
) -> Result<QuizContainer, ServerFnError> {
    use reqwest::Client;

    #[cfg(not(target_arch = "wasm32"))]
    dotenvy::dotenv().ok();

    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let gemini_model = super::model_for_quiz();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        gemini_model, gemini_api_key
    );

    let weakness_context = build_weakness_context(&email, &language, &weakness_topic).await;
    let prompt = build_weakness_prompt(&language, &level, &weakness_topic, &weakness_context);

    generate_quiz_with_retries(
        &client,
        &url,
        prompt,
        3,
        "practice quiz",
        Some(weakness_topic),
    )
    .await
}
