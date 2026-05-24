#![allow(dead_code)]
use dioxus::prelude::*;
use crate::models::quiz::QuizContainer;
use crate::models::constants::get_curriculum;

fn build_exam_prompt(language: &str, level: &str) -> String {
    let target_level = match level.to_uppercase().as_str() {
        "A1" => "A2",
        "A2" => "B1",
        "B1" => "B2",
        "B2" => "C1",
        "C1" => "C2",
        _ => "C2", // Cap at C2
    };

    let curriculum = get_curriculum();
    let topics = curriculum.iter()
        .find(|c| c.level == level)
        .map(|c| c.topics.join(", "))
        .unwrap_or_else(|| "Grammar lanjutan, vocabulary tingkat tinggi, reading comprehension, dan listening".to_string());

    format!(
        "TARGET BAHASA SOAL: {} (WAJIB! Seluruh pertanyaan, teks, dan opsi jawaban harus dalam bahasa ini, BUKAN bahasa Indonesia).\n\n\
        Buat 8 soal ujian sertifikasi pilihan ganda tingkat lanjut bahasa {} untuk menguji kelayakan kelulusan dari level CEFR {} menuju {}.\n\
        Wajib kualitas (LEVEL UJIAN AKHIR):\n\
        1) Soal WAJIB mencakup ke-4 topik ini: {}.\n\
        2) Setiap soal wajib memiliki 4 opsi yang sangat mengecoh, hanya 1 benar.\n\
        3) Jangan gunakan opsi 'semua benar', 'both A and B', atau trik murahan.\n\
        4) Minimal 2 soal harus berupa 'reading comprehension' dengan paragraf/teks pendek di dalam question.\n\
        5) Minimal 2 soal harus bertipe listening.\n\
        6) Gunakan field JSON ini dengan konsisten:\n\
           - question_type: isi 'listening' atau 'text'.\n\
           - listen_text: wajib terisi untuk question_type='listening' (teks audio untuk TTS).\n\
           - question: untuk listening, hanya instruksi/pertanyaan tanpa transcript audio.\n\
           - untuk question_type='text', listen_text boleh string kosong.\n\
        7) Explanation Bahasa Indonesia wajib komprehensif, minimal 3 kalimat mendalam tentang aturan grammar/kosakata mengapa opsi lain salah.\n\
        8) INGAT: Pertanyaan (question), opsi (options), kunci jawaban (correct_answer), dan listen_text WAJIB FULL dalam bahasa target '{}'. Explanation tetap dalam Bahasa Indonesia.",
        language, language, level, target_level, topics, language
    )
}

#[server]
pub async fn generate_exam_server(
    language: String,
    level: String,
) -> Result<QuizContainer, ServerFnError> {
    use reqwest::Client;

    #[cfg(not(target_arch = "wasm32"))]
    dotenvy::dotenv().ok();

    let gemini_api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| ServerFnError::new("Kunci GEMINI_API_KEY belum dikonfigurasi di file .env!"))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| ServerFnError::new(format!("Gagal menyiapkan HTTP client: {e}")))?;

    let gemini_model = super::model_for_quiz();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        gemini_model, gemini_api_key
    );

    let prompt = build_exam_prompt(&language, &level);

    // Call the shared retry mechanism from quiz.rs
    super::quiz::generate_quiz_with_retries(
        &client,
        &url,
        prompt,
        8, // we request 8 questions
        "exam",
        None,
    )
    .await
}
