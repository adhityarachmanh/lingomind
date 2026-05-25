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
        div { class: "min-h-screen bg-slate-50 flex items-center justify-center p-4",
            div { class: "bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200",
                div { class: "text-center mb-8",
                    h1 { class: "text-2xl font-bold text-slate-800", "LingoMind Admin" }
                    p { class: "text-slate-500 text-sm mt-2", "Restricted Access Panel" }
                }
                
                if let Some(msg) = error_message() {
                    div { class: "mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm font-medium",
                        "⚠️ {msg}"
                    }
                }
                
                form {
                    onsubmit: move |e| {
                        e.prevent_default();
                    },
                    div { class: "space-y-4",
                        div {
                            label { class: "block text-sm font-medium text-slate-700 mb-1", "Admin Email" }
                            input {
                                class: "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                                placeholder: "admin@lingomind.com",
                                r#type: "email",
                                value: "{email_input}",
                                oninput: move |e| email_input.set(e.value()),
                                disabled: is_loading()
                            }
                        }
                        div {
                            label { class: "block text-sm font-medium text-slate-700 mb-1", "Password" }
                            input {
                                class: "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                                placeholder: "••••••••",
                                r#type: "password",
                                value: "{password_input}",
                                oninput: move |e| password_input.set(e.value()),
                                disabled: is_loading()
                            }
                        }
                    }
                    button {
                        class: "w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2",
                        onclick: handle_login,
                        disabled: is_loading(),
                        if is_loading() {
                            i { class: "fa-solid fa-spinner fa-spin" }
                            "Memverifikasi..."
                        } else {
                            "Login as Admin"
                        }
                    }
                }
                div { class: "mt-6 text-center",
                    Link {
                        to: Route::Login {},
                        class: "text-slate-500 hover:text-slate-700 text-sm transition-colors",
                        "Kembali ke Aplikasi Utama"
                    }
                }
            }
        }
    }
}
