// src/views/forgot_password.rs
use dioxus::prelude::*;
use crate::routes::Route;
use crate::services::auth::send_reset_password_email;

#[component]
pub fn ForgotPassword() -> Element {
    let mut email_input = use_signal(String::new);
    let mut is_loading = use_signal(|| false);
    let mut status_message = use_signal(|| Option::<(bool, String)>::None); // (is_error, message)

    let handle_submit = move |_| async move {
        if is_loading() {
            return;
        }
        let email = email_input();
        if email.trim().is_empty() {
            status_message.set(Some((true, "Email tidak boleh kosong!".to_string())));
            return;
        }

        is_loading.set(true);
        status_message.set(None);

        match send_reset_password_email(email).await {
            Ok(msg) => {
                status_message.set(Some((false, msg)));
                email_input.set(String::new());
                is_loading.set(false);
            }
            Err(err) => {
                status_message.set(Some((true, err.to_string())));
                is_loading.set(false);
            }
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

                h2 { class: "text-3xl font-extrabold text-teal-600 dark:text-teal-400 mb-2",
                    "Lupa Password"
                }
                p { class: "text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium",
                    "Masukkan email Anda untuk menerima tautan reset password."
                }

                if let Some((is_error, msg)) = status_message() {
                    div {
                        class: format!(
                            "mb-4 p-3 border rounded-lg text-xs text-left font-semibold flex items-start gap-2 {}",
                            if is_error {
                                "bg-rose-50/30 dark:bg-rose-900/30 border-rose-200 text-rose-600 dark:text-rose-400"
                            } else {
                                "bg-emerald-50 border-emerald-200 text-emerald-600"
                            },
                        ),
                        span { class: "shrink-0",
                            if is_error {
                                "⚠️"
                            } else {
                                "✅"
                            }
                        }
                        span { "{msg}" }
                    }
                }

                // Input Email
                div { class: "mb-6 text-left",
                    label { class: "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2",
                        "Email"
                    }
                    input {
                        r#type: "email",
                        class: "w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
                        placeholder: "email@contoh.com",
                        value: "{email_input}",
                        disabled: is_loading(),
                        oninput: move |e| email_input.set(e.value()),
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
                        },
                    ),
                    disabled: is_loading(),
                    onclick: handle_submit,
                    if is_loading() {
                        div { class: "flex items-center gap-2",
                            div { class: "animate-spin rounded-full h-4 w-4 border-2 border-teal-600 border-t-transparent" }
                            span { "Mengirim Tautan..." }
                        }
                    } else {
                        span { "Kirim Link Reset 🚀" }
                    }
                }

                div { class: "text-xs text-slate-500 dark:text-slate-400 pt-5 border-t border-slate-100 dark:border-slate-800 mt-6",
                    span { "Ingat password Anda? " }
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
