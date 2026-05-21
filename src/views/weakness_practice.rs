use dioxus::prelude::*;
use crate::models::constants::LANGUAGE_COURSES;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::gemini::{generate_tts_audio_server, generate_weakness_practice_quiz_server, sanitize_tts_text};
use crate::services::weakness::{get_priority_weakness_server, log_weakness_server};

const SFX_CORRECT: Asset = asset!("/assets/correct.mp3");
const SFX_WRONG: Asset = asset!("/assets/wrong.mp3");
const SFX_WINNER: Asset = asset!("/assets/winner.mp3");

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

fn play_sfx(src: Asset) {
    let s = src.to_string();
    play_audio_src(&s);
}

fn speak_with_edge_or_fallback(tts_lang_code: String, text: String, speed: f32) {
    let normalized_text = sanitize_tts_text(&text);
    if normalized_text.is_empty() {
        return;
    }

    #[cfg(target_arch = "wasm32")]
    let request_id = AUDIO_REQUEST_SEQ.fetch_add(1, Ordering::SeqCst) + 1;

    spawn(async move {
        match generate_tts_audio_server(normalized_text.clone(), tts_lang_code.clone(), speed).await {
            Ok(audio_src) => {
                #[cfg(target_arch = "wasm32")]
                if AUDIO_REQUEST_SEQ.load(Ordering::SeqCst) != request_id {
                    return;
                }
                play_audio_src(&audio_src)
            }
            Err(_) => {
                #[cfg(target_arch = "wasm32")]
                if let Some(window) = web_sys::window() {
                    if let Ok(synth) = window.speech_synthesis() {
                        synth.cancel();
                        if let Ok(utterance) = web_sys::SpeechSynthesisUtterance::new_with_text(&normalized_text) {
                            utterance.set_lang(&tts_lang_code);
                            utterance.set_rate(speed);
                            utterance.set_pitch(1.0);
                            synth.speak(&utterance);
                        }
                    }
                }
            }
        }
    });
}

#[component]
pub fn WeaknessPractice(level: String, goal: String) -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, ready) = session_state();

    if !ready {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Loading..." } };
    }
    let Some(user) = user_opt else {
        return rsx! { div { class: "p-6 text-slate-300", "Silakan login dulu." } };
    };

    let language = selected_language();
    let active_level = user
        .current_level
        .get(&language)
        .cloned()
        .unwrap_or_else(|| level.clone());

    let email = user.email.clone();
    let mut selected_lang_for_weakness = selected_language;
    let weakness_res = use_resource(move || {
        let u = email.clone();
        let l = selected_lang_for_weakness();
        async move { get_priority_weakness_server(u, l).await }
    });

    let Some(weakness_data) = weakness_res.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Mengambil data kelemahan..." } };
    };
    let weakness_topic = weakness_data.ok().flatten().unwrap_or(goal);

    let mut selected_lang_for_quiz = selected_language;
    let session_for_level = session_state;
    let fallback_level = level.clone();
    let topic2 = weakness_topic.clone();
    let email_for_quiz = user.email.clone();
    let quiz_res = use_resource(move || {
        let email_value = email_for_quiz.clone();
        let l = selected_lang_for_quiz();
        let (resource_user_opt, _) = session_for_level();
        let lv = resource_user_opt
            .as_ref()
            .and_then(|u| u.current_level.get(&l).cloned())
            .unwrap_or_else(|| fallback_level.clone());
        let t = topic2.clone();
        async move { generate_weakness_practice_quiz_server(email_value, l, lv, t).await }
    });

    let mut idx = use_signal(|| 0usize);
    let mut selected = use_signal(|| None::<String>);
    let mut show_expl = use_signal(|| false);
    let mut listen_speed = use_signal(|| 0.95_f32);
    let mut finished = use_signal(|| false);

    let Some(quiz_data) = quiz_res.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Menyusun practice quiz..." } };
    };
    let quiz = match quiz_data {
        Ok(q) => q,
        Err(e) => return rsx! { div { class: "p-6 text-rose-400", "Gagal generate practice quiz: {e}" } },
    };

    if finished() {
        return rsx! {
            div { class: "min-h-screen bg-slate-950 text-white px-3 py-4 sm:p-6 flex items-center justify-center",
                div { class: "max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 text-center",
                    h2 { class: "text-2xl font-bold text-emerald-300 mb-2", "Practice Selesai" }
                    p { class: "text-sm text-slate-400 mb-5", "Kamu sudah menyelesaikan practice topik: {weakness_topic}" }
                    Link { to: Route::Dashboard {}, class: "inline-block w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-5 py-3 rounded font-bold", "Kembali ke Dashboard" }
                }
            }
        };
    }

    if quiz.questions.is_empty() {
        return rsx! { div { class: "p-6 text-amber-400", "Practice quiz kosong. Coba refresh halaman." } };
    }

    let current = quiz.questions[idx()].clone();
    let question_text = current.question.clone();
    let tts_lang_code = LANGUAGE_COURSES
        .iter()
        .find(|course| course.id.eq_ignore_ascii_case(&language))
        .map(|course| course.tts_lang_code)
        .unwrap_or("en-US");

    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white px-3 py-4 sm:p-6 flex items-start sm:items-center justify-center",
            div { class: "max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6",
                p { class: "text-xs text-amber-300 mb-1", "Weakness focus: {weakness_topic}" }
                p { class: "text-[11px] text-slate-400 mb-3", "Global language: {language} - Level {active_level}" }
                p { class: "text-xs text-slate-500 mb-4", "Soal {idx() + 1}/{quiz.questions.len()}" }

                div { class: "flex flex-col gap-3 mb-5",
                    h2 { class: "text-base sm:text-lg font-semibold leading-relaxed", "{current.question}" }
                    div { class: "flex flex-wrap items-center gap-2",
                        select {
                            class: "bg-slate-900 border border-slate-700 text-slate-300 rounded text-xs px-3 py-2 min-h-9",
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
                        button {
                            class: "bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 min-h-9 rounded text-xs font-semibold",
                            onclick: move |_| speak_with_edge_or_fallback(tts_lang_code.to_string(), current.question.clone(), listen_speed()),
                            "Listen"
                        }
                        button {
                            class: "bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 px-3 py-2 min-h-9 rounded text-xs font-semibold",
                            onclick: move |_| stop_speech(),
                            "Stop"
                        }
                    }
                }

                div { class: "flex flex-col gap-2.5 sm:gap-3 mb-5",
                    for opt in current.options.clone() {
                        button {
                            class: format!(
                                "text-left px-4 py-3.5 rounded border text-sm sm:text-[15px] leading-relaxed {}",
                                if selected() == Some(opt.clone()) {
                                    "bg-teal-500/10 border-teal-500"
                                } else {
                                    "bg-slate-950 border-slate-800"
                                }
                            ),
                            disabled: show_expl(),
                            onclick: move |_| {
                                selected.set(Some(opt.clone()));
                                speak_with_edge_or_fallback(tts_lang_code.to_string(), opt.clone(), listen_speed());
                            },
                            "{opt}"
                        }
                    }
                }

                if show_expl() {
                    div { class: "bg-slate-950 border border-slate-800 rounded p-3.5 text-sm mb-5",
                        p { class: "text-slate-300", "Kunci: {current.correct_answer}" }
                        p { class: "text-slate-400 mt-1", "{current.explanation}" }
                    }
                }

                div { class: "border-t border-slate-800 pt-4",
                    if !show_expl() {
                        button {
                            class: "w-full sm:w-auto sm:ml-auto bg-teal-500 text-slate-950 px-5 py-3 rounded font-bold disabled:opacity-40",
                            disabled: selected().is_none(),
                            onclick: move |_| {
                                stop_speech();
                                if selected() != Some(current.correct_answer.clone()) {
                                    play_sfx(SFX_WRONG);
                                    let email_log = user.email.clone();
                                    let lang = language.clone();
                                    let topic = weakness_topic.clone();
                                    let note = format!(
                                        "Practice Q: {} | Selected: {} | Correct: {}",
                                        question_text.clone(),
                                        selected().unwrap_or_default(),
                                        current.correct_answer
                                    );
                                    spawn(async move {
                                        let _ = log_weakness_server(email_log, lang, topic, note).await;
                                    });
                                } else {
                                    play_sfx(SFX_CORRECT);
                                }
                                show_expl.set(true);
                            },
                            "Cek"
                        }
                    } else if idx() + 1 < quiz.questions.len() {
                        button {
                            class: "w-full sm:w-auto sm:ml-auto bg-slate-800 hover:bg-slate-700 px-5 py-3 rounded font-bold",
                            onclick: move |_| {
                                stop_speech();
                                idx.set(idx() + 1);
                                selected.set(None);
                                show_expl.set(false);
                            },
                            "Next"
                        }
                    } else {
                        button {
                            class: "w-full sm:w-auto sm:ml-auto bg-emerald-500 text-slate-950 px-5 py-3 rounded font-bold",
                            onclick: move |_| {
                                stop_speech();
                                play_sfx(SFX_WINNER);
                                finished.set(true);
                            },
                            "Selesai"
                        }
                    }
                }
            }
        }
    }
}
