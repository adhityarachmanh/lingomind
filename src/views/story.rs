use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::gemini::story::generate_story_server;
use crate::services::auth::update_user_score;
use crate::services::engagement::update_engagement_after_quiz_server;
#[component]
pub fn Story(goal: String) -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let navigator = use_navigator();
    let (user_opt, is_ready) = session_state();

    if !is_ready {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 flex justify-center items-center",
                div { class: "animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600" }
            }
        };
    }

    let Some(user) = user_opt else {
        navigator.replace(Route::Login {});
        return rsx! {
            div {}
        };
    };

    let language = selected_language();
    let level = user.base_level(&language);
    let email = user.email.clone();
    let goal_for_future = goal.clone();
    let level_for_future = level.clone();
    let language_for_future = language.clone();
    
    // Server Future for generating the story
    let mut story_future = use_server_future(move || {
        let l = language_for_future.clone();
        let lv = level_for_future.clone();
        let g = goal_for_future.clone();
        async move {
            generate_story_server(l, lv, g).await
        }
    })?;

    let mut current_segment_idx = use_signal(|| 0);
    let mut selected_option = use_signal(|| None::<String>);
    let mut is_correct = use_signal(|| None::<bool>);
    let mut is_completed = use_signal(|| false);
    let mut reward_status = use_signal(|| String::new());

    let languages_res = use_context::<Resource<Vec<crate::models::constants::LanguageCourse>>>();
    let langs = languages_res().unwrap_or_default();
    let default_code = "en-US".to_string();
    let tts_lang_code = langs
        .iter()
        .find(|l| l.id.eq_ignore_ascii_case(&language) || l.name.eq_ignore_ascii_case(&language))
        .map(|l| l.tts_lang_code.clone())
        .unwrap_or(default_code);

    let play_tts = move |text: &str, tts_lang: &str| {
        if let Ok(utterance) = web_sys::SpeechSynthesisUtterance::new_with_text(text) {
            utterance.set_lang(tts_lang);
            utterance.set_rate(0.9);
            if let Some(window) = web_sys::window() {
                let synth = window.speech_synthesis().unwrap();
                synth.cancel(); // Stop any ongoing speech
                synth.speak(&utterance);
            }
        }
    };

    let mut check_answer = move |option: String, correct_answer: String| {
        if is_correct().is_some() { return; } // Already answered
        
        let correct = option.eq_ignore_ascii_case(&correct_answer);
        selected_option.set(Some(option));
        is_correct.set(Some(correct));
    };

    let mut next_segment = move |total_segments: usize| {
        let next_idx = current_segment_idx() + 1;
        if next_idx >= total_segments {
            // Story Completed
            is_completed.set(true);
            
            // Beri hadiah poin
            let e = email.clone();
            let l = selected_language();
            let g = goal.clone();
            spawn(async move {
                if let Ok(updated) = update_user_score(e, l, 20, Some(g)).await {
                    let _ = update_engagement_after_quiz_server(updated.email.clone(), 20).await;
                    reward_status.set("Selamat! Anda mendapat 20 XP & Koin!".to_string());
                } else {
                    reward_status.set("Cerita selesai. (Gagal menyimpan skor)".to_string());
                }
            });
        } else {
            current_segment_idx.set(next_idx);
            selected_option.set(None);
            is_correct.set(None);
        }
    };

    match (story_future.value())() {
        None => rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center text-slate-600 dark:text-slate-400 p-6",
                div { class: "animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-600 mb-6" }
                h2 { class: "text-xl font-bold text-slate-800 dark:text-slate-200 mb-2 text-center",
                    "Menyiapkan Cerita Interaktif..."
                }
                p { class: "text-center max-w-md",
                    "AI sedang menulis cerita pendek bahasa {selected_language()} yang sesuai dengan level Anda ({level}). Mohon tunggu sebentar."
                }
            }
        },
        Some(Err(e)) => rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center text-slate-600 dark:text-slate-400 p-6",
                div { class: "text-4xl mb-4", "⚠️" }
                h2 { class: "text-xl font-bold text-red-600 dark:text-red-400 mb-2 text-center",
                    "Gagal Memuat Cerita"
                }
                p { class: "text-center max-w-md mb-6", "{e}" }
                button {
                    class: "bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors",
                    onclick: move |_| story_future.restart(),
                    "Coba Lagi"
                }
                button {
                    class: "mt-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium",
                    onclick: move |_| {
                        navigator.push(Route::Roadmap {});
                    },
                    "Kembali ke Peta"
                }
            }
        },
        Some(Ok(story)) => {
            if is_completed() {
                rsx! {
                    div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-6 text-center animate-in fade-in zoom-in duration-500",
                        div { class: "text-6xl mb-6", "🎉" }
                        h1 { class: "text-3xl font-black text-slate-800 dark:text-slate-200 mb-2",
                            "Cerita Selesai!"
                        }
                        p { class: "text-slate-500 dark:text-slate-400 mb-8 max-w-md",
                            "Anda telah menyelesaikan cerita \"{story.title}\". Sangat bagus untuk melatih pendengaran Anda!"
                        }

                        if !reward_status().is_empty() {
                            div { class: "bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-xl p-4 mb-8 max-w-sm w-full",
                                p { class: "text-teal-700 dark:text-teal-400 font-bold",
                                    "{reward_status}"
                                }
                            }
                        }

                        Link {
                            to: Route::Roadmap {},
                            class: "bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-700 hover:scale-105 transition-all shadow-lg shadow-indigo-600/20",
                            "Selesai & Kembali"
                        }
                    }
                }
            } else {
                let idx = current_segment_idx();
                let segment = &story.segments[idx];
                let is_ans = is_correct().is_some();
                let is_right = is_correct().unwrap_or(false);
                let total = story.segments.len();
                let progress = ((idx as f32) / (total as f32)) * 100.0;

                // Auto-play TTS when segment changes (optional, but good UX for listening)
                // Use effect to play when idx changes
                use_effect({
                    let text = segment.text.clone();
                    let lang_code = tts_lang_code.clone();
                    move || {
                        play_tts(&text, &lang_code);
                    }
                });

                rsx! {
                    div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 pt-20 pb-24 px-4 sm:px-6",
                        div { class: "max-w-2xl mx-auto",
                            // Progress bar
                            div { class: "w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 mb-8",
                                div {
                                    class: "bg-indigo-600 h-2.5 rounded-full transition-all duration-500",
                                    width: "{progress}%",
                                }
                            }

                            // Header Cerita
                            div { class: "text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-500",
                                h1 { class: "text-2xl font-black text-indigo-700 dark:text-indigo-400",
                                    "{story.title}"
                                }
                                p { class: "text-sm text-slate-500 dark:text-slate-400 italic",
                                    "{story.title_translation}"
                                }
                            }

                            // Kartu Narasi Utama
                            div { class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none mb-8 relative overflow-hidden animate-in zoom-in-95 duration-300",
                                // Tombol Putar Ulang
                                button {
                                    class: "absolute top-4 right-4 w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-100 hover:scale-110 transition-all focus:outline-none",
                                    onclick: {
                                        let text = segment.text.clone();
                                        let lang_code = tts_lang_code.clone();
                                        move |_| play_tts(&text, &lang_code)
                                    },
                                    span { class: "text-xl", "🔊" }
                                }

                                if let Some(speaker) = &segment.speaker {
                                    div { class: "inline-block bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold px-3 py-1 rounded-full mb-4",
                                        "{speaker}"
                                    }
                                }

                                p { class: "text-xl sm:text-2xl font-medium leading-relaxed mb-6 pr-10",
                                    "{segment.text}"
                                }

                                div { class: "border-t border-slate-100 dark:border-slate-800 pt-4",
                                    p { class: "text-sm text-slate-500 dark:text-slate-400 italic",
                                        "{segment.translation}"
                                    }
                                }
                            }

                            // Bagian Pertanyaan
                            if let Some(question) = &segment.question {
                                div { class: "animate-in slide-in-from-bottom-8 duration-500 delay-150 fill-mode-both",
                                    h3 { class: "text-lg font-bold mb-4", "{question.question_text}" }

                                    div { class: "space-y-3",
                                        for option in &question.options {
                                            {
                                                let is_this_selected = selected_option().as_deref() == Some(option);
                                                let is_this_correct = option.eq_ignore_ascii_case(&question.correct_answer);

                                                let btn_class = if is_ans {
                                                    if is_this_correct {
                                                        "bg-teal-100 dark:bg-teal-900/30 border-teal-500 text-teal-800 dark:text-teal-300 ring-2 ring-teal-500"
                                                    } else if is_this_selected {
                                                        "bg-rose-100 dark:bg-rose-900/30 border-rose-500 text-rose-800 dark:text-rose-300 opacity-80"
                                                    } else {
                                                        "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 opacity-50"
                                                    }
                                                } else {
                                                    "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20"
                                                };

                                                rsx! {
                                                    button {
                                                        class: format!(
                                                            "w-full text-left p-4 rounded-2xl border-2 transition-all font-medium {}",
                                                            btn_class,
                                                        ),
                                                        disabled: is_ans,
                                                        onclick: {
                                                            let opt = option.to_string();
                                                            let corr = question.correct_answer.clone();
                                                            move |_| check_answer(opt.clone(), corr.clone())
                                                        },
                                                        "{option}"
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // Feedback & Lanjut
                                    if is_ans {
                                        div { class: "mt-6 animate-in slide-in-from-bottom-4",
                                            div {
                                                class: format!(
                                                    "p-4 rounded-2xl border mb-6 {}",
                                                    if is_right {
                                                        "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800"
                                                    } else {
                                                        "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800"
                                                    },
                                                ),
                                                h4 {
                                                    class: format!(
                                                        "font-black text-lg flex items-center gap-2 {}",
                                                        if is_right {
                                                            "text-teal-700 dark:text-teal-400"
                                                        } else {
                                                            "text-rose-700 dark:text-rose-400"
                                                        },
                                                    ),
                                                    if is_right {
                                                        "✨ Benar!"
                                                    } else {
                                                        "❌ Salah"
                                                    }
                                                }
                                                p { class: "text-slate-600 dark:text-slate-400 mt-2 text-sm",
                                                    "{question.explanation}"
                                                }
                                            }

                                            button {
                                                class: "w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 hover:scale-[1.02] transition-all shadow-lg shadow-indigo-600/20",
                                                onclick: move |_| next_segment(total),
                                                "Lanjut"
                                            }
                                        }
                                    }
                                }
                            } else {
                                // Jika segmen tidak punya pertanyaan (hanya narasi)
                                div { class: "text-center animate-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both",
                                    button {
                                        class: "w-full sm:w-auto bg-indigo-600 text-white font-black px-12 py-4 rounded-2xl hover:bg-indigo-700 hover:scale-[1.02] transition-all shadow-lg shadow-indigo-600/20",
                                        onclick: move |_| next_segment(total),
                                        "Lanjut"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
