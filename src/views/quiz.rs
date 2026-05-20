// src/views/quiz.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::models::constants::LANGUAGE_COURSES;
use crate::models::flashcard::NewFlashcard;
use crate::services::gemini::generate_quiz_server;
use crate::services::gemini::generate_tts_audio_server;
use crate::services::auth::update_user_score;
use crate::services::engagement::update_engagement_after_quiz_server;
use crate::services::flashcard::add_flashcards_server;
use crate::services::weakness::{log_weakness_server, log_skill_progress_server};
use crate::routes::Route;

#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
#[cfg(target_arch = "wasm32")]
use std::sync::atomic::{AtomicU64, Ordering};

#[cfg(target_arch = "wasm32")]
thread_local! {
    static ACTIVE_AUDIO: RefCell<Option<web_sys::HtmlAudioElement>> = const { RefCell::new(None) };
}

#[cfg(target_arch = "wasm32")]
static AUDIO_REQUEST_SEQ: AtomicU64 = AtomicU64::new(0);

#[cfg(target_arch = "wasm32")]
fn stop_speech() {
    if let Some(window) = web_sys::window() {
        if let Ok(synth) = window.speech_synthesis() {
            synth.cancel();
        }
    }
    ACTIVE_AUDIO.with(|audio| {
        if let Some(a) = audio.borrow_mut().take() {
            let _ = a.pause();
            a.set_src("");
        }
    });
    AUDIO_REQUEST_SEQ.fetch_add(1, Ordering::SeqCst);
}

#[cfg(not(target_arch = "wasm32"))]
fn stop_speech() {}

#[cfg(target_arch = "wasm32")]
fn play_audio_src(src: &str) {
    if let Ok(audio) = web_sys::HtmlAudioElement::new_with_src(src) {
        ACTIVE_AUDIO.with(|slot| {
            if let Some(prev) = slot.borrow_mut().take() {
                let _ = prev.pause();
            }
            *slot.borrow_mut() = Some(audio.clone());
        });
        let _ = audio.play();
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn play_audio_src(_src: &str) {}

#[cfg(target_arch = "wasm32")]
fn speak_text(tts_lang_code: &str, text: &str) {
    if let Some(window) = web_sys::window() {
        if let Ok(synth) = window.speech_synthesis() {
            synth.cancel();
            if let Ok(utterance) = web_sys::SpeechSynthesisUtterance::new_with_text(text) {
                utterance.set_lang(tts_lang_code);
                utterance.set_rate(0.95);
                utterance.set_pitch(1.0);
                synth.speak(&utterance);
            }
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn speak_text(_tts_lang_code: &str, _text: &str) {}

fn speak_with_edge_or_fallback(tts_lang_code: String, text: String, speed: f32) {
    #[cfg(target_arch = "wasm32")]
    let request_id = AUDIO_REQUEST_SEQ.fetch_add(1, Ordering::SeqCst) + 1;

    spawn(async move {
        match generate_tts_audio_server(text.clone(), tts_lang_code.clone(), speed).await {
            Ok(audio_src) => {
                #[cfg(target_arch = "wasm32")]
                if AUDIO_REQUEST_SEQ.load(Ordering::SeqCst) != request_id {
                    return;
                }
                play_audio_src(&audio_src)
            }
            Err(_) => {
                #[cfg(target_arch = "wasm32")]
                {
                    if let Some(window) = web_sys::window() {
                        if let Ok(synth) = window.speech_synthesis() {
                            synth.cancel();
                            if let Ok(utterance) = web_sys::SpeechSynthesisUtterance::new_with_text(&text) {
                                utterance.set_lang(&tts_lang_code);
                                utterance.set_rate(speed);
                                utterance.set_pitch(1.0);
                                synth.speak(&utterance);
                            }
                        }
                    }
                }
                #[cfg(not(target_arch = "wasm32"))]
                speak_text(&tts_lang_code, &text);
            }
        }
    });
}

fn classify_weakness_topic(explanation: &str) -> String {
    let e = explanation.to_lowercase();
    if e.contains("tense") || e.contains("past") || e.contains("present") || e.contains("future") {
        "Grammar: Tense".to_string()
    } else if e.contains("preposition") || e.contains("in ") || e.contains("on ") || e.contains("at ") {
        "Grammar: Preposition".to_string()
    } else if e.contains("article") || e.contains(" a ") || e.contains(" an ") || e.contains(" the ") {
        "Grammar: Article".to_string()
    } else if e.contains("vocabulary") || e.contains("word choice") {
        "Vocabulary: Word Choice".to_string()
    } else {
        "General: Answer Accuracy".to_string()
    }
}

fn classify_skill(question: &str, explanation: &str) -> String {
    let q = question.to_lowercase();
    let e = explanation.to_lowercase();
    if q.contains("listen") || q.contains("audio") || e.contains("listening") || e.contains("pronunciation") {
        "listening".to_string()
    } else if e.contains("vocabulary") || e.contains("word choice") || q.contains("meaning") || q.contains("synonym") {
        "vocabulary".to_string()
    } else {
        "grammar".to_string()
    }
}

#[component]
pub fn Quiz(language: String, level: String, goal: String) -> Element {
    let mut session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, _is_ready) = session_state();

    let mut current_question_idx = use_signal(|| 0);
    let mut selected_option = use_signal(|| None::<String>);
    let mut score_gained = use_signal(|| 0);
    let mut quiz_finished = use_signal(|| false);
    let mut show_explanation = use_signal(|| false);
    let mut listen_speed = use_signal(|| 0.95_f32);

    let lang_clone = language.clone();
    let lvl_clone = level.clone();

    let quiz_resource = use_resource(move || {
        let lang = lang_clone.clone();
        let lvl = lvl_clone.clone();
        let goal_value = goal.clone();
        async move { generate_quiz_server(lang, lvl, goal_value).await }
    });

    let Some(quiz_result) = quiz_resource.value()() else {
        return rsx! {
            div { class: "min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center gap-4",
                div { class: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400" }
                p { class: "text-slate-400 animate-pulse text-sm", "Gemini AI sedang merancang kuis kustom untuk Anda..." }
            }
        };
    };

    let quiz_container = match quiz_result {
        Ok(data) => data,
        Err(_) => return rsx! { div { class: "p-8 text-red-400", "Gagal memuat kuis dari AI Studio. Cek koneksi/.env." } }
    };

    if quiz_container.questions.is_empty() {
        return rsx! { div { class: "p-8 text-amber-400", "AI mengembalikan kuis kosong. Coba muat ulang halaman." } };
    }

    if quiz_finished() {
        return rsx! {
            div { class: "min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6",
                div { class: "bg-slate-900 p-8 rounded-xl border border-slate-800 text-center max-w-md w-full shadow-2xl",
                    h2 { class: "text-4xl mb-2", "🎉" }
                    h3 { class: "text-2xl font-bold text-teal-400 mb-1", "Kuis Selesai!" }
                    p { class: "text-slate-400 text-sm mb-6", "Skor Anda berhasil dikirim ke database Neon." }
                    div { class: "bg-slate-950 p-4 rounded border border-slate-800 mb-6",
                        p { class: "text-xs uppercase tracking-widest text-slate-500 font-semibold mb-1", "Tambahan Skor" }
                        p { class: "text-3xl font-black text-white", "+{score_gained} Poin" }
                    }
                    Link { to: Route::Dashboard {}, class: "inline-block w-full bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded font-bold transition-colors text-sm", "Kembali ke Dashboard" }
                }
            }
        };
    }

    let current_q = quiz_container.questions[current_question_idx()].clone();
    let correct_ans = current_q.correct_answer.clone();
    let explanation_text = current_q.explanation.clone();
    let correct_ans_check = correct_ans.clone();
    
    // PERBAIKAN LIFETIME: Alokasikan opsi ke dalam Vec mandiri agar umurnya panjang ('static) saat dikonsumsi event onclick
    let quiz_options = current_q.options.clone();
    let tts_question = current_q.question.clone();
    let tts_lang_code = LANGUAGE_COURSES
        .iter()
        .find(|course| course.id.eq_ignore_ascii_case(&language))
        .map(|course| course.tts_lang_code)
        .unwrap_or("en-US");

    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center",
            div { class: "max-w-xl w-full bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl",
                
                div { class: "flex justify-between items-center border-b border-slate-800 pb-4 mb-6",
                    span { class: "text-xs font-bold text-teal-400 uppercase tracking-wider", "Latihan {language} ({level})" }
                    span { class: "text-xs text-slate-500 font-medium", "Pertanyaan {current_question_idx() + 1} dari {quiz_container.questions.len()}" }
                }
                p { class: "text-[11px] text-slate-400 mb-4", "Global language: " span { class: "text-teal-300 font-semibold", "{selected_language}" } }

                div { class: "flex items-start justify-between gap-3 mb-4",
                    h2 { class: "text-lg font-semibold text-slate-100 leading-relaxed flex-1", "{current_q.question}" }
                    div { class: "flex flex-col gap-2 shrink-0 items-end",
                    select {
                        class: "bg-slate-900 border border-slate-700 text-slate-300 rounded text-xs px-2 py-1",
                        value: if listen_speed() < 0.9 { "slow" } else if listen_speed() > 1.0 { "fast" } else { "normal" },
                        onchange: move |e| {
                            let v = e.value();
                            if v == "slow" {
                                listen_speed.set(0.8);
                            } else if v == "fast" {
                                listen_speed.set(1.1);
                            } else {
                                listen_speed.set(0.95);
                            }
                        },
                        option { value: "slow", "Slow" }
                        option { value: "normal", "Normal" }
                        option { value: "fast", "Fast" }
                    }
                    div { class: "flex gap-2",
                    button {
                        class: "bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded text-xs font-semibold transition-colors",
                        onclick: move |_| speak_with_edge_or_fallback(tts_lang_code.to_string(), tts_question.clone(), listen_speed()),
                        "Listen"
                    }
                    button {
                        class: "bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 px-3 py-2 rounded text-xs font-semibold transition-colors",
                        onclick: move |_| stop_speech(),
                        "Stop"
                    }
                    }
                    }
                }

                div { class: "flex flex-col gap-3 mb-6",
                    // Lakukan perulangan langsung dari Vec mandiri hasil kloning di atas
                    for option in quiz_options {
                        button {
                            class: format!(
                                "w-full text-left px-4 py-3 rounded-lg border text-sm transition-all font-medium {}",
                                if selected_option() == Some(option.clone()) {
                                    "bg-teal-500/10 border-teal-500 text-teal-400"
                                } else {
                                    "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300"
                                }
                            ),
                            disabled: show_explanation(),
                            onclick: move |_| {
                                selected_option.set(Some(option.clone()));
                                speak_with_edge_or_fallback(tts_lang_code.to_string(), option.clone(), listen_speed());
                            },
                            "{option}"
                        }
                    }
                }

                if show_explanation() {
                    div { class: "bg-slate-950 p-4 rounded-lg border border-slate-800 mb-6 text-sm",
                        if selected_option() == Some(correct_ans.clone()) {
                            p { class: "text-emerald-400 font-bold mb-1", "✓ Jawaban Benar!" }
                        } else {
                            p { class: "text-rose-400 font-bold mb-1", "✗ Jawaban Salah!" }
                            p { class: "text-slate-400 text-xs mb-2", "Kunci Jawaban: ", span { class: "text-slate-200 font-semibold", "{correct_ans}" } }
                        }
                        p { class: "text-slate-400 text-xs leading-relaxed", "{explanation_text}" }
                    }
                }

                div { class: "flex justify-end border-t border-slate-800 pt-4",
                    if !show_explanation() {
                        button {
                            class: "bg-teal-500 text-slate-950 font-bold px-6 py-2 rounded text-sm disabled:opacity-50 transition-colors",
                            disabled: selected_option().is_none(),
                            onclick: move |_| {
                                stop_speech();
                                if let Some(user) = user_opt.clone() {
                                    let cards = vec![NewFlashcard {
                                        language: language.clone(),
                                        front_text: current_q.question.clone(),
                                        back_text: format!("Jawaban benar: {} | Penjelasan: {}", correct_ans_check.clone(), explanation_text.clone()),
                                    }];
                                    spawn(async move {
                                        let _ = add_flashcards_server(user.username, cards).await;
                                    });
                                }
                                if selected_option() == Some(correct_ans_check.clone()) {
                                    score_gained.set(score_gained() + 20);
                                    if let Some(user) = user_opt.clone() {
                                        let lang = language.clone();
                                        let skill = classify_skill(&current_q.question, &explanation_text);
                                        spawn(async move {
                                            let _ = log_skill_progress_server(user.username, lang, skill, true).await;
                                        });
                                    }
                                } else if let Some(user) = user_opt.clone() {
                                    let topic = classify_weakness_topic(&explanation_text);
                                    let skill = classify_skill(&current_q.question, &explanation_text);
                                    let note = format!(
                                        "Q: {} | Selected: {} | Correct: {}",
                                        current_q.question,
                                        selected_option().unwrap_or_default(),
                                        correct_ans_check.clone()
                                    );
                                    let lang = language.clone();
                                    let username2 = user.username.clone();
                                    spawn(async move {
                                        let _ = log_weakness_server(user.username, lang, topic, note).await;
                                    });
                                    let lang2 = language.clone();
                                    spawn(async move {
                                        let _ = log_skill_progress_server(username2, lang2, skill, false).await;
                                    });
                                }
                                show_explanation.set(true);
                            },
                            "Cek Jawaban"
                        }
                    } else if current_question_idx() + 1 < quiz_container.questions.len() {
                        button {
                            class: "bg-slate-800 hover:bg-slate-700 text-white font-bold px-6 py-2 rounded text-sm transition-colors",
                            onclick: move |_| {
                                stop_speech();
                                current_question_idx.set(current_question_idx() + 1);
                                selected_option.set(None);
                                show_explanation.set(false);
                            },
                            "Pertanyaan Berikutnya"
                        }
                    } else {
                        button {
                            class: "bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-2 rounded text-sm transition-colors shadow-lg",
                            onclick: move |_| {
                                stop_speech();
                                let username = user_opt.as_ref().map(|u| u.username.clone()).unwrap_or_default();
                                let language = language.clone();
                                let score = score_gained();
                                let mut session_state = session_state;
                                let mut quiz_finished = quiz_finished;
                                spawn(async move {
                                    if !username.is_empty() {
                                        if let Ok(updated_profile) = update_user_score(username, language, score).await {
                                            let _ = update_engagement_after_quiz_server(updated_profile.username.clone(), score).await;
                                            session_state.set((Some(updated_profile), true));
                                            quiz_finished.set(true);
                                        }
                                    }
                                });
                            },
                            "Selesai & Simpan Skor"
                        }
                    }
                }
            }
        }
    }
}
