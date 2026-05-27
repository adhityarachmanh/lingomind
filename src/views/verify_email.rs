// src/views/verify_email.rs
use dioxus::prelude::*;
use crate::services::auth::verify_email_server;
use crate::routes::Route;

#[component]
pub fn VerifyEmail(token: String) -> Element {
    let mut verification_status = use_signal(|| "Memverifikasi akun Anda...".to_string());
    let mut is_success = use_signal(|| false);
    let mut is_loading = use_signal(|| true);

    let token_clone = token.clone();
    
    // Gunakan use_effect untuk memicu verifikasi satu kali saat komponen di-mount
    use_effect(move || {
        let t = token_clone.clone();
        spawn(async move {
            match verify_email_server(t).await {
                Ok(msg) => {
                    verification_status.set(msg);
                    is_success.set(true);
                    is_loading.set(false);
                }
                Err(e) => {
                    verification_status.set(e.to_string());
                    is_success.set(false);
                    is_loading.set(false);
                }
            }
        });
    });

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col justify-center items-center p-6",
            div { class: "bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-700 text-center",

                img {
                    src: asset!("/assets/logo.png"),
                    alt: "LingoMind Logo",
                    class: "w-20 h-20 rounded-3xl mx-auto mb-6 shadow-md object-cover border border-slate-100 dark:border-slate-800",
                }

                if is_loading() {
                    div { class: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto mb-4" }
                    h2 { class: "text-2xl font-extrabold text-slate-700 dark:text-slate-300 mb-2",
                        "Memproses..."
                    }
                    p { class: "text-slate-500 dark:text-slate-400 font-medium text-sm mb-6",
                        "{verification_status}"
                    }
                } else if is_success() {
                    h2 { class: "text-2xl font-extrabold text-teal-600 dark:text-teal-400 mb-2",
                        "Verifikasi Berhasil!"
                    }
                    p { class: "text-slate-500 dark:text-slate-400 font-medium text-sm mb-8",
                        "{verification_status}"
                    }

                    Link {
                        to: Route::Login {},
                        class: "block w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg",
                        "Lanjut ke Login"
                    }
                } else {
                    h2 { class: "text-2xl font-extrabold text-rose-600 dark:text-rose-400 mb-2",
                        "Verifikasi Gagal"
                    }
                    p { class: "text-slate-500 dark:text-slate-400 font-medium text-sm mb-8",
                        "{verification_status}"
                    }

                    Link {
                        to: Route::Login {},
                        class: "block w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg",
                        "Kembali ke Halaman Login"
                    }
                }
            }
        }
    }
}
