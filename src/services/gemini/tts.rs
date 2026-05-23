#![allow(dead_code)]
use dioxus::prelude::*;
#[cfg(feature = "server")]
use base64::Engine;

pub fn sanitize_tts_text(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 16);
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0usize;

    while i < chars.len() {
        if chars[i] == '_' {
            let mut j = i;
            while j < chars.len() && chars[j] == '_' {
                j += 1;
            }
            let run_len = j - i;
            if run_len >= 2 {
                if !out.is_empty() && !out.ends_with(' ') {
                    out.push(' ');
                }
                out.push_str("bla bla bla");
                out.push(' ');
            } else {
                out.push(' ');
            }
            i = j;
            continue;
        }

        out.push(chars[i]);
        i += 1;
    }

    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn in_range(c: char, start: char, end: char) -> bool {
    c >= start && c <= end
}

fn is_latin(c: char) -> bool {
    c.is_ascii_alphabetic()
        || in_range(c, '\u{00C0}', '\u{024F}')
        || in_range(c, '\u{1E00}', '\u{1EFF}')
}

#[derive(Default)]
struct ScriptStats {
    total_alpha: usize,
    latin: usize,
    hangul: usize,
    kana: usize,
    han: usize,
    arabic: usize,
    devanagari: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TtsSegment {
    pub text: String,
    pub lang_code: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ScriptBucket {
    Latin,
    Hangul,
    Kana,
    Han,
    Arabic,
    Devanagari,
    Other,
}

fn script_bucket(c: char) -> ScriptBucket {
    if in_range(c, '\u{1100}', '\u{11FF}')
        || in_range(c, '\u{3130}', '\u{318F}')
        || in_range(c, '\u{AC00}', '\u{D7AF}')
    {
        ScriptBucket::Hangul
    } else if in_range(c, '\u{3040}', '\u{309F}')
        || in_range(c, '\u{30A0}', '\u{30FF}')
    {
        ScriptBucket::Kana
    } else if in_range(c, '\u{4E00}', '\u{9FFF}') {
        ScriptBucket::Han
    } else if in_range(c, '\u{0600}', '\u{06FF}')
        || in_range(c, '\u{0750}', '\u{077F}')
    {
        ScriptBucket::Arabic
    } else if in_range(c, '\u{0900}', '\u{097F}') {
        ScriptBucket::Devanagari
    } else if is_latin(c) {
        ScriptBucket::Latin
    } else {
        ScriptBucket::Other
    }
}

fn lang_code_from_bucket(
    bucket: ScriptBucket,
    preferred_lang_code: &str,
    indonesian_context: bool,
) -> String {
    match bucket {
        ScriptBucket::Latin => {
            if indonesian_context {
                "id-ID".to_string()
            } else {
                preferred_lang_code.to_string()
            }
        }
        ScriptBucket::Hangul => "ko-KR".to_string(),
        ScriptBucket::Kana => "ja-JP".to_string(),
        ScriptBucket::Han => {
            if preferred_lang_code.starts_with("ja") {
                "ja-JP".to_string()
            } else {
                "zh-CN".to_string()
            }
        }
        ScriptBucket::Arabic => "ar-SA".to_string(),
        ScriptBucket::Devanagari => "hi-IN".to_string(),
        ScriptBucket::Other => preferred_lang_code.to_string(),
    }
}

fn collect_script_stats(text: &str) -> ScriptStats {
    let mut stats = ScriptStats::default();

    for c in text.chars() {
        if !c.is_alphabetic() {
            continue;
        }
        stats.total_alpha += 1;

        match script_bucket(c) {
            ScriptBucket::Hangul => stats.hangul += 1,
            ScriptBucket::Kana => stats.kana += 1,
            ScriptBucket::Han => stats.han += 1,
            ScriptBucket::Arabic => stats.arabic += 1,
            ScriptBucket::Devanagari => stats.devanagari += 1,
            ScriptBucket::Latin => stats.latin += 1,
            ScriptBucket::Other => {}
        }
    }

    stats
}

fn ratio(count: usize, total: usize) -> f32 {
    if total == 0 {
        0.0
    } else {
        count as f32 / total as f32
    }
}

fn looks_like_indonesian_text(text: &str) -> bool {
    let markers = [
        "yang",
        "dan",
        "dengan",
        "untuk",
        "tidak",
        "apakah",
        "apa",
        "arti",
        "manakah",
        "dalam",
        "kata",
        "saya",
        "sudah",
        "masih",
        "coba",
        "kalimat",
        "jawaban",
        "pilihan",
        "benar",
        "salah",
        "berikut",
        "sesuai",
        "syarat",
    ];

    let lower_text = text.to_lowercase();
    let tokens = lower_text
        .split(|c: char| !c.is_alphabetic())
        .filter(|t| !t.is_empty())
        .map(|t| t.to_string())
        .collect::<Vec<String>>();

    let score = markers
        .iter()
        .filter(|m| tokens.iter().any(|t| t == *m))
        .count();

    if score >= 2 {
        return true;
    }

    // Fallback ringan: pola tanya Indonesia yang sangat umum.
    let lower = lower_text.as_str();
    (lower.contains("apa arti")
        || lower.contains("apakah arti")
        || lower.contains("dalam kalimat")
        || lower.contains("manakah"))
        && tokens.len() >= 4
}

pub fn split_tts_segments(preferred_lang_code: &str, text: &str) -> Vec<TtsSegment> {
    let cleaned = sanitize_tts_text(text);
    if cleaned.is_empty() {
        return Vec::new();
    }

    let indonesian_context = looks_like_indonesian_text(&cleaned);
    let default_lang = if indonesian_context {
        "id-ID".to_string()
    } else {
        preferred_lang_code.to_string()
    };

    let mut segments: Vec<TtsSegment> = Vec::new();
    let mut current_text = String::new();
    let mut current_lang = default_lang.clone();

    for c in cleaned.chars() {
        if c.is_alphabetic() {
            let next_lang =
                lang_code_from_bucket(script_bucket(c), preferred_lang_code, indonesian_context);
            if next_lang != current_lang && !current_text.trim().is_empty() {
                segments.push(TtsSegment {
                    text: current_text.trim().to_string(),
                    lang_code: current_lang.clone(),
                });
                current_text.clear();
                current_lang = next_lang;
            } else if current_text.is_empty() {
                current_lang = next_lang;
            }
        }
        current_text.push(c);
    }

    if !current_text.trim().is_empty() {
        segments.push(TtsSegment {
            text: current_text.trim().to_string(),
            lang_code: current_lang,
        });
    }

    if segments.is_empty() {
        vec![TtsSegment {
            text: cleaned,
            lang_code: default_lang,
        }]
    } else {
        segments
    }
}

pub fn resolve_tts_lang_code(preferred_lang_code: &str, text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return preferred_lang_code.to_string();
    }

    let stats = collect_script_stats(trimmed);
    if stats.total_alpha == 0 {
        return preferred_lang_code.to_string();
    }

    let total = stats.total_alpha;
    let latin_ratio = ratio(stats.latin, total);
    let hangul_ratio = ratio(stats.hangul, total);
    let kana_ratio = ratio(stats.kana, total);
    let han_ratio = ratio(stats.han, total);
    let arabic_ratio = ratio(stats.arabic, total);
    let devanagari_ratio = ratio(stats.devanagari, total);

    // Kasus teks campuran (mis: instruksi Indonesia + 1-2 kata Korea):
    // prioritaskan suara Indonesia jika dominan latin + marker Indonesia kuat.
    if looks_like_indonesian_text(trimmed) && latin_ratio >= 0.20 {
        return "id-ID".to_string();
    }

    // Dominant script routing
    if hangul_ratio >= 0.30 {
        return "ko-KR".to_string();
    }

    if arabic_ratio >= 0.30 {
        return "ar-SA".to_string();
    }

    if devanagari_ratio >= 0.30 {
        return "hi-IN".to_string();
    }

    // Japanese biasanya campuran kana + kanji.
    if kana_ratio >= 0.15 && (kana_ratio + han_ratio) >= 0.30 {
        return "ja-JP".to_string();
    }

    // Chinese jika mayoritas Han tanpa kana dominan.
    if han_ratio >= 0.30 {
        return "zh-CN".to_string();
    }

    preferred_lang_code.to_string()
}

#[cfg(test)]
mod tests {
    use super::{resolve_tts_lang_code, split_tts_segments};

    #[test]
    fn mixed_indonesian_with_hangul_prefers_indonesian_voice() {
        let text = "Apakah arti dari kata '\u{C0AC}\u{ACFC}' dalam kalimat berikut? '\u{C800}\u{B294} \u{C0AC}\u{ACFC}\u{B97C} \u{BA39}\u{C5B4}\u{C694}.'";
        let lang = resolve_tts_lang_code("ko-KR", text);
        assert_eq!(lang, "id-ID");
    }

    #[test]
    fn pure_hangul_prefers_korean_voice() {
        let text = "\u{C800}\u{B294} \u{C0AC}\u{ACFC}\u{B97C} \u{BA39}\u{C5B4}\u{C694}.";
        let lang = resolve_tts_lang_code("ko-KR", text);
        assert_eq!(lang, "ko-KR");
    }

    #[test]
    fn mixed_indonesian_and_hangul_is_split_to_two_langs() {
        let text = "Apa arti kata \u{C0AC}\u{ACFC} dalam kalimat ini?";
        let segments = split_tts_segments("ko-KR", text);
        assert!(segments.iter().any(|s| s.lang_code == "id-ID"));
        assert!(segments.iter().any(|s| s.lang_code == "ko-KR"));
    }

    #[test]
    fn mixed_indonesian_and_han_is_split_to_two_langs() {
        let text = "Apa arti kata 苹果 dalam kalimat ini?";
        let segments = split_tts_segments("zh-CN", text);
        assert!(segments.iter().any(|s| s.lang_code == "id-ID"));
        assert!(segments.iter().any(|s| s.lang_code == "zh-CN"));
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn voice_from_lang(lang_code: &str) -> &'static str {
    match lang_code {
        l if l.starts_with("id") => "id-ID-ArdiNeural",
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
        l if l.starts_with("ru") => "ru-RU-SvetlanaNeural",
        l if l.starts_with("nl") => "nl-NL-ColetteNeural",
        l if l.starts_with("vi") => "vi-VN-HoaiMyNeural",
        l if l.starts_with("th") => "th-TH-AcharaNeural",
        l if l.starts_with("sv") => "sv-SE-SofieNeural",
        l if l.starts_with("pl") => "pl-PL-ZofiaNeural",
        l if l.starts_with("da") => "da-DK-ChristelNeural",
        l if l.starts_with("fi") => "fi-FI-SelmaNeural",
        l if l.starts_with("nb") || l.starts_with("no") => "nb-NO-PernilleNeural",
        l if l.starts_with("el") => "el-GR-AthinaNeural",
        l if l.starts_with("uk") => "uk-UA-PolinaNeural",
        l if l.starts_with("cs") => "cs-CZ-VlastaNeural",
        l if l.starts_with("ro") => "ro-RO-AlinaNeural",
        l if l.starts_with("hu") => "hu-HU-NoemiNeural",
        l if l.starts_with("fil") => "fil-PH-BlessicaNeural",
        l if l.starts_with("ms") => "ms-MY-YasminNeural",
        _ => "en-US-AriaNeural",
    }
}

#[server]
pub async fn generate_tts_audio_server(text: String, lang_code: String, speed: f32) -> Result<String, ServerFnError> {
    #[cfg(target_arch = "wasm32")]
    {
        let _ = (text, lang_code, speed);
        return Err(ServerFnError::new("TTS hanya berjalan di server."));
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let cleaned = sanitize_tts_text(&text);
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
