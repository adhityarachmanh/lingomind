// src/views/register.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::services::auth::register_user;
use crate::routes::Route;

#[component]
pub fn Register() -> Element {
    let mut full_name_input = use_signal(String::new);
    let mut email_input = use_signal(String::new);
    let mut password_input = use_signal(String::new);
    let mut confirm_password_input = use_signal(String::new);
    
    // Status visibility password masing-masing kolom input
    let mut show_password = use_signal(|| false);
    let mut show_confirm_password = use_signal(|| false);
    
    let mut error_message = use_signal(|| Option::<String>::None);
    let mut is_success_msg = use_signal(|| Option::<String>::None);
    let mut is_loading = use_signal(|| false); 
    
    // PERBAIKAN: Sesuaikan tipe data context pembungkus menjadi format tuple
    let user_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let navigator = use_navigator();

    // Redirect ke dashboard jika sudah login
    use_effect(move || {
        let (user_opt, _) = user_state();
        if user_opt.is_some() {
            navigator.push(Route::Dashboard {});
        }
    });

    let handle_register = move |_| async move {
        if is_loading() { return; } 

        error_message.set(None);

        let email = email_input();
        let password = password_input();
        let confirm_password = confirm_password_input();

        let full_name = full_name_input();

        if full_name.trim().is_empty() || email.trim().is_empty() || password.is_empty() || confirm_password.is_empty() {
            error_message.set(Some("Seluruh kolom input wajib diisi!".to_string()));
            return;
        }

        if password.len() < 6 {
            error_message.set(Some("Password minimal harus berukuran 6 karakter!".to_string()));
            return;
        }

        if password != confirm_password {
            error_message.set(Some("Konfirmasi password tidak cocok dengan password utama!".to_string()));
            return;
        }

        is_loading.set(true);

        match register_user(full_name, email, password).await {
            Ok(msg) => {
                is_success_msg.set(Some(msg));
                is_loading.set(false);
            }
            Err(err) => {
                is_loading.set(false); 
                error_message.set(Some(err.to_string()));
            }
        }
    };

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col justify-center items-center p-6",
            div { class: "bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-700 text-center",
                
                img {
                    src: asset!("/assets/logo.png"),
                    alt: "LingoMind Logo",
                    class: "w-20 h-20 rounded-3xl mx-auto mb-4 shadow-md object-cover border border-slate-100/30 dark:border-slate-800",
                }
                h2 { class: "text-3xl font-extrabold text-teal-600 dark:text-teal-400 mb-2", "Join LingoMind" }
                p { class: "text-slate-500/30 dark:text-slate-400 font-medium text-sm mb-6", "Create an account to track your study scores" }
                
                if let Some(msg) = is_success_msg() {
                    div { class: "py-6",
                        div { class: "w-16 h-16 bg-teal-100 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl", "📩" }
                        h3 { class: "text-xl font-bold text-slate-800 dark:text-slate-200 mb-2", "Cek Email Anda" }
                        p { class: "text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6", "{msg}" }
                        Link {
                            to: Route::Login {},
                            class: "block w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg",
                            "Kembali ke Halaman Login"
                        }
                    }
                } else {
                    if let Some(msg) = error_message() {
                        div { class: "mb-4 p-3 bg-rose-50/30 dark:bg-rose-900/30 border border-rose-200 rounded-lg text-rose-600 dark:text-rose-400 text-xs text-left font-semibold flex items-center gap-2",
                            "⚠️ {msg}"
                        }
                    }

                    div { class: "mb-4 text-left",
                        label { class: "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2", "Nama Lengkap" }
                        input {
                            class: "w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
                            placeholder: "Masukkan nama lengkap...",
                            value: "{full_name_input}",
                            disabled: is_loading(),
                            oninput: move |e| full_name_input.set(e.value()),
                        }
                    }

                    div { class: "mb-4 text-left",
                        label { class: "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2", "Email" }
                        input {
                            r#type: "email",
                            class: "w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
                            placeholder: "Masukkan email aktif Anda...",
                            value: "{email_input}",
                            disabled: is_loading(),
                            oninput: move |e| email_input.set(e.value()),
                        }
                    }

                    // Input Password Utama
                    div { class: "mb-4 text-left",
                        label { class: "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2", "Password" }
                        div { class: "relative flex items-center",
                            input {
                                r#type: if show_password() { "text" } else { "password" },
                                class: "w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl pl-4 pr-12 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
                                placeholder: "Buat password aman...",
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
                        span { class: "text-[10px] text-slate-500 dark:text-slate-400 mt-1 block font-medium", "Minimal panjang password adalah 6 karakter." }
                    }

                    // Input Konfirmasi Password
                    div { class: "mb-6 text-left",
                        label { class: "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2", "Confirm Password" }
                        div { class: "relative flex items-center",
                            input {
                                r#type: if show_confirm_password() { "text" } else { "password" },
                                class: "w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl pl-4 pr-12 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
                                placeholder: "Ulangi password...",
                                value: "{confirm_password_input}",
                                disabled: is_loading(),
                                oninput: move |e| confirm_password_input.set(e.value()),
                            }
                            button {
                                r#type: "button",
                                class: "absolute right-4 text-slate-400 hover:text-teal-600 dark:text-teal-400 text-xs font-bold select-none bg-transparent border-none cursor-pointer disabled:opacity-30 transition-colors",
                                disabled: is_loading(),
                                onclick: move |_| show_confirm_password.set(!show_confirm_password()),
                                if show_confirm_password() { "HIDE" } else { "SHOW" }
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
                        onclick: handle_register,
                        if is_loading() {
                            div { class: "flex items-center gap-2",
                                div { class: "animate-spin rounded-full h-4 w-4 border-2 border-teal-600 border-t-transparent" }
                                span { "Mendaftarkan Akun Baru..." }
                            }
                        } else {
                            span { "Buat Akun Baru 🎉" }
                        }
                    }
                }

                div { class: "text-xs text-slate-500 dark:text-slate-400 pt-5 border-t border-slate-100 dark:border-slate-800 mt-6",
                    span { "Sudah punya akun? " }
                    Link { 
                        to: Route::Login {},
                        class: "text-teal-600 dark:text-teal-400 font-bold hover:underline",
                        "Login di sini"
                    }
                }
            }
        }
    }
}
