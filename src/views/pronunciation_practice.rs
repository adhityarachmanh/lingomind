use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::models::constants::LanguageCourse;
use crate::models::pronunciation::PronunciationEvaluation;
use crate::services::gemini::{evaluate_pronunciation_server, generate_pronunciation_sentences_server, resolve_tts_lang_code};

#[component]
pub fn PronunciationPractice() -> Element {
    let languages_res = use_context::<Resource<Vec<LanguageCourse>>>();
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    
    let language = selected_language();
    let (user_opt, _) = session_state();
    let active_level = user_opt
        .as_ref()
        .map(|u| u.base_level(&language))
        .unwrap_or_else(|| "A1".to_string());

    let mut sentences = use_signal(|| Vec::<String>::new());
    let mut current_idx = use_signal(|| 0_usize);
    let mut is_loading = use_signal(|| true);
    let mut is_listening = use_signal(|| false);
    let mut transcript = use_signal(|| String::new());
    let mut evaluation = use_signal(|| None::<PronunciationEvaluation>);
    let mut is_evaluating = use_signal(|| false);
    let mut error_msg = use_signal(|| None::<String>);

    let tts_lang_code = {
        let l = languages_res().unwrap_or_default();
        l.iter()
            .find(|c| c.id.eq_ignore_ascii_case(&language))
            .map(|c| c.tts_lang_code.clone())
            .unwrap_or_else(|| "en-US".to_string())
    };

    use_effect(use_reactive((&language, &active_level), move |(lang, lvl)| {
        is_loading.set(true);
        error_msg.set(None);
        evaluation.set(None);
        transcript.set(String::new());
        
        spawn(async move {
            match generate_pronunciation_sentences_server(lang, lvl).await {
                Ok(data) => {
                    sentences.set(data);
                    current_idx.set(0);
                    is_loading.set(false);
                }
                Err(e) => {
                    error_msg.set(Some(e.to_string()));
                    is_loading.set(false);
                }
            }
        });
    }));

    let lang_for_mic = language.clone();
    let handle_mic_click = move |_| {
        if is_listening() || is_evaluating() {
            return;
        }
        
        is_listening.set(true);
        transcript.set(String::new());
        evaluation.set(None);
        error_msg.set(None);

        #[cfg(target_arch = "wasm32")]
        {
            let tts_lang_code = tts_lang_code.clone();
            let target_sentence = if sentences().len() > current_idx() {
                sentences()[current_idx()].clone()
            } else {
                String::new()
            };
            let language_clone = lang_for_mic.clone();
            
            spawn(async move {
                let mut eval = document::eval(&format!(r#"
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    if (!SpeechRecognition) {{
                        dioxus.send({{ "type": "error", "message": "Browser tidak mendukung Speech Recognition" }});
                    }} else {{
                        if (window.lingomind_rec) {{
                            try {{ window.lingomind_rec.stop(); }} catch(e) {{}}
                        }}
                        const rec = new SpeechRecognition();
                        rec.lang = "{}";
                        rec.continuous = false;
                        rec.interimResults = false;
                        rec.maxAlternatives = 1;

                        rec.onresult = (e) => {{
                            if (e.results && e.results[0] && e.results[0][0]) {{
                                const txt = e.results[0][0].transcript;
                                dioxus.send({{ "type": "result", "text": txt }});
                            }}
                        }};
                        rec.onend = () => {{
                            dioxus.send({{ "type": "end" }});
                        }};
                        rec.onerror = (err) => {{
                            if (err.error !== 'no-speech') {{
                                dioxus.send({{ "type": "error", "message": err.error }});
                            }} else {{
                                dioxus.send({{ "type": "timeout" }});
                            }}
                        }};
                        rec.start();
                        window.lingomind_rec = rec;
                    }}
                "#, tts_lang_code));

                loop {
                    match eval.recv().await {
                        Ok(serde_json::Value::Object(map)) => {
                            let msg_type = map.get("type").and_then(|v| v.as_str()).unwrap_or("");
                            if msg_type == "result" {
                                let txt = map.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                transcript.set(txt.clone());
                                is_listening.set(false);
                                is_evaluating.set(true);

                                match evaluate_pronunciation_server(language_clone.clone(), target_sentence.clone(), txt).await {
                                    Ok(eval_data) => {
                                        evaluation.set(Some(eval_data));
                                        is_evaluating.set(false);
                                    }
                                    Err(e) => {
                                        error_msg.set(Some(e.to_string()));
                                        is_evaluating.set(false);
                                    }
                                }
                                break;
                            } else if msg_type == "error" || msg_type == "timeout" {
                                let err_msg = map.get("message").and_then(|v| v.as_str()).unwrap_or("Gagal menangkap suara.");
                                error_msg.set(Some(err_msg.to_string()));
                                is_listening.set(false);
                                break;
                            } else if msg_type == "end" {
                                if is_listening() {
                                    error_msg.set(Some("Suara tidak terdengar.".to_string()));
                                    is_listening.set(false);
                                }
                                break;
                            }
                        }
                        _ => {
                            break;
                        }
                    }
                }
            });
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            is_listening.set(false);
            error_msg.set(Some("Fitur suara hanya tersedia di browser.".to_string()));
        }
    };

    let lang_for_next = language.clone();
    let lvl_for_next = active_level.clone();
    let next_sentence = move |_| {
        if current_idx() + 1 < sentences().len() {
            current_idx.set(current_idx() + 1);
            transcript.set(String::new());
            evaluation.set(None);
            error_msg.set(None);
        } else {
            let lang = lang_for_next.clone();
            let lvl = lvl_for_next.clone();
            is_loading.set(true);
            error_msg.set(None);
            evaluation.set(None);
            transcript.set(String::new());
            
            spawn(async move {
                match generate_pronunciation_sentences_server(lang, lvl).await {
                    Ok(data) => {
                        sentences.set(data);
                        current_idx.set(0);
                        is_loading.set(false);
                    }
                    Err(e) => {
                        error_msg.set(Some(e.to_string()));
                        is_loading.set(false);
                    }
                }
            });
        }
    };

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans p-4 md:p-8 flex flex-col items-center pt-24",
            div { class: "max-w-2xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 md:p-10 shadow-xl relative overflow-hidden",
                
                // Header
                div { class: "text-center mb-8",
                    span { class: "text-xs font-bold bg-teal-50 text-teal-600 border border-teal-100 px-4 py-1.5 rounded-full uppercase tracking-wider shadow-sm", "Speech Scoring" }
                    h2 { class: "text-3xl font-extrabold text-slate-800 dark:text-slate-200 mt-4", "Pronunciation Practice" }
                    p { class: "text-slate-500 dark:text-slate-400 mt-2 font-medium", "Latih pengucapan {language} Anda" }
                }

                if is_loading() {
                    div { class: "flex flex-col items-center justify-center py-12",
                        div { class: "animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4" }
                        p { class: "text-slate-500 font-medium animate-pulse", "Menyiapkan kalimat latihan..." }
                    }
                } else if !sentences().is_empty() {
                    div { class: "flex flex-col items-center w-full",
                        
                        // Target Sentence Display
                        div { class: "w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl p-6 text-center shadow-inner mb-8",
                            p { class: "text-xs text-slate-400 uppercase tracking-widest font-black mb-3", "Ucapkan Kalimat Ini:" }
                            
                            if let Some(eval) = evaluation() {
                                // Tampilkan kata yang diwarnai
                                div { class: "text-2xl md:text-3xl font-bold flex flex-wrap justify-center gap-2",
                                    for w_res in eval.word_results {
                                        span {
                                            class: match w_res.status.as_str() {
                                                "correct" => "text-emerald-500",
                                                "incorrect" => "text-rose-500 underline decoration-rose-300 decoration-wavy underline-offset-4",
                                                "missing" => "text-slate-400 line-through",
                                                _ => "text-slate-700 dark:text-slate-200"
                                            },
                                            "{w_res.word}"
                                        }
                                    }
                                }
                            } else {
                                // Tampilkan kalimat biasa
                                p { class: "text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-200",
                                    "{sentences()[current_idx()]}"
                                }
                            }
                        }

                        // Microphone Button
                        button {
                            class: format!(
                                "h-24 w-24 rounded-full flex items-center justify-center text-4xl transition-all duration-300 shadow-xl {}",
                                if is_listening() {
                                    "bg-rose-500 text-white animate-pulse scale-110 shadow-rose-500/50"
                                } else if is_evaluating() {
                                    "bg-amber-400 text-white animate-spin"
                                } else {
                                    "bg-teal-500 hover:bg-teal-600 text-white hover:scale-105 shadow-teal-500/30"
                                }
                            ),
                            onclick: handle_mic_click,
                            disabled: is_listening() || is_evaluating(),
                            if is_evaluating() { "⏳" } else { "🎙️" }
                        }
                        
                        p { class: "mt-4 text-sm font-bold text-slate-500",
                            if is_listening() {
                                "Sedang mendengarkan..."
                            } else if is_evaluating() {
                                "Mengevaluasi..."
                            } else {
                                "Tekan mic dan mulai bicara"
                            }
                        }

                        // Error message
                        if let Some(err) = error_msg() {
                            div { class: "mt-6 bg-rose-50 text-rose-600 border border-rose-200 p-4 rounded-xl text-sm font-bold w-full text-center shadow-sm",
                                "{err}"
                            }
                        }

                        // Hasil Evaluasi
                        if let Some(eval) = evaluation() {
                            div { class: "mt-8 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col items-center animate-fade-in",
                                // Score circle
                                div { class: "relative w-20 h-20 mb-4 flex items-center justify-center",
                                    svg { class: "w-full h-full transform -rotate-90",
                                        circle {
                                            cx: "40", cy: "40", r: "36",
                                            stroke: "currentColor",
                                            stroke_width: "8",
                                            fill: "transparent",
                                            class: "text-slate-100 dark:text-slate-800"
                                        }
                                        circle {
                                            cx: "40", cy: "40", r: "36",
                                            stroke: "currentColor",
                                            stroke_width: "8",
                                            fill: "transparent",
                                            stroke_dasharray: "{eval.score as f64 * 2.26} 226", // 2*PI*36 ~ 226
                                            class: if eval.score >= 80 { "text-emerald-500" } else if eval.score >= 50 { "text-amber-500" } else { "text-rose-500" }
                                        }
                                    }
                                    span { class: "absolute text-xl font-black text-slate-700 dark:text-slate-200", "{eval.score}" }
                                }
                                
                                p { class: "text-slate-600 dark:text-slate-400 text-sm font-medium text-center italic mb-4", "\"{transcript}\"" }
                                
                                div { class: "bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 p-4 rounded-xl w-full flex gap-3",
                                    span { "💡" }
                                    p { class: "text-sm text-blue-800 dark:text-blue-300 font-medium", "{eval.feedback}" }
                                }
                            }
                        }

                        // Tombol Next
                        if !is_listening() && !is_evaluating() {
                            button {
                                class: "mt-8 text-sm font-bold text-slate-500 hover:text-teal-600 flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                                onclick: next_sentence,
                                "Kalimat Selanjutnya"
                                span { "→" }
                            }
                        }
                    }
                }
            }
        }
    }
}
