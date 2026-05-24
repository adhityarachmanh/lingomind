// src/views/placement_test.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::gemini::evaluate_placement_server;

#[component]
pub fn PlacementTest() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, ready) = session_state();

    if !ready {
        return rsx! { div { "Loading..." } };
    }

    let Some(user) = user_opt else {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center",
                div { class: "p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-sm text-center",
                    h2 { class: "text-xl font-bold text-slate-800 dark:text-slate-200 mb-4", "Silakan login terlebih dahulu" }
                    Link { to: Route::Login {}, class: "text-teal-600 dark:text-teal-400 font-bold hover:underline", "Ke Halaman Login" }
                }
            }
        };
    };

    let language = selected_language();
    let email = user.email.clone();
    
    // [(Role, Message)] -> Role is either "AI" or "User"
    let mut chat_history = use_signal(|| vec![
        ("AI".to_string(), format!("Halo! Saya akan melakukan tes penempatan bahasa {} singkat untuk Anda. Mari kita mulai: Tolong perkenalkan diri Anda dan ceritakan sedikit tentang hobi Anda dalam bahasa {}.", language, language))
    ]);
    
    let mut input_text = use_signal(String::new);
    let mut is_evaluating = use_signal(|| false);
    let mut evaluation_result = use_signal(String::new);

    let mut handle_send = move || {
        let text = input_text().trim().to_string();
        if text.is_empty() { return; }
        
        chat_history.write().push(("User".to_string(), text));
        input_text.set(String::new());
        
        let history = chat_history();
        let user_messages_count = history.iter().filter(|(r, _)| r == "User").count();
        
        if user_messages_count < 3 {
            // Beri pertanyaan balasan sederhana (simulasi chat AI)
            let ai_responses = [
                "Bagus sekali! Bisakah Anda menceritakan kegiatan rutin Anda di akhir pekan?",
                "Menarik! Apa pengalaman paling berkesan dalam hidup Anda sejauh ini?",
                "Jika Anda bisa bepergian ke mana saja, ke mana Anda akan pergi dan mengapa?"
            ];
            let next_q = ai_responses[(user_messages_count - 1) % ai_responses.len()];
            chat_history.write().push(("AI".to_string(), next_q.to_string()));
        } else {
            // Sudah cukup, arahkan ke evaluasi
            chat_history.write().push(("AI".to_string(), "Terima kasih! Percakapan ini sudah cukup. Silakan klik tombol 'Evaluasi Level Saya' di bawah.".to_string()));
        }
    };

    let language_for_eval = language.clone();
    let evaluate_level = move |_| {
        is_evaluating.set(true);
        let e = email.clone();
        let l = language_for_eval.clone();
        let h = chat_history();
        
        spawn(async move {
            match evaluate_placement_server(e, l, h).await {
                Ok(level) => {
                    evaluation_result.set(level);
                    // Update user session in context
                    // For simplicity, we just ask user to go to dashboard which will re-fetch
                },
                Err(err) => {
                    evaluation_result.set(format!("Error: {}", err));
                }
            }
            is_evaluating.set(false);
        });
    };

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900/30 dark:text-slate-50 p-4 sm:p-8 font-sans pb-24",
            div { class: "max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-700 rounded-3xl p-6 shadow-sm flex flex-col h-[80vh]",
                div { class: "flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-4",
                    h1 { class: "text-xl font-black text-slate-800 dark:text-slate-200", "Tes Penempatan" }
                    span { class: "bg-teal-50/30 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-3 py-1 rounded-full text-xs font-bold border border-teal-100/50 dark:border-teal-900/50", "{language}" }
                }
                
                if !evaluation_result().is_empty() {
                    div { class: "flex-1 flex flex-col items-center justify-center text-center animate-fade-in",
                        if evaluation_result().starts_with("Error") {
                            p { class: "text-rose-500 font-bold mb-4", "{evaluation_result()}" }
                        } else {
                            div { class: "text-6xl mb-4", "🎉" }
                            h2 { class: "text-2xl font-black text-slate-800/30 dark:text-slate-200 mb-2", "Evaluasi Selesai!" }
                            p { class: "text-slate-600 dark:text-slate-400 mb-6", "Level bahasa Anda saat ini adalah:" }
                            div { class: "text-5xl font-black text-teal-600 dark:text-teal-400 mb-8 bg-teal-50/30 dark:bg-teal-900/30 w-32 h-32 flex items-center justify-center rounded-full mx-auto border-4 border-teal-100/50 dark:border-teal-900/50", 
                                "{evaluation_result()}" 
                            }
                            p { class: "text-sm text-slate-500 dark:text-slate-400 mb-8", "Level ini telah disimpan ke profil Anda. Materi pembelajaran Anda selanjutnya akan disesuaikan dengan level ini." }
                        }
                        Link {
                            to: Route::Dashboard {},
                            class: "bg-teal-600 hover:bg-teal-700 text-white font-bold px-8 py-3 rounded-2xl transition-all shadow-md",
                            "Kembali ke Dashboard"
                        }
                    }
                } else {
                    div { class: "flex-1 overflow-y-auto space-y-4 mb-4 pr-2",
                        for (role, msg) in chat_history() {
                            div { class: if role == "AI" { "flex justify-start" } else { "flex justify-end" },
                                div { class: if role == "AI" { "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm p-4 max-w-[85%]" } else { "bg-teal-500 text-white rounded-2xl rounded-tr-sm p-4 max-w-[85%]" },
                                    p { class: "text-sm font-medium", "{msg}" }
                                }
                            }
                        }
                    }
                    
                    div { class: "pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3",
                        div { class: "flex gap-2",
                            input {
                                r#type: "text",
                                class: "flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all",
                                placeholder: "Ketik jawaban Anda di sini...",
                                value: "{input_text}",
                                oninput: move |e| input_text.set(e.value()),
                                onkeydown: move |e| { if e.key() == Key::Enter { handle_send(); } }
                            }
                            button {
                                class: "bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl shadow-sm transition-colors cursor-pointer",
                                onclick: move |_| handle_send(),
                                "Kirim"
                            }
                        }
                        
                        if chat_history().iter().filter(|(r, _)| r == "User").count() >= 1 {
                            button {
                                class: if is_evaluating() { "w-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed" } else { "w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-all shadow-md cursor-pointer" },
                                disabled: is_evaluating(),
                                onclick: evaluate_level,
                                if is_evaluating() { "Mengevaluasi Level..." } else { "Selesai & Evaluasi Level Saya" }
                            }
                        }
                    }
                }
            }
        }
    }
}
