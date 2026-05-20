use dioxus::prelude::*;
use crate::models::constants::LANGUAGE_COURSES;
use crate::models::user::UserProfile;
use crate::services::gemini::{generate_tts_audio_server, generate_weakness_practice_quiz_server};
use crate::services::weakness::{get_priority_weakness_server, log_weakness_server};

const SFX_CORRECT: Asset = asset!("/assets/correct.mp3");
const SFX_WRONG: Asset = asset!("/assets/wrong.mp3");
const SFX_WINNER: Asset = asset!("/assets/winner.mp3");

#[cfg(target_arch = "wasm32")]
fn play_audio_src(src: &str) {
    if let Ok(audio) = web_sys::HtmlAudioElement::new_with_src(src) {
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
    spawn(async move {
        match generate_tts_audio_server(text.clone(), tts_lang_code.clone(), speed).await {
            Ok(audio_src) => play_audio_src(&audio_src),
            Err(_) => {
                #[cfg(target_arch = "wasm32")]
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
        }
    });
}

#[component]
pub fn WeaknessPractice(language: String, level: String, goal: String) -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let (user_opt, ready) = session_state();
    if !ready {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Loading..." } };
    }
    let Some(user) = user_opt else {
        return rsx! { div { class: "p-6 text-slate-300", "Silakan login dulu." } };
    };

    let email = user.email.clone();
    let lang_for_weakness = language.clone();
    let weakness_res = use_resource(move || {
        let u = email.clone();
        let l = lang_for_weakness.clone();
        async move { get_priority_weakness_server(u, l).await }
    });

    let Some(weakness_data) = weakness_res.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Mengambil data kelemahan..." } };
    };
    let weakness_topic = weakness_data.ok().flatten().unwrap_or(goal);

    let l2 = language.clone();
    let lv2 = level.clone();
    let topic2 = weakness_topic.clone();
    let quiz_res = use_resource(move || {
        let l = l2.clone();
        let lv = lv2.clone();
        let t = topic2.clone();
        async move { generate_weakness_practice_quiz_server(l, lv, t).await }
    });

    let mut idx = use_signal(|| 0usize);
    let mut selected = use_signal(|| None::<String>);
    let mut show_expl = use_signal(|| false);
    let mut listen_speed = use_signal(|| 0.95_f32);

    let Some(quiz_data) = quiz_res.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Menyusun practice quiz..." } };
    };
    let quiz = match quiz_data {
        Ok(q) => q,
        Err(e) => return rsx! { div { class: "p-6 text-rose-400", "Gagal generate practice quiz: {e}" } },
    };
    let current = quiz.questions[idx()].clone();
    let question_text = current.question.clone();
    let tts_lang_code = LANGUAGE_COURSES
        .iter()
        .find(|course| course.id.eq_ignore_ascii_case(&language))
        .map(|course| course.tts_lang_code)
        .unwrap_or("en-US");

    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center",
            div { class: "max-w-xl w-full bg-slate-900 border border-slate-800 rounded-xl p-6",
                p { class: "text-xs text-amber-300 mb-2", "Weakness focus: {weakness_topic}" }
                p { class: "text-xs text-slate-500 mb-4", "Soal {idx() + 1}/{quiz.questions.len()}" }
                div { class: "flex items-start justify-between gap-3 mb-4",
                    h2 { class: "text-lg font-semibold flex-1", "{current.question}" }
                    div { class: "flex gap-2",
                        select {
                            class: "bg-slate-900 border border-slate-700 text-slate-300 rounded text-xs px-2 py-1",
                            value: if listen_speed() < 0.9 { "slow" } else if listen_speed() > 1.0 { "fast" } else { "normal" },
                            onchange: move |e| {
                                let v = e.value();
                                if v == "slow" { listen_speed.set(0.8); } else if v == "fast" { listen_speed.set(1.1); } else { listen_speed.set(0.95); }
                            },
                            option { value: "slow", "Slow" }
                            option { value: "normal", "Normal" }
                            option { value: "fast", "Fast" }
                        }
                        button {
                            class: "bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded text-xs font-semibold",
                            onclick: move |_| speak_with_edge_or_fallback(tts_lang_code.to_string(), current.question.clone(), listen_speed()),
                            "Listen"
                        }
                    }
                }
                div { class: "flex flex-col gap-2 mb-4",
                    for opt in current.options.clone() {
                        button {
                            class: format!("text-left px-4 py-3 rounded border {}", if selected() == Some(opt.clone()) { "bg-teal-500/10 border-teal-500" } else { "bg-slate-950 border-slate-800" }),
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
                    div { class: "bg-slate-950 border border-slate-800 rounded p-3 text-sm mb-4",
                        p { class: "text-slate-300", "Kunci: {current.correct_answer}" }
                        p { class: "text-slate-400 mt-1", "{current.explanation}" }
                    }
                }
                div { class: "flex justify-end",
                    if !show_expl() {
                        button {
                            class: "bg-teal-500 text-slate-950 px-5 py-2 rounded font-bold disabled:opacity-40",
                            disabled: selected().is_none(),
                            onclick: move |_| {
                                if selected() != Some(current.correct_answer.clone()) {
                                    play_sfx(SFX_WRONG);
                                    let email = user.email.clone();
                                    let lang = language.clone();
                                    let topic = weakness_topic.clone();
                                    let note = format!("Practice Q: {} | Selected: {} | Correct: {}", question_text.clone(), selected().unwrap_or_default(), current.correct_answer);
                                    spawn(async move { let _ = log_weakness_server(email, lang, topic, note).await; });
                                } else {
                                    play_sfx(SFX_CORRECT);
                                }
                                show_expl.set(true)
                            },
                            "Cek"
                        }
                    } else if idx() + 1 < quiz.questions.len() {
                        button {
                            class: "bg-slate-800 hover:bg-slate-700 px-5 py-2 rounded font-bold",
                            onclick: move |_| { idx.set(idx() + 1); selected.set(None); show_expl.set(false); },
                            "Next"
                        }
                    } else {
                        button {
                            class: "bg-emerald-500 text-slate-950 px-5 py-2 rounded font-bold",
                            onclick: move |_| { play_sfx(SFX_WINNER); },
                            a { href: "/dashboard", "Selesai" }
                        }
                    }
                }
            }
        }
    }
}
