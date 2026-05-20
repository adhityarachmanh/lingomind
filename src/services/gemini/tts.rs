use dioxus::prelude::*;
#[cfg(not(target_arch = "wasm32"))]
use base64::Engine;

#[cfg(not(target_arch = "wasm32"))]
fn voice_from_lang(lang_code: &str) -> &'static str {
    match lang_code {
        l if l.starts_with("de") => "de-DE-KatjaNeural",
        l if l.starts_with("ja") => "ja-JP-NanamiNeural",
        l if l.starts_with("ko") => "ko-KR-SunHiNeural",
        l if l.starts_with("zh-CN") => "zh-CN-XiaoxiaoNeural",
        l if l.starts_with("ar") => "ar-SA-HamedNeural",
        l if l.starts_with("hi") => "hi-IN-SwaraNeural",
        l if l.starts_with("tr") => "tr-TR-AhmetNeural",
        l if l.starts_with("fr") => "fr-FR-DeniseNeural",
        l if l.starts_with("es") => "es-ES-ElviraNeural",
        l if l.starts_with("it") => "it-IT-ElsaNeural",
        l if l.starts_with("pt-BR") => "pt-BR-FranciscaNeural",
        _ => "en-US-AriaNeural",
    }
}

#[server(GenerateTtsAudio)]
pub async fn generate_tts_audio_server(text: String, lang_code: String, speed: f32) -> Result<String, ServerFnError> {
    #[cfg(target_arch = "wasm32")]
    {
        let _ = (text, lang_code, speed);
        return Err(ServerFnError::new("TTS hanya berjalan di server."));
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let cleaned = text
            .replace("____", " ")
            .replace("___", " ")
            .replace("__", " ")
            .replace('_', " ")
            .trim()
            .to_string();
        if cleaned.is_empty() {
            return Err(ServerFnError::new("Teks kosong."));
        }

        let mut output_path = std::env::temp_dir();
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        output_path.push(format!("lingomind-tts-{stamp}.mp3"));

        let voice = voice_from_lang(&lang_code);
        let rate = if speed < 0.9 {
            "-25%"
        } else if speed > 1.0 {
            "+20%"
        } else {
            "+0%"
        };
        let status = tokio::process::Command::new("edge-tts")
            .arg("--voice")
            .arg(voice)
            .arg("--rate")
            .arg(rate)
            .arg("--text")
            .arg(&cleaned)
            .arg("--write-media")
            .arg(std::path::PathBuf::from(&output_path))
            .status()
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal menjalankan edge-tts: {e}")))?;

        if !status.success() {
            return Err(ServerFnError::new(
                "edge-tts tidak berhasil. Pastikan `edge-tts` sudah terinstall dan ada di PATH.",
            ));
        }

        let bytes = std::fs::read(&output_path)
            .map_err(|e| ServerFnError::new(format!("Gagal membaca file audio: {e}")))?;
        let _ = std::fs::remove_file(&output_path);
        let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
        Ok(format!("data:audio/mpeg;base64,{b64}"))
    }
}
