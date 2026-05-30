// src/views/voice_chat.rs
use dioxus::prelude::*;
use crate::models::chat::ChatMessage;
use crate::models::user::UserProfile;
use crate::models::constants::LanguageCourse;
use crate::services::gemini::{get_or_create_session_server, sanitize_tts_text};

#[cfg(target_arch = "wasm32")]
use crate::services::gemini::{generate_tts_audio_server, send_chat_message_server, split_tts_segments};


#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
#[cfg(target_arch = "wasm32")]
use std::sync::atomic::{AtomicU64, Ordering};

#[cfg(target_arch = "wasm32")]
thread_local! {
    static ACTIVE_AUDIO: RefCell<Option<web_sys::HtmlAudioElement>> = const { RefCell::new(None) };
}

#[cfg(target_arch = "wasm32")]
static AUDIO_REQUEST_SEQ: AtomicU64 = AtomicU64::new(0);

#[cfg(target_arch = "wasm32")]
fn stop_audio_playback() {
    ACTIVE_AUDIO.with(|audio| {
        if let Some(a) = audio.borrow_mut().take() {
            let _ = a.pause();
            a.set_src("");
        }
    });
    AUDIO_REQUEST_SEQ.fetch_add(1, Ordering::SeqCst);
}

#[cfg(not(target_arch = "wasm32"))]
fn stop_audio_playback() {}

#[cfg(target_arch = "wasm32")]
async fn play_voice_segments(
    segments: Vec<(String, String)>,
    request_id: u64,
) -> Result<(), ()> {
    use gloo_timers::future::TimeoutFuture;

    for (segment_text, segment_lang) in segments {
        if AUDIO_REQUEST_SEQ.load(Ordering::SeqCst) != request_id {
            return Ok(());
        }

        // Ambil data base64 audio dari server
        let audio_src = match generate_tts_audio_server(segment_text, segment_lang, 1.0).await {
            Ok(src) => src,
            Err(_) => return Err(()),
        };

        if AUDIO_REQUEST_SEQ.load(Ordering::SeqCst) != request_id {
            return Ok(());
        }

        let audio = web_sys::HtmlAudioElement::new_with_src(&audio_src).map_err(|_| ())?;
        ACTIVE_AUDIO.with(|slot| {
            if let Some(prev) = slot.borrow_mut().take() {
                let _ = prev.pause();
            }
            *slot.borrow_mut() = Some(audio.clone());
        });
        let _ = audio.play();

        // Tunggu audio selesai dimainkan
        loop {
            if AUDIO_REQUEST_SEQ.load(Ordering::SeqCst) != request_id {
                let _ = audio.pause();
                return Ok(());
            }
            if audio.ended() {
                break;
            }
            TimeoutFuture::new(35).await;
        }
    }

    Ok(())
}

fn normalize_setting_input_for_ui(raw: &str) -> Result<String, String> {
    let normalized = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return Err("Nama skenario tidak boleh kosong.".to_string());
    }
    if normalized.chars().count() > 50 {
        return Err("Nama skenario maksimal 50 karakter.".to_string());
    }
    Ok(normalized)
}

#[component]
pub fn VoiceChat(goal: String) -> Element {
    let languages_res = use_context::<Resource<Vec<LanguageCourse>>>();
    let langs = languages_res().unwrap_or_default();
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let nav = use_navigator();
    let (user_opt, _is_ready) = session_state();

    let language = selected_language();
    let active_level = user_opt
        .as_ref()
        .map(|u| u.base_level(&language))
        .unwrap_or_else(|| "A1".to_string());
    let email = user_opt.as_ref().map(|u| u.email.clone()).unwrap_or_default();

    let mut selected_setting = use_signal(|| None::<String>);
    let mut session_id = use_signal(|| 0_i32);
    let mut messages = use_signal(Vec::<ChatMessage>::new);
    let mut is_loading = use_signal(|| false);
    let mut error_msg = use_signal(|| None::<String>);
    let mut custom_setting_input = use_signal(String::new);
    let mut custom_settings = use_signal(Vec::<String>::new);

    // Voice states
    let mut voice_status = use_signal(|| "menghubungkan".to_string()); // "menghubungkan", "mendengarkan", "berpikir", "berbicara", "muted"
    let mut is_muted = use_signal(|| false);
    let mut user_caption = use_signal(|| "".to_string());
    let mut ai_caption = use_signal(|| "".to_string());
    let mut ai_feedback = use_signal(|| "".to_string());

    let user_for_setup = email.clone();
    let lang_for_setup = language.clone();
    let lvl_for_setup = active_level.clone();
    let goal_for_setup = goal.clone();

    let tts_lang_code_memo = use_memo(move || {
        let l = languages_res().unwrap_or_default();
        l.iter()
            .find(|course| course.id.eq_ignore_ascii_case(&selected_language()))
            .map(|course| course.tts_lang_code.clone())
            .unwrap_or_else(|| "en-US".to_string())
    });

    let edge_tts_voice_memo = use_memo(move || {
        let l = languages_res().unwrap_or_default();
        l.iter()
            .find(|course| course.id.eq_ignore_ascii_case(&selected_language()))
            .map(|course| course.edge_tts_voice.clone())
            .unwrap_or_else(|| "en-US-AriaNeural".to_string())
    });

    let is_male_voice = use_memo(move || {
        let voice = edge_tts_voice_memo().to_lowercase();
        // Cek nama voice populer yang biasanya pria
        let male_names = ["guy", "christopher", "eric", "roger", "steffan", "brian", "yunxi", "keita", "denis", "alvaro", "antonio", "emilio", "henri", "klaus", "conrad", "jorge", "bastian", "nicolas", "ryan", "andrew"];
        male_names.iter().any(|&name| voice.contains(name))
    });

    // Fungsi pemutar suara asisten AI
    let speak_response = move |text: String| {
        let normalized = sanitize_tts_text(&text);
        if normalized.is_empty() {
            return;
        }

        #[cfg(target_arch = "wasm32")]
        {
            let edge_tts_voice = edge_tts_voice_memo();
            let segments = split_tts_segments(&edge_tts_voice, &normalized)
                .into_iter()
                .map(|s| (s.text, s.edge_tts_voice))
                .collect::<Vec<(String, String)>>();

            let request_id = AUDIO_REQUEST_SEQ.fetch_add(1, Ordering::SeqCst) + 1;
            
            // Set status menjadi berbicara
            voice_status.set("berbicara".to_string());
            
            spawn(async move {
                let _ = play_voice_segments(segments, request_id).await;
                
                // Setelah selesai berbicara, jika tidak sedang di-mute, masuk kembali ke mode mendengarkan
                if !is_muted() {
                    voice_status.set("mendengarkan".to_string());
                } else {
                    voice_status.set("muted".to_string());
                }
            });
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            let _ = normalized;
        }
    };

    let start_voice_session = move |setting: String| {
        let user = user_for_setup.clone();
        let lang = lang_for_setup.clone();
        let lvl = lvl_for_setup.clone();
        let goal_value = goal_for_setup.clone();
        
        selected_setting.set(Some(setting.clone()));
        error_msg.set(None);
        messages.set(Vec::new());
        session_id.set(0);
        is_loading.set(true);
        voice_status.set("menghubungkan".to_string());

        #[allow(unused_mut)]
        let mut speak_callback = speak_response.clone();

        spawn(async move {
            match get_or_create_session_server(user, lang, lvl, goal_value, setting).await {
                Ok(bootstrap) => {
                    session_id.set(bootstrap.session_id);
                    messages.set(bootstrap.messages.clone());
                    is_loading.set(false);

                    // Ambil pembuka suara asisten pertama kali
                    if let Some(first_msg) = bootstrap.messages.last() {
                        if first_msg.sender == "ai" {
                            let content_str = first_msg.content.clone();
                            let (main_text, feedback_text) = if content_str.contains("Koreksi:") {
                                let mut parts = content_str.splitn(2, "Koreksi:");
                                let main = parts.next().unwrap_or("").trim().to_string();
                                let feedback = parts.next().unwrap_or("").trim().to_string();
                                (main, feedback)
                            } else {
                                (content_str.clone(), "".to_string())
                            };
                            
                            ai_caption.set(main_text.clone());
                            ai_feedback.set(feedback_text);
                            speak_callback(main_text);
                            return;
                        }
                    }
                    
                    // Jika tidak ada pesan pembuka, langsung dengarkan
                    voice_status.set("mendengarkan".to_string());
                }
                Err(e) => {
                    error_msg.set(Some(format!("Gagal memuat sesi panggilan: {}", e)));
                    is_loading.set(false);
                    voice_status.set("muted".to_string());
                }
            }
        });
    };

    // Loop Speech Recognition menggunakan eval
    #[cfg(target_arch = "wasm32")]
    let language_rec = language.clone();
    #[cfg(target_arch = "wasm32")]
    let active_level_rec = active_level.clone();
    #[cfg(target_arch = "wasm32")]
    let goal_rec = goal.clone();
    let _recognition_loop = use_resource(move || {
        #[cfg(target_arch = "wasm32")]
        {
            let status = voice_status();
            let id = session_id();
            let user_email = email.clone();
            let lang = language_rec.clone();
            let lvl = active_level_rec.clone();
            let goal_val = goal_rec.clone();
            let setting_val = selected_setting().unwrap_or_default();
            let muted = is_muted();
            
            let mut speak_callback = speak_response.clone();

            async move {
                if status == "mendengarkan" && id > 0 && !muted {
                    let speech_lang_code = tts_lang_code_memo();
                    
                    // Jalankan JS Speech Recognition
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
                    "#, speech_lang_code));

                    // Tunggu respons dari JS
                    match eval.recv().await {
                        Ok(serde_json::Value::Object(map)) => {
                            let msg_type = map.get("type").and_then(|v| v.as_str()).unwrap_or("");
                            if msg_type == "result" {
                                let text = map.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                if !text.trim().is_empty() {
                                    // Update caption user
                                    user_caption.set(text.clone());
                                    voice_status.set("berpikir".to_string());
                                    
                                    // Kirim pesan ke server di background agar tidak ter-cancel oleh re-run use_resource
                                    let email_clone = user_email.clone();
                                    let lang_clone = lang.clone();
                                    let lvl_clone = lvl.clone();
                                    let goal_clone = goal_val.clone();
                                    let setting_clone = setting_val.clone();
                                    let text_clone = text.clone();
                                    
                                    spawn(async move {
                                        match send_chat_message_server(
                                            email_clone,
                                            id,
                                            lang_clone,
                                            lvl_clone,
                                            goal_clone,
                                            setting_clone,
                                            text_clone
                                        ).await {
                                            Ok(updated_history) => {
                                                messages.set(updated_history.clone());
                                                if let Some(last_msg) = updated_history.last() {
                                                    if last_msg.sender == "ai" {
                                                        let content_str = last_msg.content.clone();
                                                        let (main_text, feedback_text) = if content_str.contains("Koreksi:") {
                                                            let mut parts = content_str.splitn(2, "Koreksi:");
                                                            let main = parts.next().unwrap_or("").trim().to_string();
                                                            let feedback = parts.next().unwrap_or("").trim().to_string();
                                                            (main, feedback)
                                                        } else {
                                                            (content_str.clone(), "".to_string())
                                                        };
                                                        
                                                        ai_caption.set(main_text.clone());
                                                        ai_feedback.set(feedback_text);
                                                        speak_callback(main_text);
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                error_msg.set(Some(format!("Gagal mengirim pesan suara: {}", e)));
                                                voice_status.set("mendengarkan".to_string());
                                            }
                                        }
                                    });
                                }
                            } else if msg_type == "timeout" || msg_type == "end" {
                                // Jika timeout karena tidak ada suara, coba restart mic otomatis setelah 1 detik
                                gloo_timers::future::TimeoutFuture::new(1000).await;
                                if voice_status() == "mendengarkan" && !is_muted() {
                                    // Trigger re-render untuk menjalankan ulang recognition resource
                                    voice_status.set("berpikir".to_string());
                                    voice_status.set("mendengarkan".to_string());
                                }
                            } else if msg_type == "error" {
                                let err_msg = map.get("message").and_then(|v| v.as_str()).unwrap_or("Merekam suara gagal");
                                error_msg.set(Some(err_msg.to_string()));
                                voice_status.set("muted".to_string());
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
        #[cfg(not(target_arch = "wasm32"))]
        async move {}
    });

    let handle_mute_toggle = move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            let _ = document::eval(r#"
                if (window.lingomind_rec) {
                    try { window.lingomind_rec.stop(); } catch(e) {}
                }
            "#);
        }

        if is_muted() {
            is_muted.set(false);
            if voice_status() == "muted" {
                voice_status.set("mendengarkan".to_string());
            }
        } else {
            is_muted.set(true);
            voice_status.set("muted".to_string());
        }
    };

    let goal_for_hangup = goal.clone();
    let handle_hang_up = move |_| {
        stop_audio_playback();
        #[cfg(target_arch = "wasm32")]
        {
            let _ = document::eval(r#"
                if (window.lingomind_rec) {
                    try { window.lingomind_rec.stop(); } catch(e) {}
                }
            "#);
        }
        
        if goal_for_hangup != "Bebas" {
            nav.push(crate::routes::Route::Roadmap {});
        } else {
            selected_setting.set(None);
            session_id.set(0);
            user_caption.set(String::new());
            ai_caption.set(String::new());
        }
    };

    let mut auto_start_fn = start_voice_session.clone();
    let auto_goal = goal.clone();
    let current_setting = selected_setting;
    let is_loading_val = is_loading;
    use_effect(move || {
        if auto_goal != "Bebas" && current_setting().is_none() && !is_loading_val() {
            auto_start_fn(auto_goal.clone());
        }
    });

    // TAMPILAN 1: Pemilihan Skenario
    if selected_setting().is_none() {
        let preset_scenarios = [
            ("Cafe", "Kasir Kedai Kopi", "Latihan memesan minuman secara verbal."),
            ("Hotel", "Resepsionis Hotel", "Latihan check-in lisan & request kamar."),
            ("Airport", "Imigrasi Bandara", "Latihan menjawab pertanyaan petugas imigrasi."),
            ("Restaurant", "Pelayan Restoran", "Latihan verbal memesan menu utama."),
            ("Office", "Rekan Kerja Kantor", "Latihan meeting lisan & curah ide."),
            ("Shopping", "Penjaga Toko", "Latihan menawar harga & ukuran baju."),
            ("Hospital", "Dokter Klinik", "Latihan mendeskripsikan sakit & konsultasi lisan."),
            ("Taxi", "Sopir Perjalanan", "Latihan menunjukkan arah & mengobrol di jalan."),
        ];
        let custom_scenarios = custom_settings();

        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900/50 dark:text-slate-50 p-4 md:p-8 flex flex-col justify-center items-center font-sans",
                div { class: "max-w-4xl w-full bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700 rounded-3xl p-6 md:p-10 shadow-xl text-center",
                    span { class: "text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-4 py-1.5 rounded-full uppercase tracking-wider mb-4 inline-block shadow-sm",
                        "Gemini Live Voice - {language}"
                    }
                    p { class: "text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium",
                        "Global language: "
                        span { class: "text-emerald-600 font-bold", "{selected_language}" }
                    }
                    h2 { class: "text-3xl font-extrabold text-slate-800 dark:text-slate-200 mb-3",
                        "Pilih Partner Panggilan Suara"
                    }
                    p { class: "text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed font-medium max-w-2xl mx-auto",
                        "Latih berbicara langsung secara verbal. Asisten AI akan mendengarkan pelafalan Anda dan langsung merespons via suara."
                    }

                    div { class: "grid grid-cols-1 sm:grid-cols-2 gap-4",
                        for (setting_key, title, desc) in preset_scenarios {
                            button {
                                key: "{setting_key}",
                                class: "w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-400 hover:bg-emerald-50/50 p-5 rounded-2xl text-left font-bold text-sm transition-all flex justify-between items-start gap-4 group shadow-sm hover:shadow-md",
                                onclick: {
                                    let mut click_setting = start_voice_session.clone();
                                    let scenario_name = setting_key.to_string();
                                    move |_| click_setting(scenario_name.clone())
                                },
                                div {
                                    p { class: "text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 transition-colors text-base",
                                        "{title}"
                                    }
                                    p { class: "text-xs text-slate-500 dark:text-slate-400 font-medium mt-1.5 leading-relaxed",
                                        "{desc}"
                                    }
                                }
                                span { class: "text-slate-400 group-hover:text-emerald-500 transition-colors mt-0.5",
                                    "🎙️"
                                }
                            }
                        }
                    }

                    div { class: "mt-8 p-6 rounded-2xl border-2 border-slate-100/20 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-left shadow-inner",
                        p { class: "text-sm font-extrabold text-emerald-700 uppercase tracking-wider mb-2",
                            "Buat Skenario Telepon Kustom"
                        }
                        div { class: "flex flex-col sm:flex-row gap-3",
                            input {
                                r#type: "text",
                                class: "flex-1 bg-white dark:bg-slate-900 border border-slate-300 hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none transition-all placeholder-slate-400 shadow-sm",
                                placeholder: "Contoh: Wawancara Visa, Telpon Customer Service...",
                                value: "{custom_setting_input}",
                                maxlength: 50,
                                oninput: move |e| custom_setting_input.set(e.value()),
                            }
                            button {
                                r#type: "button",
                                class: "bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm hover:shadow-md",
                                onclick: {
                                    let mut click_custom_setting = start_voice_session.clone();
                                    move |_| {
                                        match normalize_setting_input_for_ui(&custom_setting_input()) {
                                            Ok(setting) => {
                                                error_msg.set(None);
                                                let exists = custom_settings()
                                                    .iter()
                                                    .any(|item| item.eq_ignore_ascii_case(&setting));
                                                if !exists {
                                                    custom_settings.write().push(setting.clone());
                                                }
                                                click_custom_setting(setting);
                                            }
                                            Err(msg) => error_msg.set(Some(msg)),
                                        }
                                    }
                                },
                                "Telepon Now"
                            }
                        }
                    }

                    if !custom_scenarios.is_empty() {
                        div { class: "mt-6 text-left p-6 bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-700 rounded-2xl shadow-sm",
                            p { class: "text-sm font-bold text-slate-700 dark:text-slate-300 mb-3",
                                "Pernah Anda hubungi:"
                            }
                            div { class: "flex flex-wrap gap-2.5",
                                for scenario in custom_scenarios {
                                    button {
                                        key: "{scenario}",
                                        r#type: "button",
                                        class: "bg-white dark:bg-slate-900 hover:bg-emerald-50 border border-slate-300 hover:border-emerald-400 text-slate-700 dark:text-slate-300 hover:text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm",
                                        onclick: {
                                            let mut click_custom_setting = start_voice_session.clone();
                                            let scenario_for_click = scenario.clone();
                                            move |_| click_custom_setting(scenario_for_click.clone())
                                        },
                                        "{scenario}"
                                    }
                                }
                            }
                        }
                    }

                    if let Some(err) = error_msg() {
                        p { class: "text-xs text-rose-600 dark:text-rose-400 font-bold mt-6 bg-rose-50/30 dark:bg-rose-900/30 p-3 rounded-xl border border-rose-200 shadow-sm",
                            "{err}"
                        }
                    }
                }
            }
        };
    }

    // TAMPILAN 2: Tampilan Panggilan Aktif (Voice Call Screen)
    let setting_title = selected_setting().unwrap_or_default();
    let current_status = voice_status();

    // Hitung status visual
    let status_label = match current_status.as_str() {
        "menghubungkan" => "Menghubungkan asisten AI...",
        "mendengarkan" => "Silakan berbicara... (AI Mendengarkan)",
        "berpikir" => "AI sedang berpikir...",
        "berbicara" => "AI sedang berbicara...",
        "muted" => "Mikrofon Dinonaktifkan (Muted)",
        _ => "Menunggu..."
    };



    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col justify-between pt-20 pb-8 px-4 md:px-8 font-sans",
            div { class: "max-w-md w-full mx-auto flex-1 flex flex-col justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] shadow-2xl p-6 md:p-8 relative overflow-hidden min-h-[650px]",

                // Gelombang background
                div { class: "absolute -inset-20 opacity-10 pointer-events-none select-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-200 via-transparent to-transparent" }

                // Top Header info
                div { class: "flex justify-between items-center z-10 bg-slate-50 dark:bg-slate-950 border border-slate-100/50 dark:border-slate-800 p-3 rounded-2xl shadow-sm",
                    div { class: "flex items-center gap-3",
                        span { class: "h-3 w-3 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" }
                        p { class: "text-xs font-extrabold tracking-widest text-slate-600 dark:text-slate-400 uppercase",
                            "Live Voice"
                        }
                    }
                    span { class: "text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-teal-600 dark:text-teal-400 px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm",
                        "{active_level} - {language}"
                    }
                }

                // Central Pulse Call Interface
                div { class: "flex-1 flex flex-col justify-center items-center py-8 z-10",
                    h3 { class: "text-2xl font-black text-slate-800 dark:text-slate-200 mb-2 text-center",
                        "{setting_title}"
                    }
                    p { class: "text-sm text-slate-500 dark:text-slate-400 font-medium mb-10 text-center",
                        "Partner Belajar Bahasa Asing"
                    }

                    // Glowing Circle Avatar (Realistis)
                    div {
                        class: format!(
                            "h-48 w-48 rounded-full border-[4px] flex items-center justify-center transition-all duration-700 shadow-2xl relative overflow-hidden {}",
                            match current_status.as_str() {
                                "menghubungkan" => "border-indigo-400 shadow-indigo-200",
                                "mendengarkan" => "border-emerald-400 shadow-emerald-200 animate-pulse",
                                "berpikir" => "border-amber-400 shadow-amber-200",
                                "berbicara" => "border-teal-400 shadow-teal-200 scale-105",
                                "muted" => "border-rose-400 shadow-rose-200 opacity-50",
                                _ => "border-slate-200 dark:border-slate-700",
                            },
                        ),
                        
                        img {
                            class: "w-full h-full object-cover",
                            src: if current_status == "berbicara" {
                                if is_male_voice() {
                                    asset!("/assets/avatar_male_talking.gif")
                                } else {
                                    asset!("/assets/avatar_female_talking.gif")
                                }
                            } else {
                                if is_male_voice() {
                                    asset!("/assets/avatar_male_idle.png")
                                } else {
                                    asset!("/assets/avatar_female_idle.png")
                                }
                            },
                            alt: "AI Tutor Avatar"
                        }

                        // Gelombang ekstra jika sedang didengarkan/berbicara
                        if current_status == "mendengarkan" {
                            div { class: "absolute inset-0 rounded-full bg-emerald-400/20 animate-ping opacity-75" }
                        }
                        if current_status == "berbicara" {
                            div { class: "absolute inset-0 rounded-full bg-teal-400/20 animate-ping opacity-75" }
                        }
                        
                        if current_status == "muted" {
                            div { class: "absolute inset-0 bg-slate-900/60 flex items-center justify-center",
                                span { class: "text-4xl", "🔇" }
                            }
                        }
                    }

                    // Subtitle AI di bawah avatar
                    if !ai_caption().is_empty() {
                        div { class: "mt-6 px-4 py-2 bg-teal-600 dark:bg-teal-700 text-white font-extrabold text-lg sm:text-xl rounded-2xl shadow-lg shadow-teal-500/30 text-center min-w-[80%] max-w-[100%] leading-snug tracking-wide border-2 border-teal-500 dark:border-teal-600 animate-[fade-in_0.3s_ease-out]",
                            "{ai_caption}"
                        }
                    } else if current_status == "menghubungkan" || current_status == "berpikir" {
                         div { class: "mt-6 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium text-sm rounded-2xl text-center min-w-[60%] animate-pulse",
                            "..."
                        }
                    } else {
                        // Empty spacer
                        div { class: "mt-6 h-10" }
                    }

                    // Teks Status
                    p {
                        class: format!(
                            "text-sm font-bold mt-10 transition-colors duration-300 bg-white dark:bg-slate-900 px-4 py-2 rounded-full border shadow-sm {}",
                            match current_status.as_str() {
                                "mendengarkan" => "text-emerald-600 border-emerald-100",
                                "berpikir" => "text-amber-600 dark:text-amber-400 border-amber-100",
                                "berbicara" => {
                                    "text-teal-600 dark:text-teal-400 border-teal-100/50 dark:border-teal-900/50"
                                }
                                "muted" => {
                                    "text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50"
                                }
                                _ => {
                                    "text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                }
                            },
                        ),
                        "{status_label}"
                    }
                }

                // Scrolling Transkrip / Captions (Kanal Teks Instan)
                div { class: "w-full max-h-40 overflow-y-auto mb-8 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm border border-slate-200/30 dark:border-slate-700 rounded-2xl p-5 space-y-3 z-10 text-sm shadow-inner",
                    if !user_caption().is_empty() {
                        div { class: "flex flex-col gap-1",
                            span { class: "text-[10px] text-teal-600 dark:text-teal-400 uppercase tracking-widest font-black",
                                "Anda berkata"
                            }
                            p { class: "text-slate-700/30 dark:text-slate-300 italic font-medium leading-relaxed",
                                "\"{user_caption}\""
                            }
                        }
                    }
                    // (Subtitle AI sekarang diletakkan di bawah avatar, bukan di sini)
                    if !ai_feedback().is_empty() {
                        div { class: "mt-2 p-3 bg-amber-50/30 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-900/50 rounded-xl shadow-sm text-xs sm:text-sm text-amber-900 flex flex-col gap-1",
                            div { class: "flex items-center gap-1.5 font-bold text-amber-700",
                                span { "💡" }
                                span { "Koreksi AI" }
                            }
                            p { class: "whitespace-pre-wrap font-medium", "{ai_feedback}" }
                        }
                    }
                    if user_caption().is_empty() && ai_caption().is_empty() && ai_feedback().is_empty() {
                        p { class: "text-center text-slate-500 dark:text-slate-400 py-4 font-medium",
                            "Transkrip ucapan akan muncul di sini..."
                        }
                    }
                }

                // Control panel
                div { class: "flex justify-center items-center gap-8 z-10 pt-2",

                    // Tombol Mute
                    button {
                        r#type: "button",
                        class: format!(
                            "h-16 w-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-md {}",
                            if is_muted() {
                                "bg-rose-50/30 dark:bg-rose-900/30 border-rose-200 text-rose-500"
                            } else {
                                "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200"
                            },
                        ),
                        onclick: handle_mute_toggle,
                        title: "Mute/Unmute",
                        span { class: "text-2xl",
                            if is_muted() {
                                "🎙️"
                            } else {
                                "🔇"
                            }
                        }
                    }

                    // Tombol Tutup Panggilan (Hang Up)
                    button {
                        r#type: "button",
                        class: "h-20 w-20 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all duration-300 hover:scale-110 active:scale-90",
                        onclick: handle_hang_up,
                        title: "Tutup Panggilan",
                        span { class: "text-3xl drop-shadow-md", "📞" }
                    }
                }

                // Panel Error ringkas
                if let Some(err) = error_msg() {
                    div { class: "absolute top-20 inset-x-6 z-20 bg-rose-100/90 backdrop-blur-md text-rose-800 text-sm font-bold p-4 rounded-2xl border border-rose-300 text-center shadow-xl animate-bounce flex justify-between items-center gap-3",
                        span { "{err}" }
                        button {
                            class: "font-black bg-rose-200 text-rose-800 rounded-full h-6 w-6 flex items-center justify-center hover:bg-rose-300 transition-colors",
                            onclick: move |_| error_msg.set(None),
                            "×"
                        }
                    }
                }
            }
        }
    }
}
