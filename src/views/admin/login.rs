use dioxus::prelude::*;
use crate::routes::Route;
use crate::models::user::UserProfile;
use crate::services::auth::login_user;

#[component]
pub fn AdminLogin() -> Element {
    let mut email_input = use_signal(String::new);
    let mut password_input = use_signal(String::new);
    let mut is_loading = use_signal(|| false);
    let mut error_message = use_signal(|| Option::<String>::None);
    
    let mut user_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let navigator = use_navigator();

    // Redirect jika sudah login
    use_effect(move || {
        let (user_opt, _) = user_state();
        if let Some(user) = user_opt {
            if user.role == "admin" {
                navigator.push(Route::AdminDashboard { tab: "konfigurasi".to_string() });
            } else {
                navigator.push(Route::Dashboard {});
            }
        }
    });

    let handle_login = move |_| async move {
        if is_loading() { return; }
        error_message.set(None);

        let email = email_input();
        let password = password_input();

        if email.trim().is_empty() || password.is_empty() {
            error_message.set(Some("Email dan password tidak boleh kosong!".to_string()));
            return;
        }

        is_loading.set(true);

        match login_user(email, password).await {
            Ok(profile) => {
                if profile.role != "admin" {
                    error_message.set(Some("Akses ditolak. Anda bukan admin.".to_string()));
                    is_loading.set(false);
                } else {
                    user_state.set((Some(profile), true));
                    is_loading.set(false);
                    navigator.push(Route::AdminDashboard { tab: "konfigurasi".to_string() });
                }
            }
            Err(err) => {
                is_loading.set(false);
                error_message.set(Some(err.to_string().replace("UNVERIFIED:", "")));
            }
        }
    };

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-6 font-sans transition-colors duration-300",
            div { class: "bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 text-center relative overflow-hidden",
                // Decorative top border for enterprise feel
                div { class: "absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" }
                
                img {
                    src: asset!("/assets/logo.png"),
                    alt: "LingoMind Logo",
                    class: "w-20 h-20 rounded-2xl mx-auto mb-4 shadow-md object-cover border border-slate-100 dark:border-slate-700",
                }
                
                h2 { class: "text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-1", "Admin Portal" }
                p { class: "text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium", "Secure Access Control" }
                
                if let Some(msg) = error_message() {
                    div { class: "mb-6 p-3 bg-rose-50/50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2 text-left",
                        "⚠️ {msg}"
                    }
                }
                
                form {
                    onsubmit: move |e| e.prevent_default(),
                    div { class: "space-y-4 text-left",
                        div {
                            label { class: "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5", "Admin Email" }
                            div { class: "relative",
                                i { class: "fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" }
                                input {
                                    class: "w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm shadow-sm disabled:opacity-50",
                                    placeholder: "admin@lingomind.com",
                                    r#type: "email",
                                    value: "{email_input}",
                                    oninput: move |e| email_input.set(e.value()),
                                    disabled: is_loading()
                                }
                            }
                        }
                        div {
                            label { class: "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5", "Password" }
                            div { class: "relative",
                                i { class: "fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" }
                                input {
                                    class: "w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm shadow-sm disabled:opacity-50",
                                    placeholder: "••••••••",
                                    r#type: "password",
                                    value: "{password_input}",
                                    oninput: move |e| password_input.set(e.value()),
                                    disabled: is_loading()
                                }
                            }
                        }
                    }
                    button {
                        class: format!(
                            "w-full mt-8 font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-md flex justify-center items-center gap-2 {}",
                            if is_loading() {
                                "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 cursor-not-allowed opacity-80"
                            } else {
                                "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow-lg hover:shadow-blue-500/30"
                            }
                        ),
                        onclick: handle_login,
                        disabled: is_loading(),
                        if is_loading() {
                            div { class: "animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" }
                            "Authenticating..."
                        } else {
                            "Secure Login"
                            i { class: "fa-solid fa-shield-halved ml-1" }
                        }
                    }
                }
                div { class: "mt-8 text-center pt-5 border-t border-slate-100 dark:border-slate-800/50",
                    Link {
                        to: Route::Login {},
                        class: "text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
                        i { class: "fa-solid fa-arrow-left" }
                        "Kembali ke Aplikasi Utama"
                    }
                }
            }
        }
    }
}
