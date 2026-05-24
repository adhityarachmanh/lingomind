// src/views/reset_password.rs
use dioxus::prelude::*;
use crate::routes::Route;
use crate::services::auth::reset_password_server;

#[component]
pub fn ResetPassword(token: String) -> Element {
    let mut password_input = use_signal(String::new);
    let mut confirm_password_input = use_signal(String::new);
    let mut show_passwords = use_signal(|| false);
    
    let mut is_loading = use_signal(|| false);
    let mut status_message = use_signal(|| Option::<(bool, String)>::None); // (is_error, message)
    let mut reset_success = use_signal(|| false);

    let token_clone = token.clone();
    let handle_reset = move |_| {
        if is_loading() {
            return;
        }

        let password = password_input();
        let confirm_password = confirm_password_input();

        if password.is_empty() || confirm_password.is_empty() {
            status_message.set(Some((true, "Kata sandi baru tidak boleh kosong!".to_string())));
            return;
        }

        if password.len() < 6 {
            status_message.set(Some((true, "Kata sandi baru minimal harus berukuran 6 karakter!".to_string())));
            return;
        }

        if password != confirm_password {
            status_message.set(Some((true, "Konfirmasi kata sandi tidak cocok!".to_string())));
            return;
        }

        is_loading.set(true);
        status_message.set(None);

        let tok = token_clone.clone();
        spawn(async move {
            match reset_password_server(tok, password).await {
                Ok(msg) => {
                    status_message.set(Some((false, msg)));
                    reset_success.set(true);
                    is_loading.set(false);
                }
                Err(err) => {
                    status_message.set(Some((true, err.to_string())));
                    is_loading.set(false);
                }
            }
        });
    };

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col justify-center items-center p-6 font-sans",
            div { class: "bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-200 dark:border-slate-700 text-center",
                
                img {
                    src: asset!("/assets/logo.png"),
                    alt: "LingoMind Logo",
                    class: "w-20 h-20 rounded-3xl mx-auto mb-4 shadow-md object-cover border border-slate-100/30 dark:border-slate-800",
                }
                
                h2 { class: "text-3xl font-extrabold text-teal-600 dark:text-teal-400 mb-2", "Reset Password" }
                p { class: "text-slate-500/30 dark:text-slate-400 text-sm mb-6 font-medium", "Masukkan kata sandi baru Anda di bawah ini." }

                if let Some((is_error, msg)) = status_message() {
                    div {
                        class: format!(
                            "mb-4 p-3 border rounded-lg text-xs text-left font-semibold flex items-start gap-2 {}",
                            if is_error {
                                "bg-rose-50/30 dark:bg-rose-900/30 border-rose-200 text-rose-600 dark:text-rose-400"
                            } else {
                                "bg-emerald-50 border-emerald-200 text-emerald-600"
                            }
                        ),
                        span { class: "shrink-0", if is_error { "⚠️" } else { "✅" } }
                        span { "{msg}" }
                    }
                }

                if !reset_success() {
                    // Password Utama
                    div { class: "mb-4 text-left",
                        label { class: "block text-xs font-bold text-slate-500/20 dark:text-slate-400 uppercase tracking-wider mb-2", "Kata Sandi Baru" }
                        div { class: "relative flex items-center",
                            input {
                                r#type: if show_passwords() { "text" } else { "password" },
                                class: "w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl pl-4 pr-12 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
                                placeholder: "Buat password baru...",
                                value: "{password_input}",
                                disabled: is_loading(),
                                oninput: move |e| password_input.set(e.value()),
                            }
                            button {
                                r#type: "button",
                                class: "absolute right-4 text-slate-400 hover:text-teal-600 dark:text-teal-400 text-xs font-bold select-none bg-transparent border-none cursor-pointer disabled:opacity-30 transition-colors",
                                disabled: is_loading(),
                                onclick: move |_| show_passwords.set(!show_passwords()),
                                if show_passwords() { "HIDE" } else { "SHOW" }
                            }
                        }
                    }

                    // Konfirmasi Password
                    div { class: "mb-6 text-left",
                        label { class: "block text-xs font-bold text-slate-500/20 dark:text-slate-400 uppercase tracking-wider mb-2", "Konfirmasi Kata Sandi" }
                        input {
                            r#type: if show_passwords() { "text" } else { "password" },
                            class: "w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
                            placeholder: "Ulangi password baru...",
                            value: "{confirm_password_input}",
                            disabled: is_loading(),
                            oninput: move |e| confirm_password_input.set(e.value()),
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
                        onclick: handle_reset,
                        if is_loading() {
                            div { class: "flex items-center gap-2",
                                div { class: "animate-spin rounded-full h-4 w-4 border-2 border-teal-600 border-t-transparent" }
                                span { "Memperbarui Password..." }
                            }
                        } else {
                            span { "Reset Password Sekarang 🚀" }
                        }
                    }
                } else {
                    Link {
                        to: Route::Login {},
                        class: "block w-full text-center bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-xl transition-all text-sm shadow-md hover:shadow-lg hover:shadow-teal-500/30 cursor-pointer",
                        "Login dengan Password Baru 🚀"
                    }
                }

                if !reset_success() {
                    div { class: "text-xs text-slate-500 dark:text-slate-400 pt-5 border-t border-slate-100 dark:border-slate-800 mt-6",
                        Link {
                            to: Route::Login {},
                            class: "text-teal-600 dark:text-teal-400 font-bold hover:underline",
                            "Kembali ke Login"
                        }
                    }
                }
            }
        }
    }
}
