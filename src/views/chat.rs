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
    let custom_settings = use_signal(Vec::<String>::new);

    let user_for_setup = email.clone();
    let lang_for_setup = language.clone();
    let lvl_for_setup = active_level.clone();
    let goal_for_setup = goal.clone();

    let handle_select_setting = move |setting: String| {
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

    let mut auto_start_fn = handle_select_setting.clone();
    let auto_goal = goal.clone();
    let current_setting = selected_setting;
    let is_loading_val = is_loading;
    use_effect(move || {
        if auto_goal != "Bebas" && current_setting().is_none() && !is_loading_val() {
            auto_start_fn(auto_goal.clone());
        }
    });

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
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-4 md:p-8 flex flex-col justify-center items-center font-sans",
                div { class: "max-w-4xl w-full bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-700 rounded-3xl p-6 md:p-10 shadow-xl text-center",
                    span { class: "text-xs font-bold bg-teal-50/30 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border border-teal-100/50 dark:border-teal-900/50 px-4 py-1.5 rounded-full uppercase tracking-wider mb-4 inline-block shadow-sm", "Mode Roleplay - {language}" }
                    p { class: "text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium", "Global language: ", span { class: "text-teal-600 dark:text-teal-400 font-bold", "{selected_language}" } }
                    h2 { class: "text-3xl font-extrabold text-slate-800 dark:text-slate-200 mb-3", "Pilih Skenario Obrolan" }
                    p { class: "text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed font-medium max-w-2xl mx-auto", "Pilih skenario siap pakai atau tambah skenario custom. Partner AI menyesuaikan tingkat {active_level}." }

                    div { class: "grid grid-cols-1 sm:grid-cols-2 gap-4",
                        for (setting_key, title, desc) in preset_scenarios {
                            button {
                                key: "{setting_key}",
                                class: "w-full bg-white dark:bg-slate-900 border-2 border-slate-100/30 dark:border-slate-800 hover:border-teal-400 hover:bg-teal-50/30 dark:bg-teal-900/30/50 p-5 rounded-2xl text-left font-bold text-sm transition-all flex justify-between items-start gap-4 group shadow-sm hover:shadow-md",
                                onclick: {
                                    let mut click_setting = handle_select_setting.clone();
                                    let scenario_name = setting_key.to_string();
                                    move |_| click_setting(scenario_name.clone())
                                },
                                div {
                                    p { class: "text-slate-800 dark:text-slate-200 group-hover:text-teal-700 transition-colors text-base", "{title}" }
                                    p { class: "text-xs text-slate-500 dark:text-slate-400 font-medium mt-1.5 leading-relaxed", "{desc}" }
                                }
                                span { class: "text-slate-400 group-hover:text-teal-500 transition-colors mt-0.5", "->" }
                            }
                        }
                    }

                    div { class: "mt-8 p-6 rounded-2xl border-2 border-slate-100/20 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-left shadow-inner",
                        p { class: "text-sm font-extrabold text-teal-700 uppercase tracking-wider mb-2", "Tambah Skenario Sendiri" }
                        p { class: "text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium", "Contoh: Interview Kerja, Imigrasi, Dokter Gigi, Presentasi Kampus" }
                        div { class: "flex flex-col sm:flex-row gap-3",
                            input {
                                r#type: "text",
                                class: "flex-1 bg-white dark:bg-slate-900 border border-slate-300 hover:border-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none transition-all placeholder-slate-400 shadow-sm",
                                placeholder: "Tulis nama skenario custom...",
                                value: "{custom_setting_input}",
                                maxlength: 50,
                                oninput: move |e| custom_setting_input.set(e.value()),
                            }
                            button {
                                r#type: "button",
                                class: "bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm hover:shadow-md",
                                onclick: handle_add_custom_setting,
                                "Tambah"
                            }
                            button {
                                r#type: "button",
                                class: "bg-teal-500 hover:bg-teal-600 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm hover:shadow-md",
                                onclick: handle_start_custom_setting,
                                "Mulai"
                            }
                        }
                    }

                    if !custom_scenarios.is_empty() {
                        div { class: "mt-6 text-left p-6 bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-700 rounded-2xl shadow-sm",
                            p { class: "text-sm font-bold text-slate-700 dark:text-slate-300 mb-3", "Skenario custom Anda:" }
                            div { class: "flex flex-wrap gap-2.5",
                                for scenario in custom_scenarios {
                                    button {
                                        key: "{scenario}",
                                        r#type: "button",
                                        class: "bg-white dark:bg-slate-900 hover:bg-teal-50/30 dark:bg-teal-900/30 border border-slate-300 hover:border-teal-400 text-slate-700 dark:text-slate-300 hover:text-teal-700 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm",
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
                        div { class: "mt-6 text-sm font-bold text-teal-600 dark:text-teal-400 animate-pulse", "Menyiapkan sesi roleplay..." }
                    }

                    if let Some(err) = error_msg() {
                        p { class: "text-xs text-rose-600 dark:text-rose-400 font-bold mt-6 bg-rose-50/30 dark:bg-rose-900/30 p-3 rounded-xl border border-rose-200 shadow-sm", "{err}" }
                    }
                }
            }
        };
    }

    let setting_title = selected_setting().unwrap_or_default();
    let messages_list = chat_messages.cloned();

    let mapped_messages = messages_list.iter().map(|msg| {
        let content_str = msg.content.clone();
        let (main_text, feedback_text) = if msg.sender == "ai" && content_str.contains("Koreksi:") {
            let mut parts = content_str.splitn(2, "Koreksi:");
            let main = parts.next().unwrap_or("").trim().to_string();
            let feedback = parts.next().unwrap_or("").trim().to_string();
            (main, Some(feedback))
        } else {
            (content_str, None)
        };
        (msg.clone(), main_text, feedback_text)
    }).collect::<Vec<_>>();

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col justify-between pt-20 pb-8 px-4 md:px-8 font-sans",
            div { class: "max-w-4xl w-full mx-auto flex-1 flex flex-col justify-between bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700 rounded-3xl shadow-xl overflow-hidden min-h-[600px]",
                div { class: "bg-slate-50 dark:bg-slate-950 p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center",
                    div { class: "flex items-center gap-4",
                        div { class: "h-3.5 w-3.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" }
                        div {
                            h3 { class: "text-base font-extrabold text-slate-800 dark:text-slate-200", "Simulasi Peran: {setting_title}" }
                            p { class: "text-xs text-slate-500 dark:text-slate-400 font-bold tracking-wide mt-0.5", "{language} - {active_level}" }
                            p { class: "text-[10px] text-teal-600 dark:text-teal-400 font-bold mt-0.5", "Global language: {selected_language}" }
                        }
                    }
                    Link { to: Route::Dashboard {}, class: "text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-white hover:bg-slate-800 bg-white dark:bg-slate-900 border border-slate-300 px-4 py-2 rounded-xl transition-all shadow-sm", "Keluar Sesi" }
                }

                div { class: "flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/50 dark:bg-slate-950/50",
                    if messages_list.is_empty() && is_loading() {
                        div { class: "flex justify-center items-center h-full mt-20",
                            div { class: "animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-500" }
                        }
                    }

                    for (msg, main_text, feedback_text) in mapped_messages {
                        div {
                            key: "{msg.id}",
                            class: format!("flex w-full {}", if msg.sender == "user" { "justify-end" } else { "justify-start" }),
                            div {
                                class: format!(
                                    "max-w-[85%] sm:max-w-[80%] flex flex-col gap-2 {}",
                                    if msg.sender == "user" { "items-end" } else { "items-start" }
                                ),
                                div {
                                    class: format!(
                                        "rounded-2xl p-5 text-sm sm:text-base leading-relaxed whitespace-pre-wrap shadow-sm {}",
                                        if msg.sender == "user" {
                                            "bg-teal-500 text-white font-medium rounded-tr-none"
                                        } else {
                                            "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/30 dark:border-slate-700 font-medium rounded-tl-none shadow-md"
                                        }
                                    ),
                                    "{main_text}"
                                }

                                if let Some(feedback) = feedback_text {
                                    if !feedback.is_empty() {
                                        div { class: "mt-1 p-4 bg-amber-50/30 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-900/50 rounded-xl rounded-tl-none shadow-sm text-sm text-amber-900",
                                            div { class: "flex items-center gap-2 mb-2 font-bold text-amber-700",
                                                span { class: "text-lg", "💡" }
                                                span { "Koreksi AI" }
                                            }
                                            div { class: "whitespace-pre-wrap font-medium",
                                                "{feedback}"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if is_loading() {
                        div { class: "flex justify-start items-center gap-3 text-slate-500 dark:text-slate-400 text-sm font-medium bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl border border-slate-200/20 dark:border-slate-700 w-fit animate-pulse shadow-sm",
                            div { class: "h-2 w-2 bg-teal-500 rounded-full animate-bounce shadow-sm" }
                            "Partner AI sedang mengetik..."
                        }
                    }
                }

                div { class: "p-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700",
                    form {
                        class: "flex gap-3 items-center",
                        onsubmit: handle_send_message,

                        input {
                            r#type: "text",
                            class: "flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 hover:border-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-xl px-5 py-4 text-base text-slate-800 dark:text-slate-200 focus:outline-none transition-all placeholder-slate-400 disabled:opacity-50 shadow-inner",
                            placeholder: "Ketik balasan dalam bahasa {language}...",
                            value: "{input_text}",
                            disabled: is_loading(),
                            oninput: move |e| input_text.set(e.value()),
                        }
                        button {
                            r#type: "submit",
                            class: "bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 text-white disabled:text-slate-500 dark:text-slate-400 font-bold px-8 py-4 rounded-xl text-base transition-all shadow-md hover:shadow-lg cursor-pointer",
                            disabled: input_text().trim().is_empty() || is_loading(),
                            "Kirim"
                        }
                    }
                    if let Some(err) = error_msg() {
                        p { class: "text-xs text-rose-600 dark:text-rose-400 mt-3 text-center font-bold bg-rose-50/30 dark:bg-rose-900/30 p-2 rounded-lg border border-rose-100 dark:border-rose-900/50", "{err}" }
                    }
                }
            }
        }
    }
}
