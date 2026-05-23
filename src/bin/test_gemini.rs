#[cfg(not(target_arch = "wasm32"))]
use reqwest::Client;
#[cfg(not(target_arch = "wasm32"))]
use serde_json::json;
#[cfg(not(target_arch = "wasm32"))]
use std::env;

#[cfg(not(target_arch = "wasm32"))]
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let gemini_api_key = env::var("GEMINI_API_KEY")?;
    let gemini_model = "gemini-3.5-flash";
    
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        gemini_model, gemini_api_key
    );

    let language = "English";
    let setting = "Taxi";
    let level = "A2";
    let goal = "Latihan arah tujuan";

    let system_instruction = format!(
        "Anda sedang memainkan peran secara mendalam sebagai karakter di skenario '{1}'. Anda adalah seorang penutur asli bahasa {0}. \
        Tugas Anda adalah memberikan sapaan pembuka yang sangat natural, hidup, dan benar-benar menjiwai peran Anda di lingkungan '{1}'. \
        Sapa user dan tanyakan sesuatu yang relevan dengan peran Anda untuk memancing percakapan (2-3 kalimat lengkap). \
        Jangan pernah keluar dari karakter. Bahasa keluaran WAJIB bahasa {0} sepenuhnya. Sesuaikan kompleksitas bahasa dengan level CEFR user: {2}. Goal belajar: {3}. \
        Jangan menggunakan label nama peran, jangan pakai tanda kutip, dan jangan sertakan terjemahan.",
        language, setting, level, goal
    );
    let user_prompt = format!(
        "Mulai percakapan! Buat kalimat pembuka roleplay yang sangat menjiwai karakter Anda di skenario '{}' dalam bahasa {}. Pastikan Anda benar-benar bertingkah seperti peran tersebut (misal: jika kasir, bertingkahlah seperti kasir sungguhan yang sedang melayani pelanggan). Pastikan kalimatnya lengkap, natural, dan diakhiri dengan pertanyaan yang mengundang respons.",
        setting, language
    );

    let payload = json!({
        "contents": [
            { "role": "user", "parts": [{ "text": user_prompt }] }
        ],
        "systemInstruction": { "parts": [{ "text": system_instruction }] },
        "generationConfig": { "temperature": 0.8, "maxOutputTokens": 250 }
    });

    let client = Client::new();
    let response = client.post(&url).json(&payload).send().await?;
    let json_resp: serde_json::Value = response.json().await?;
    
    if let Some(candidates) = json_resp.get("candidates") {
        if let Some(text) = candidates.get(0).and_then(|c| c.get("content")).and_then(|c| c.get("parts")).and_then(|p| p.get(0)).and_then(|p| p.get("text")) {
            println!("====== HASIL RESPONS GEMINI-3.5-FLASH ======");
            println!("{}", text.as_str().unwrap_or(""));
        } else {
            println!("Format response salah: {:#?}", json_resp);
        }
    } else {
        println!("Error dari API Gemini: {:#?}", json_resp);
    }

    Ok(())
}

#[cfg(target_arch = "wasm32")]
fn main() {}
