use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::flashcard::{get_due_flashcards_server, review_flashcard_server};

#[cfg(target_arch = "wasm32")]
fn speak_text(tts_lang_code: &str, text: &str) {
    if let Some(window) = web_sys::window() {
        if let Ok(synth) = window.speech_synthesis() {
            synth.cancel();
            if let Ok(utterance) = web_sys::SpeechSynthesisUtterance::new_with_text(text) {
                utterance.set_lang(tts_lang_code);
                utterance.set_rate(0.90);
                utterance.set_pitch(1.0);
                synth.speak(&utterance);
            }
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn speak_text(_tts_lang_code: &str, _text: &str) {}

#[component]
pub fn FlashcardReview() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, ready) = session_state();

    if !ready {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex items-center justify-center font-sans",
                div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" }
            }
        };
    }

    let Some(user) = user_opt else {
        return rsx! { div { class: "p-6 text-slate-600 dark:text-slate-400 font-sans", "Silakan login dulu." } };
    };

    let email = user.email.clone();
    let selected_lang_for_resource = selected_language;
    let cards_resource = use_resource(move || {
        let u = email.clone();
        let l = selected_lang_for_resource();
        async move { get_due_flashcards_server(u, l, 20).await }
    });

    let mut index = use_signal(|| 0usize);
    let mut show_back = use_signal(|| false);
    let mut finished = use_signal(|| false);

    let Some(cards_result) = cards_resource.value()() else {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex items-center justify-center font-sans",
                div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" }
            }
        };
    };

    let (cards, is_offline): (Vec<crate::models::flashcard::Flashcard>, bool) = match cards_result {
        Ok(v) => (v, false),
        Err(e) => {
            if let Some(cached) = crate::services::offline::get_offline_flashcards(&selected_language()) {
                (cached, true)
            } else {
                return rsx! { div { class: "p-6 text-rose-600 dark:text-rose-400 font-sans", "Gagal memuat flashcard: {e} (Tidak ada cache offline)" } }
            }
        }
    };

    let language = selected_language();

    if cards.is_empty() {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex items-center justify-center p-6 font-sans",
                div { class: "bg-white dark:bg-slate-900 border border-slate-200/20 dark:border-slate-700 rounded-3xl p-8 max-w-md w-full text-center shadow-xl hover:shadow-2xl transition-all",
                    span { class: "text-5xl block mb-4", "🏆" }
                    h2 { class: "text-2xl font-black text-slate-800 dark:text-slate-200 mb-2 tracking-tight", "Semua Kartu Bersih!" }
                    p { class: "text-slate-500 dark:text-slate-400 text-sm mb-6 font-semibold leading-relaxed", 
                        "Tidak ada kartu yang harus diulas untuk bahasa "
                        span { class: "text-teal-600 dark:text-teal-400 font-extrabold", "{language}" }
                        " saat ini. Kembali lagi nanti, atau tambahkan kartu baru melalui menu kuis!"
                    }
                    Link { 
                        to: Route::Dashboard {}, 
                        class: "inline-block bg-teal-600 hover:bg-teal-700 text-white font-bold px-8 py-3 rounded-2xl transition-all shadow-md hover:shadow-lg hover:shadow-teal-600/20", 
                        "Kembali ke Dashboard" 
                    }
                }
            }
        };
    }

    if finished() {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex items-center justify-center p-6 font-sans",
                div { class: "bg-white dark:bg-slate-900 border border-slate-200/20 dark:border-slate-700 rounded-3xl p-8 max-w-md w-full text-center shadow-xl hover:shadow-2xl transition-all",
                    div { class: "text-6xl mb-4 animate-bounce", "🎉" }
                    h2 { class: "text-2xl font-black text-slate-800 dark:text-slate-200 mb-2 tracking-tight", "Sesi Selesai!" }
                    p { class: "text-slate-500 dark:text-slate-400 text-sm mb-6 font-semibold leading-relaxed", "Hebat! Semua kartu di sesi ini telah selesai diulas secara optimal." }
                    Link { 
                        to: Route::Dashboard {}, 
                        class: "inline-block bg-teal-600 hover:bg-teal-700 text-white font-bold px-8 py-3 rounded-2xl transition-all shadow-md hover:shadow-lg hover:shadow-teal-600/20", 
                        "Kembali ke Dashboard" 
                    }
                }
            }
        };
    }

    let total_cards = cards.len();
    let current = cards[index().min(total_cards - 1)].clone();

    let languages_res = use_context::<Resource<Vec<crate::models::constants::LanguageCourse>>>();
    let langs = languages_res().unwrap_or_default();
    let tts_lang_code = langs
        .iter()
        .find(|l| l.id.eq_ignore_ascii_case(&language) || l.name.eq_ignore_ascii_case(&language))
        .map(|l| l.tts_lang_code.clone())
        .unwrap_or_else(|| "en-US".to_string());

    let progress_pct = ((index() as f64) / (total_cards as f64)) * 100.0;

    // Clone captured values for closures
    let speaker_current_text = current.front_text.clone();
    let reveal_current_text = current.front_text.clone();
    let tts_lang_code_speaker = tts_lang_code.clone();
    let tts_lang_code_reveal = tts_lang_code.clone();
    
    let card_id_again = current.id;
    let card_id_good = current.id;
    let card_id_easy = current.id;

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-4 sm:p-8 flex flex-col items-center justify-center font-sans",
            div { class: "max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-xl relative",
                
                // Top Progress Tracker (Duolingo Style)
                div { class: "flex items-center justify-between gap-4 mb-6",
                    div { class: "flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden",
                        div { 
                            class: "bg-teal-500 h-full rounded-full transition-all duration-300", 
                            style: "width: {progress_pct}%" 
                        }
                    }
                    span { class: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-extrabold text-[11px] px-2.5 py-1 rounded-full uppercase tracking-wider", 
                        "Kartu {index() + 1}/{total_cards}" 
                    }
                }

                // Title Header
                div { class: "flex justify-between items-center mb-6",
                    h2 { class: "text-lg font-black text-slate-800 dark:text-slate-200 tracking-tight", 
                        "Ulasan Flashcard" 
                    }
                    span { class: "flex gap-2",
                        span { class: "text-xs font-black text-teal-600 dark:text-teal-400 bg-teal-50/30 dark:bg-teal-900/30 border border-teal-100/50 dark:border-teal-900/50 px-3 py-1 rounded-full",
                            "🇬🇧 {language}"
                        }
                        if is_offline {
                            span { class: "text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-900/30 px-3 py-1 rounded-full border border-rose-100 dark:border-rose-900/50", "📵 Offline Mode" }
                        }
                    }
                }

                // Premium Card Container
                div { class: "bg-white dark:bg-slate-900 border-2 border-slate-100/50 dark:border-slate-800 rounded-2xl p-6 sm:p-8 mb-8 text-center shadow-md relative min-h-[220px] flex flex-col justify-center transition-all hover:border-teal-100/50 dark:border-teal-900/50",
                    
                    // Audio Pronunciation Button
                    button {
                        r#type: "button",
                        class: "w-11 h-11 rounded-full border border-teal-200 bg-teal-50/30 dark:bg-teal-900/30/50 hover:bg-teal-50/30 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-sm hover:shadow hover:scale-105 active:scale-95 transition-all cursor-pointer mx-auto mb-4 text-base",
                        title: "Dengarkan Pengucapan",
                        onclick: move |_| {
                            speak_text(&tts_lang_code_speaker, &speaker_current_text);
                        },
                        "🔊"
                    }

                    p { class: "text-[10px] font-extrabold text-slate-400 mb-2 uppercase tracking-widest", "KATA / FRASA" }
                    p { class: "text-3xl font-black text-slate-800 dark:text-slate-200 leading-snug tracking-tight mb-2", "{current.front_text}" }

                    if show_back() {
                        div { class: "mt-6 pt-6 border-t-2 border-slate-50 animate-fade-in",
                            p { class: "text-[10px] font-extrabold text-slate-400 mb-2 uppercase tracking-widest", "ARTI / TERJEMAHAN" }
                            p { class: "text-2xl font-extrabold text-teal-600 dark:text-teal-400 tracking-tight", "{current.back_text}" }
                        }
                    }
                }

                // Dynamic Response Panel
                if !show_back() {
                    button {
                        class: "w-full bg-slate-800 hover:bg-slate-900 text-white font-black px-6 py-4 rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all text-sm sm:text-base cursor-pointer",
                        onclick: move |_| {
                            show_back.set(true);
                            speak_text(&tts_lang_code_reveal, &reveal_current_text);
                        },
                        "Tampilkan Terjemahan 👀"
                    }
                } else {
                    div { class: "grid grid-cols-3 gap-3",
                        button {
                            class: "bg-rose-50/30 dark:bg-rose-900/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 px-3 py-3 sm:py-4 rounded-2xl font-black transition-all text-xs flex flex-col items-center gap-1 shadow-sm hover:shadow cursor-pointer active:scale-95",
                            onclick: move |_| {
                                spawn(async move { let _ = review_flashcard_server(card_id_again, 2).await; });
                                show_back.set(false);
                                let next = index() + 1;
                                if next >= total_cards { finished.set(true); } else { index.set(next); }
                            },
                            span { class: "text-lg", "🔴" }
                            span { "Ulangi" }
                            span { class: "text-[9px] font-semibold text-rose-500/80 mt-0.5", "Lupa / Sulit" }
                        }
                        button {
                            class: "bg-amber-50/30 dark:bg-amber-900/30 hover:bg-amber-100 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 px-3 py-3 sm:py-4 rounded-2xl font-black transition-all text-xs flex flex-col items-center gap-1 shadow-sm hover:shadow cursor-pointer active:scale-95",
                            onclick: move |_| {
                                spawn(async move { let _ = review_flashcard_server(card_id_good, 4).await; });
                                show_back.set(false);
                                let next = index() + 1;
                                if next >= total_cards { finished.set(true); } else { index.set(next); }
                            },
                            span { class: "text-lg", "🟡" }
                            span { "Bagus" }
                            span { class: "text-[9px] font-semibold text-amber-500/80 mt-0.5", "Cukup Ingat" }
                        }
                        button {
                            class: "bg-teal-50/30 dark:bg-teal-900/30 hover:bg-teal-100 text-teal-600 dark:text-teal-400 border border-teal-200 px-3 py-3 sm:py-4 rounded-2xl font-black transition-all text-xs flex flex-col items-center gap-1 shadow-sm hover:shadow cursor-pointer active:scale-95",
                            onclick: move |_| {
                                spawn(async move { let _ = review_flashcard_server(card_id_easy, 5).await; });
                                show_back.set(false);
                                let next = index() + 1;
                                if next >= total_cards { finished.set(true); } else { index.set(next); }
                            },
                            span { class: "text-lg", "🟢" }
                            span { "Mudah" }
                            span { class: "text-[9px] font-semibold text-teal-500/80 mt-0.5", "Sangat Ingat" }
                        }
                    }
                }
            }
        }
    }
}
