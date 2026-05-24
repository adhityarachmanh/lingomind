// src/views/login.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::services::auth::login_user;
use crate::routes::Route;

#[component]
pub fn Login() -> Element {
    let mut email_input = use_signal(String::new);
    let mut password_input = use_signal(String::new);
    let mut show_password = use_signal(|| false); 
    let mut error_message = use_signal(|| Option::<String>::None);
    let mut is_unverified = use_signal(|| false);
    let mut resend_message = use_signal(|| Option::<String>::None);
    let mut is_loading = use_signal(|| false); 
    
    // PERBAIKAN: Sesuaikan tipe data context pembungkus menjadi format tuple
    let mut user_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let navigator = use_navigator();

    // Redirect ke dashboard jika sudah login
    use_effect(move || {
        let (user_opt, _) = user_state();
        if user_opt.is_some() {
            navigator.push(Route::Dashboard {});
        }
    });

    let handle_login = move |_| async move {
        if is_loading() { return; }

        error_message.set(None);
        resend_message.set(None);

        let email = email_input();
        let password = password_input();

        if email.trim().is_empty() || password.is_empty() {
            error_message.set(Some("Email dan password tidak boleh kosong!".to_string()));
            return;
        }

        is_loading.set(true);

        match login_user(email, password).await {
            Ok(profile) => {
                // PERBAIKAN: Set state dalam bentuk tuple agar status inisialisasi tetap bernilai true
                user_state.set((Some(profile), true));
                is_loading.set(false); 
                navigator.push(Route::Dashboard {});
            }
            Err(err) => {
                is_loading.set(false); 
                let err_str = err.to_string();
                if err_str.starts_with("UNVERIFIED:") {
                    is_unverified.set(true);
                    error_message.set(Some(err_str.replace("UNVERIFIED:", "")));
                } else {
                    is_unverified.set(false);
                    error_message.set(Some(err_str));
                }
            }
        }
    };

    let handle_resend_email = move |_| async move {
        let email = email_input();
        if email.trim().is_empty() { return; }
        
        resend_message.set(Some("Mengirim ulang email...".to_string()));
        match crate::services::auth::resend_verification_email_server(email).await {
            Ok(msg) => resend_message.set(Some(msg)),
            Err(e) => resend_message.set(Some(format!("Gagal: {}", e))),
        }
    };

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col justify-center items-center p-6 font-sans",
            div { class: "bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-200 dark:border-slate-700 text-center",
                
                img {
                    src: asset!("/assets/logo.png"),
                    alt: "LingoMind Logo",
                    class: "w-20 h-20 rounded-3xl mx-auto mb-4 shadow-md object-cover border border-slate-100/30 dark:border-slate-800",
                }
                h2 { class: "text-3xl font-extrabold text-teal-600 dark:text-teal-400 mb-2", "Welcome Back" }
                p { class: "text-slate-500/30 dark:text-slate-400 text-sm mb-6 font-medium", "Learn English & German powered by Gemini AI" }
                
                if let Some(msg) = error_message() {
                    div { class: "mb-4 p-3 bg-rose-50/30 dark:bg-rose-900/30 border border-rose-200 rounded-lg text-rose-600 dark:text-rose-400 text-xs text-left font-semibold flex flex-col gap-2",
                        div { class: "flex items-center gap-2",
                            "⚠️ {msg}"
                        }
                        if is_unverified() {
                            button {
                                class: "mt-1 self-start text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 hover:underline bg-transparent border-none cursor-pointer p-0",
                                onclick: handle_resend_email,
                                "Kirim ulang email verifikasi"
                            }
                        }
                    }
                }
                
                if let Some(msg) = resend_message() {
                    div { class: "mb-4 p-3 bg-teal-50/30 dark:bg-teal-900/30 border border-teal-200 rounded-lg text-teal-700 text-xs text-left font-semibold flex items-center gap-2",
                        "📩 {msg}"
                    }
                }

                // Input Email
                div { class: "mb-4 text-left",
                    label { class: "block text-xs font-bold text-slate-500/20 dark:text-slate-400 uppercase tracking-wider mb-2", "Email" }
                    input {
                        r#type: "email",
                        class: "w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
                        placeholder: "Masukkan email Anda...",
                        value: "{email_input}",
                        disabled: is_loading(),
                        oninput: move |e| email_input.set(e.value()),
                    }
                }

                // Input Password
                div { class: "mb-6 text-left",
                    div { class: "flex justify-between items-center mb-2",
                        label { class: "block text-xs font-bold text-slate-500/20 dark:text-slate-400 uppercase tracking-wider", "Password" }
                        Link {
                            to: Route::ForgotPassword {},
                            class: "text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline",
                            "Lupa Password?"
                        }
                    }
                    div { class: "relative flex items-center",
                        input {
                            r#type: if show_password() { "text" } else { "password" },
                            class: "w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl pl-4 pr-12 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
                            placeholder: "Masukkan password...",
                            value: "{password_input}",
                            disabled: is_loading(),
                            oninput: move |e| password_input.set(e.value()),
                        }
                        button {
                            r#type: "button",
                            class: "absolute right-4 text-slate-400 hover:text-teal-600 dark:text-teal-400 text-xs font-bold select-none bg-transparent border-none cursor-pointer disabled:opacity-30 transition-colors",
                            disabled: is_loading(),
                            onclick: move |_| show_password.set(!show_password()),
                            if show_password() { "HIDE" } else { "SHOW" }
                        }
                    }
                }
                
                // Tombol Submit
                button {
                    class: format!(
                        "w-full font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-md flex justify-center items-center gap-2 {}",
                        if is_loading() {
                            "bg-teal-100 text-teal-800 cursor-not-allowed opacity-80"
                        } else {
                            "bg-teal-500 hover:bg-teal-600 text-white hover:shadow-lg hover:shadow-teal-500/30"
                        }
                    ),
                    disabled: is_loading(), 
                    onclick: handle_login,
                    if is_loading() {
                        div { class: "flex items-center gap-2",
                            div { class: "animate-spin rounded-full h-4 w-4 border-2 border-teal-600 border-t-transparent" }
                            span { "Memverifikasi Akun..." }
                        }
                    } else {
                        span { "Masuk ke Aplikasi 🚀" }
                    }
                }

                div { class: "text-xs text-slate-500 dark:text-slate-400 pt-5 border-t border-slate-100 dark:border-slate-800 mt-6",
                    span { "Belum punya akun? " }
                    Link { 
                        to: Route::Register {},
                        class: "text-teal-600 dark:text-teal-400 font-bold hover:underline",
                        "Daftar sekarang"
                    }
                }
            }
        }
    }
}
