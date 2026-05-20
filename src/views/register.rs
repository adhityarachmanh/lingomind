// src/views/register.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::services::auth::register_user;
use crate::routes::Route;

#[component]
pub fn Register() -> Element {
    let mut username_input = use_signal(String::new);
    let mut password_input = use_signal(String::new);
    let mut confirm_password_input = use_signal(String::new);
    
    // Status visibility password masing-masing kolom input
    let mut show_password = use_signal(|| false);
    let mut show_confirm_password = use_signal(|| false);
    
    let mut error_message = use_signal(|| Option::<String>::None);
    let mut is_loading = use_signal(|| false); 
    
    // PERBAIKAN: Sesuaikan tipe data context pembungkus menjadi format tuple
    let mut user_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let navigator = use_navigator();

    let handle_register = move |_| async move {
        if is_loading() { return; } 

        error_message.set(None);

        let username = username_input();
        let password = password_input();
        let confirm_password = confirm_password_input();

        if username.trim().is_empty() || password.is_empty() || confirm_password.is_empty() {
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

        match register_user(username, password).await {
            Ok(profile) => {
                // PERBAIKAN: Set state dalam bentuk tuple agar status inisialisasi bernilai true
                user_state.set((Some(profile), true));
                is_loading.set(false);
                navigator.push(Route::Dashboard {});
            }
            Err(err) => {
                is_loading.set(false); 
                error_message.set(Some(err.to_string()));
            }
        }
    };

    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6",
            div { class: "bg-slate-900 p-8 rounded-xl shadow-xl max-w-md w-full border border-slate-800 text-center",
                
                h2 { class: "text-3xl font-extrabold text-teal-400 mb-2", "Join LingoMind" }
                p { class: "text-slate-400 text-sm mb-6", "Create an account to track your study scores" }
                
                if let Some(msg) = error_message() {
                    div { class: "mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-xs text-left font-medium flex items-center gap-2",
                        "⚠️ {msg}"
                    }
                }

                // Input Username
                div { class: "mb-4 text-left",
                    label { class: "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2", "Username" }
                    input {
                        class: "w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed",
                        placeholder: "Pilih nama pengguna...",
                        value: "{username_input}",
                        disabled: is_loading(),
                        oninput: move |e| username_input.set(e.value()),
                    }
                }

                // Input Password Utama
                div { class: "mb-4 text-left",
                    label { class: "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2", "Password" }
                    div { class: "relative flex items-center",
                        input {
                            r#type: if show_password() { "text" } else { "password" },
                            class: "w-full bg-slate-950 border border-slate-800 rounded pl-4 pr-12 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed",
                            placeholder: "Buat password aman...",
                            value: "{password_input}",
                            disabled: is_loading(),
                            oninput: move |e| password_input.set(e.value()),
                        }
                        button {
                            r#type: "button",
                            class: "absolute right-3 text-slate-500 hover:text-teal-400 text-xs font-semibold select-none bg-transparent border-none cursor-pointer disabled:opacity-30",
                            disabled: is_loading(),
                            onclick: move |_| show_password.set(!show_password()),
                            if show_password() { "HIDE" } else { "SHOW" }
                        }
                    }
                    span { class: "text-[10px] text-slate-500 mt-1 block", "Minimal panjang password adalah 6 karakter." }
                }

                // Input Konfirmasi Password
                div { class: "mb-6 text-left",
                    label { class: "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2", "Confirm Password" }
                    div { class: "relative flex items-center",
                        input {
                            r#type: if show_confirm_password() { "text" } else { "password" },
                            class: "w-full bg-slate-950 border border-slate-800 rounded pl-4 pr-12 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed",
                            placeholder: "Ulangi password...",
                            value: "{confirm_password_input}",
                            disabled: is_loading(),
                            oninput: move |e| confirm_password_input.set(e.value()),
                        }
                        button {
                            r#type: "button",
                            class: "absolute right-3 text-slate-500 hover:text-teal-400 text-xs font-semibold select-none bg-transparent border-none cursor-pointer disabled:opacity-30",
                            disabled: is_loading(),
                            onclick: move |_| show_confirm_password.set(!show_confirm_password()),
                            if show_confirm_password() { "HIDE" } else { "SHOW" }
                        }
                    }
                }
                
                // Tombol Submit
                button {
                    class: format!(
                        "w-full font-bold py-3 px-4 rounded transition-all text-sm shadow-lg flex justify-center items-center gap-2 {}",
                        if is_loading() {
                            "bg-teal-600 text-slate-950/70 cursor-not-allowed opacity-80"
                        } else {
                            "bg-teal-500 hover:bg-teal-600 text-slate-950 shadow-teal-500/20"
                        }
                    ),
                    disabled: is_loading(),
                    onclick: handle_register,
                    if is_loading() {
                        div { class: "flex items-center gap-2",
                            div { class: "animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent" }
                            span { "Mendaftarkan Akun Baru..." }
                        }
                    } else {
                        span { "Buat Akun Baru 🎉" }
                    }
                }

                div { class: "text-xs text-slate-400 pt-4 border-t border-slate-800/60 mt-4",
                    span { "Sudah punya akun? " }
                    Link { 
                        to: Route::Login {},
                        class: "text-teal-400 font-semibold hover:underline",
                        "Login di sini"
                    }
                }
            }
        }
    }
}