use dioxus::prelude::*;
use crate::models::chat::ChatMessage;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::gemini::chat::{get_or_create_session_server, send_chat_message_server};

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
pub fn ChatRoleplay(goal: String) -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, _is_ready) = session_state();

    let language = selected_language();
    let active_level = user_opt
        .as_ref()
        .and_then(|u| u.current_level.get(&language).cloned())
        .unwrap_or_else(|| "A1".to_string());
    let email = user_opt.as_ref().map(|u| u.email.clone()).unwrap_or_default();

    let mut selected_setting = use_signal(|| None::<String>);
    let mut session_id = use_signal(|| 0_i32);
    let mut chat_messages = use_signal(Vec::<ChatMessage>::new);
    let mut input_text = use_signal(|| "".to_string());
    let mut is_loading = use_signal(|| false);
    let mut error_msg = use_signal(|| None::<String>);
    let mut custom_setting_input = use_signal(String::new);
    let mut custom_settings = use_signal(Vec::<String>::new);

    let user_for_setup = email.clone();
    let lang_for_setup = language.clone();
    let lvl_for_setup = active_level.clone();
    let goal_for_setup = goal.clone();

    let mut handle_select_setting = move |setting: String| {
        let user = user_for_setup.clone();
        let lang = lang_for_setup.clone();
        let lvl = lvl_for_setup.clone();
        let goal_value = goal_for_setup.clone();
        selected_setting.set(Some(setting.clone()));
        error_msg.set(None);
        chat_messages.set(Vec::new());
        session_id.set(0);
        is_loading.set(true);

        spawn(async move {
            match get_or_create_session_server(user, lang, lvl, goal_value, setting).await {
                Ok(bootstrap) => {
                    session_id.set(bootstrap.session_id);
                    chat_messages.set(bootstrap.messages);
                    is_loading.set(false);
                }
                Err(e) => {
                    error_msg.set(Some(format!("Gagal memuat sesi obrolan: {}", e)));
                    is_loading.set(false);
                }
            }
        });
    };

    let lang_for_send = language.clone();
    let lvl_for_send = active_level.clone();
    let goal_for_send = goal.clone();
    let email_for_send = email.clone();
    let mut custom_settings_for_add = custom_settings;
    let mut custom_input_for_add = custom_setting_input;
    let mut error_for_add = error_msg;
    let mut custom_settings_for_start = custom_settings;
    let custom_input_for_start = custom_setting_input;
    let mut error_for_start = error_msg;
    let mut start_with_custom = handle_select_setting.clone();

    let handle_send_message = move |_| {
        if input_text().trim().is_empty() || is_loading() {
            return;
        }

        if session_id() <= 0 {
            error_msg.set(Some("Sesi chat belum siap. Coba pilih ulang skenario.".to_string()));
            return;
        }

        let email_value = email_for_send.clone();
        let id = session_id();
        let lang = lang_for_send.clone();
        let lvl = lvl_for_send.clone();
        let goal_value = goal_for_send.clone();
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
            match send_chat_message_server(email_value, id, lang, lvl, goal_value, setting, msg).await {
                Ok(updated_history) => {
                    chat_messages.set(updated_history);
                    is_loading.set(false);
                }
                Err(e) => {
                    error_msg.set(Some(format!("Gagal mengirim pesan: {}", e)));
                    is_loading.set(false);
                }
            }
        });
    };

    let handle_add_custom_setting = move |_| {
        match normalize_setting_input_for_ui(&custom_input_for_add()) {
            Ok(setting) => {
                error_for_add.set(None);
                let exists = custom_settings_for_add()
                    .iter()
                    .any(|item| item.eq_ignore_ascii_case(&setting));
                if !exists {
                    custom_settings_for_add.write().push(setting);
                }
                custom_input_for_add.set(String::new());
            }
            Err(msg) => error_for_add.set(Some(msg)),
        }
    };

    let handle_start_custom_setting = move |_| {
        match normalize_setting_input_for_ui(&custom_input_for_start()) {
            Ok(setting) => {
                error_for_start.set(None);
                let exists = custom_settings_for_start()
                    .iter()
                    .any(|item| item.eq_ignore_ascii_case(&setting));
                if !exists {
                    custom_settings_for_start.write().push(setting.clone());
                }
                start_with_custom(setting);
            }
            Err(msg) => error_for_start.set(Some(msg)),
        }
    };

    if selected_setting().is_none() {
        let preset_scenarios = [
            ("Cafe", "Kasir Kedai Kopi", "Latihan memesan minuman dan membayar."),
            ("Hotel", "Resepsionis Hotel", "Latihan check-in dan tanya fasilitas hotel."),
            ("Airport", "Bandara", "Latihan check-in penerbangan dan imigrasi."),
            ("Restaurant", "Restoran", "Latihan pesan makanan dan komplain pesanan."),
            ("Office", "Meeting Kantor", "Latihan presentasi singkat dan diskusi kerja."),
            ("Shopping", "Pusat Belanja", "Latihan tanya harga, ukuran, dan negosiasi."),
            ("Hospital", "Rumah Sakit", "Latihan menjelaskan gejala dan konsultasi dokter."),
            ("Taxi", "Taksi / Ride-Hailing", "Latihan arah tujuan dan percakapan perjalanan."),
        ];
        let custom_scenarios = custom_settings();

        return rsx! {
            div { class: "min-h-screen bg-slate-950 text-white p-4 md:p-6 flex flex-col justify-center items-center",
                div { class: "max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-2xl text-center",
                    span { class: "text-xs font-extrabold bg-teal-500/10 text-teal-400 px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block", "Mode Roleplay - {language}" }
                    p { class: "text-[11px] text-slate-400 mb-2", "Global language: " span { class: "text-teal-300 font-semibold", "{selected_language}" } }
                    h2 { class: "text-2xl font-black text-slate-100 mb-2", "Pilih Skenario Obrolan" }
                    p { class: "text-slate-400 text-sm mb-5 leading-relaxed", "Pilih skenario siap pakai atau tambah skenario custom. Partner AI menyesuaikan tingkat {active_level}." }

                    div { class: "grid grid-cols-1 sm:grid-cols-2 gap-3",
                        for (setting_key, title, desc) in preset_scenarios {
                            button {
                                key: "{setting_key}",
                                class: "w-full bg-slate-950 border border-slate-800 hover:border-teal-500/40 p-4 rounded-xl text-left font-bold text-sm transition-all flex justify-between items-start gap-3 group",
                                onclick: {
                                    let mut click_setting = handle_select_setting.clone();
                                    let scenario_name = setting_key.to_string();
                                    move |_| click_setting(scenario_name.clone())
                                },
                                div {
                                    p { class: "text-slate-200 group-hover:text-teal-300 transition-colors", "{title}" }
                                    p { class: "text-xs text-slate-500 font-normal mt-1 leading-relaxed", "{desc}" }
                                }
                                span { class: "text-slate-600 group-hover:text-teal-300 transition-colors mt-0.5", "->" }
                            }
                        }
                    }

                    div { class: "mt-5 p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-left",
                        p { class: "text-xs font-extrabold text-teal-300 uppercase tracking-wider mb-2", "Tambah Skenario Sendiri" }
                        p { class: "text-xs text-slate-500 mb-3", "Contoh: Interview Kerja, Imigrasi, Dokter Gigi, Presentasi Kampus" }
                        div { class: "flex flex-col sm:flex-row gap-2",
                            input {
                                r#type: "text",
                                class: "flex-1 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-teal-500/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-all placeholder-slate-600",
                                placeholder: "Tulis nama skenario custom...",
                                value: "{custom_setting_input}",
                                maxlength: 50,
                                oninput: move |e| custom_setting_input.set(e.value()),
                            }
                            button {
                                r#type: "button",
                                class: "bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2 rounded-lg text-sm transition-colors",
                                onclick: handle_add_custom_setting,
                                "Tambah"
                            }
                            button {
                                r#type: "button",
                                class: "bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm transition-colors",
                                onclick: handle_start_custom_setting,
                                "Mulai"
                            }
                        }
                    }

                    if !custom_scenarios.is_empty() {
                        div { class: "mt-4 text-left",
                            p { class: "text-xs text-slate-400 mb-2", "Skenario custom Anda:" }
                            div { class: "flex flex-wrap gap-2",
                                for scenario in custom_scenarios {
                                    button {
                                        key: "{scenario}",
                                        r#type: "button",
                                        class: "bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-teal-500/50 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                                        onclick: {
                                            let mut click_custom_setting = handle_select_setting.clone();
                                            let scenario_for_click = scenario.clone();
                                            move |_| click_custom_setting(scenario_for_click.clone())
                                        },
                                        "{scenario}"
                                    }
                                }
                            }
                        }
                    }

                    if is_loading() {
                        div { class: "mt-4 text-xs text-slate-500 animate-pulse", "Menyiapkan sesi roleplay..." }
                    }

                    if let Some(err) = error_msg() {
                        p { class: "text-xs text-rose-400 font-semibold mt-4 bg-rose-500/10 p-2 rounded border border-rose-500/20", "{err}" }
                    }
                }
            }
        };
    }

    let setting_title = selected_setting().unwrap_or_default();
    let messages_list = chat_messages.cloned();

    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white flex flex-col justify-between pt-16 pb-6 px-4 md:px-6",
            div { class: "max-w-3xl w-full mx-auto flex-1 flex flex-col justify-between bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden min-h-[500px]",
                div { class: "bg-slate-950/60 p-4 border-b border-slate-800 flex justify-between items-center backdrop-blur-sm",
                    div { class: "flex items-center gap-3",
                        div { class: "h-3 w-3 rounded-full bg-emerald-400 animate-pulse" }
                        div {
                            h3 { class: "text-sm font-bold text-slate-100", "Simulasi Peran: {setting_title}" }
                            p { class: "text-xs text-slate-500 uppercase font-mono tracking-wider", "{language} - {active_level}" }
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
                            class: format!("flex w-full {}", if msg.sender == "user" { "justify-end" } else { "justify-start" }),
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
                            placeholder: "Ketik balasan dalam bahasa {language}...",
                            value: "{input_text}",
                            disabled: is_loading(),
                            oninput: move |e| input_text.set(e.value()),
                        }
                        button {
                            r#type: "submit",
                            class: "bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 font-bold px-5 py-3 rounded-xl text-sm transition-all shadow-md cursor-pointer",
                            disabled: input_text().trim().is_empty() || is_loading(),
                            "Kirim"
                        }
                    }
                    if let Some(err) = error_msg() {
                        p { class: "text-[11px] text-rose-400 mt-2 text-center font-medium", "{err}" }
                    }
                }
            }
        }
    }
}
