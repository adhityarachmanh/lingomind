// src/views/chat.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::models::chat::ChatMessage;
use crate::services::gemini::chat::{get_or_create_session_server, send_chat_message_server};
use crate::routes::Route;

#[component]
pub fn ChatRoleplay(language: String, level: String, goal: String) -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, _is_ready) = session_state();
    let email = user_opt.as_ref().map(|u| u.email.clone()).unwrap_or_default();

    let mut selected_setting = use_signal(|| None::<String>);
    let mut session_id = use_signal(|| 0_i32);
    let mut chat_messages = use_signal(|| Vec::<ChatMessage>::new());
    let mut input_text = use_signal(|| "".to_string());
    let mut is_loading = use_signal(|| false);
    let mut error_msg = use_signal(|| None::<String>);

    // Kloning variabel untuk kebutuhan handle_select_setting
    let user_for_setup = email.clone();
    let lang_for_setup = language.clone();
    let lvl_for_setup = level.clone();

    let mut handle_select_setting = move |setting: String| {
        let user = user_for_setup.clone();
        let lang = lang_for_setup.clone();
        let lvl = lvl_for_setup.clone();
        selected_setting.set(Some(setting.clone()));
        is_loading.set(true);

        spawn(async move {
            match get_or_create_session_server(user, lang, lvl, setting).await {
                Ok(id) => {
                    session_id.set(id);
                    is_loading.set(false);
                },
                Err(e) => {
                    error_msg.set(Some(format!("Gagal memuat sesi obrolan: {}", e)));
                    is_loading.set(false);
                }
            }
        });
    };

    // Kloning variabel untuk kebutuhan handle_send_message
    let lang_for_send = language.clone();
    let lvl_for_send = level.clone();
    let goal_for_send = goal.clone();

    let handle_send_message = move |_| {
        if input_text().trim().is_empty() || is_loading() { return; }

        let id = session_id();
        let lang = lang_for_send.clone();
        let lvl = lvl_for_send.clone();
        let goal = goal_for_send.clone();
        let setting = selected_setting().unwrap_or_default();
        let msg = input_text().clone();

        chat_messages.write().push(ChatMessage {
            id: 0,
            session_id: id,
            sender: "user".to_string(),
            content: msg.clone(),
        });

        input_text.set("".to_string());
        is_loading.set(true);

        spawn(async move {
            match send_chat_message_server(id, lang, lvl, goal, setting, msg).await {
                Ok(updated_history) => {
                    chat_messages.set(updated_history);
                    is_loading.set(false);
                },
                Err(e) => {
                    error_msg.set(Some(format!("Gagal mengirim pesan: {}", e)));
                    is_loading.set(false);
                }
            }
        });
    };

    if selected_setting().is_none() {
        // Buat kloning fungsi agar tombol Cafe dan Hotel bisa memanggilnya secara bergantian
        let mut click_cafe = handle_select_setting.clone();
        let mut click_hotel = handle_select_setting.clone();

        return rsx! {
            div { class: "min-h-screen bg-slate-950 text-white p-6 flex flex-col justify-center items-center",
                div { class: "max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center",
                    span { class: "text-xs font-extrabold bg-teal-500/10 text-teal-400 px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block", "Mode Roleplay • {language}" }
                    p { class: "text-[11px] text-slate-400 mb-2", "Global language: " span { class: "text-teal-300 font-semibold", "{selected_language}" } }
                    h2 { class: "text-2xl font-black text-slate-100 mb-2", "Pilih Skenario Obrolan" }
                    p { class: "text-slate-400 text-sm mb-6 leading-relaxed", "Pilih lokasi simulasi lingkungan. Gemini AI akan bertindak sebagai partner bicara Anda sesuai tingkat kesulitan {level}." }
                    
                    div { class: "flex flex-col gap-3",
                        button { 
                            class: "w-full bg-slate-950 border border-slate-800 hover:border-teal-500/40 p-4 rounded-xl text-left font-bold text-sm transition-all flex justify-between items-center group",
                            onclick: move |_| click_cafe("Cafe".to_string()),
                            div {
                                p { class: "text-slate-200 group-hover:text-teal-400 transition-colors", "☕ Kasir Kedai Kopi" }
                                p { class: "text-xs text-slate-500 font-normal mt-0.5", "Simulasi memesan minuman dan membayar di kasir." }
                            }
                            span { class: "text-slate-600 group-hover:text-teal-400 transition-colors", "→" }
                        }
                        button { 
                            class: "w-full bg-slate-950 border border-slate-800 hover:border-orange-500/40 p-4 rounded-xl text-left font-bold text-sm transition-all flex justify-between items-center group",
                            onclick: move |_| click_hotel("Hotel".to_string()),
                            div {
                                p { class: "text-slate-200 group-hover:text-orange-400 transition-colors", "🛎️ Resepsionis Hotel" }
                                p { class: "text-xs text-slate-500 font-normal mt-0.5", "Simulasi melakukan check-in kamar dan bertanya fasilitas." }
                            }
                            span { class: "text-slate-600 group-hover:text-orange-400 transition-colors", "→" }
                        }
                    }

                    if let Some(err) = error_msg() {
                        p { class: "text-xs text-rose-400 font-semibold mt-4 bg-rose-500/10 p-2 rounded border border-rose-500/20", "{err}" }
                    }
                }
            }
        };
    }

    let setting_title = selected_setting().unwrap();
    let messages_list = chat_messages.cloned();

    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white flex flex-col justify-between pt-16 pb-6 px-4 md:px-6",
            div { class: "max-w-3xl w-full mx-auto flex-1 flex flex-col justify-between bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden min-h-[500px]",
                
                div { class: "bg-slate-950/60 p-4 border-b border-slate-800 flex justify-between items-center backdrop-blur-sm",
                    div { class: "flex items-center gap-3",
                        div { class: "h-3 w-3 rounded-full bg-emerald-400 animate-pulse" }
                        div {
                            h3 { class: "text-sm font-bold text-slate-100", "Simulasi Peran: {setting_title}" }
                            p { class: "text-xs text-slate-500 uppercase font-mono tracking-wider", "{language} • {level}" }
                            p { class: "text-[10px] text-teal-300 font-semibold", "Global language: {selected_language}" }
                        }
                    }
                    Link { to: Route::Dashboard {}, class: "text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded transition-colors", "Keluar Sesi" }
                }

                div { class: "flex-1 p-4 overflow-y-auto space-y-4 bg-slate-900/40",
                    if messages_list.is_empty() && is_loading() {
                        div { class: "flex justify-center items-center h-full mt-20",
                            div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400" }
                        }
                    }

                    for msg in messages_list {
                        div { 
                            key: "{msg.id}",
                            class: format!(
                                "flex w-full {}", 
                                if msg.sender == "user" { "justify-end" } else { "justify-start" }
                            ),
                            div { 
                                class: format!(
                                    "max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap {}",
                                    if msg.sender == "user" {
                                        "bg-teal-500 text-slate-950 font-medium rounded-tr-none shadow-md shadow-teal-500/5"
                                    } else {
                                        "bg-slate-950 text-slate-200 border border-slate-800/80 rounded-tl-none"
                                    }
                                ),
                                "{msg.content}"
                            }
                        }
                    }

                    if is_loading() {
                        div { class: "flex justify-start items-center gap-2 text-slate-500 text-xs italic bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800/40 w-fit animate-pulse",
                            div { class: "h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce" }
                            "Partner AI sedang mengetik..."
                        }
                    }
                }

                div { class: "p-4 bg-slate-950/80 border-t border-slate-800 backdrop-blur-sm",
                    form { 
                        class: "flex gap-2 items-center",
                        onsubmit: handle_send_message,
                        
                        input {
                            r#type: "text",
                            class: "flex-1 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-teal-500/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all placeholder-slate-600 disabled:opacity-50",
                            placeholder: "Ketik balasan kalimat Anda dalam Bahasa {language}...",
                            value: "{input_text}",
                            disabled: is_loading(),
                            oninput: move |e| input_text.set(e.value()),
                        }
                        button {
                            r#type: "submit",
                            class: "bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 font-bold px-5 py-3 rounded-xl text-sm transition-all shadow-md cursor-pointer",
                            disabled: input_text().trim().is_empty() || is_loading(),
                            "Kirim 🚀"
                        }
                    }
                    if let Some(err) = error_msg() {
                        p { class: "text-[11px] text-rose-400 mt-2 text-center font-medium", "⚠️ {err}" }
                    }
                }
            }
        }
    }
}



