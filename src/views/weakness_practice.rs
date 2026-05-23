use dioxus::prelude::*;
use crate::models::constants::LANGUAGE_COURSES;
use crate::models::quiz::QuizQuestion;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::gemini::{generate_weakness_practice_quiz_server, resolve_tts_lang_code, sanitize_tts_text};
use crate::services::weakness::{get_priority_weakness_server, log_weakness_server};

const SFX_CORRECT: Asset = asset!("/assets/correct.mp3");
const SFX_WRONG: Asset = asset!("/assets/wrong.mp3");
const SFX_WINNER: Asset = asset!("/assets/winner.mp3");

#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
#[cfg(target_arch = "wasm32")]
use std::sync::atomic::{AtomicU64, Ordering};
#[cfg(target_arch = "wasm32")]
use crate::services::gemini::generate_tts_audio_server;
#[cfg(target_arch = "wasm32")]
use crate::services::gemini::split_tts_segments;

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

#[cfg(target_arch = "wasm32")]
async fn play_edge_audio_segments(
    segments: Vec<(String, String)>,
    speed: f32,
    request_id: u64,
) -> Result<(), ()> {
    use gloo_timers::future::TimeoutFuture;

    for (segment_text, segment_lang) in segments {
        if AUDIO_REQUEST_SEQ.load(Ordering::SeqCst) != request_id {
            return Ok(());
        }

        let audio_src = generate_tts_audio_server(segment_text, segment_lang, speed)
            .await
            .map_err(|_| ())?;

        if AUDIO_REQUEST_SEQ.load(Ordering::SeqCst) != request_id {
            return Ok(());
        }

        let audio = web_sys::HtmlAudioElement::new_with_src(&audio_src).map_err(|_| ())?;
        ACTIVE_AUDIO.with(|slot| {
            if let Some(prev) = slot.borrow_mut().take() {
                let _ = prev.pause();
            }
            *slot.borrow_mut() = Some(audio.clone());
        });
        let _ = audio.play();

        loop {
            if AUDIO_REQUEST_SEQ.load(Ordering::SeqCst) != request_id {
                let _ = audio.pause();
                return Ok(());
            }
            if audio.ended() {
                break;
            }
            TimeoutFuture::new(35).await;
        }
    }

    Ok(())
}

fn speak_with_edge_or_fallback(tts_lang_code: String, text: String, speed: f32) {
    let normalized_text = sanitize_tts_text(&text);
    if normalized_text.is_empty() {
        return;
    }
    #[cfg(not(target_arch = "wasm32"))]
    let _ = speed;

    #[cfg(target_arch = "wasm32")]
    let segments = split_tts_segments(&tts_lang_code, &normalized_text)
        .into_iter()
        .map(|seg| (seg.text, seg.lang_code))
        .collect::<Vec<(String, String)>>();

    #[cfg(target_arch = "wasm32")]
    let request_id = AUDIO_REQUEST_SEQ.fetch_add(1, Ordering::SeqCst) + 1;

    spawn(async move {
        #[cfg(target_arch = "wasm32")]
        {
            if play_edge_audio_segments(segments.clone(), speed, request_id)
                .await
                .is_ok()
            {
                return;
            }
        }

        #[cfg(target_arch = "wasm32")]
        if let Some(window) = web_sys::window() {
            if let Ok(synth) = window.speech_synthesis() {
                synth.cancel();
                for (segment_text, segment_lang) in segments {
                    if let Ok(utterance) =
                        web_sys::SpeechSynthesisUtterance::new_with_text(&segment_text)
                    {
                        utterance.set_lang(&segment_lang);
                        utterance.set_rate(speed);
                        utterance.set_pitch(1.0);
                        synth.speak(&utterance);
                    }
                }
            }
        }

        #[cfg(not(target_arch = "wasm32"))]
        {
            let _ = (&tts_lang_code, &normalized_text, speed);
        }
    });
}

fn insert_newline_after_marker_case_insensitive(text: &str, marker: &str) -> String {
    let text_lower = text.to_lowercase();
    let marker_lower = marker.to_lowercase();

    if let Some(idx) = text_lower.find(&marker_lower) {
        let split_at = idx + marker.len();
        let left = text[..split_at].trim_end();
        let right = text[split_at..].trim_start();
        format!("{left}\n{right}")
    } else {
        text.to_string()
    }
}

fn format_question_for_display(question: &str) -> Vec<String> {
    let mut formatted = question
        .replace("Read the dialogue:", "Read the dialogue:\n")
        .replace("Read the dialog:", "Read the dialog:\n")
        .replace("read the dialogue:", "read the dialogue:\n")
        .replace("read the dialog:", "read the dialog:\n");

    for marker in [
        "based on the context:",
        "based on context:",
        "based on the sentence:",
        "in the context:",
    ] {
        formatted = insert_newline_after_marker_case_insensitive(&formatted, marker);
    }

    formatted = formatted
        .replace("sentence: ", "sentence:\n")
        .replace("blank: ", "blank:\n")
        .replace("word: ", "word:\n")
        .replace("following: ", "following:\n")
        .replace("question: ", "question:\n")
        .replace("statement: ", "statement:\n")
        .replace(": '", ":\n'")
        .replace(": \"", ":\n\"");

    for marker in ["A:", "B:", "C:", "D:", "E:"] {
        let from = format!(" {marker}");
        let to = format!("\n{marker}");
        formatted = formatted.replace(&from, &to);
    }

    formatted
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .map(|line| line.to_string())
        .collect()
}

fn question_audio_text(question: &QuizQuestion) -> String {
    if question.question_type.eq_ignore_ascii_case("listening") && !question.listen_text.trim().is_empty() {
        question.listen_text.clone()
    } else {
        question.question.clone()
    }
}

#[component]
pub fn WeaknessPractice(goal: String) -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, ready) = session_state();

    if !ready {
        return rsx! { div { class: "min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center font-sans", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    }
    let Some(user) = user_opt else {
        return rsx! { div { class: "p-6 text-slate-600 font-sans", "Silakan login dulu." } };
    };

    let language = selected_language();
    let active_level = user
        .current_level
        .get(&language)
        .cloned()
        .unwrap_or_else(|| "A1".to_string());

    let email = user.email.clone();
    let mut selected_lang_for_weakness = selected_language;
    let weakness_res = use_resource(move || {
        let u = email.clone();
        let l = selected_lang_for_weakness();
        async move { get_priority_weakness_server(u, l).await }
    });

    let Some(weakness_data) = weakness_res.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center font-sans", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    };
    let weakness_topic = weakness_data.ok().flatten().unwrap_or(goal);

    let mut selected_lang_for_quiz = selected_language;
    let session_for_level = session_state;
    let topic2 = weakness_topic.clone();
    let email_for_quiz = user.email.clone();
    let quiz_res = use_resource(move || {
        let email_value = email_for_quiz.clone();
        let l = selected_lang_for_quiz();
        let (resource_user_opt, _) = session_for_level();
        let lv = resource_user_opt
            .as_ref()
            .and_then(|u| u.current_level.get(&l).cloned())
            .unwrap_or_else(|| "A1".to_string());
        let t = topic2.clone();
        async move { generate_weakness_practice_quiz_server(email_value, l, lv, t).await }
    });

    let mut idx = use_signal(|| 0usize);
    let mut selected = use_signal(|| None::<String>);
    let mut show_expl = use_signal(|| false);
    let mut listen_speed = use_signal(|| 0.95_f32);
    let mut finished = use_signal(|| false);

    let Some(quiz_data) = quiz_res.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center font-sans", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    };
    let quiz = match quiz_data {
        Ok(q) => q,
        Err(e) => return rsx! { div { class: "p-6 text-rose-600 font-bold", "Gagal generate practice quiz: {e}" } },
    };

    if finished() {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 text-slate-900 px-4 py-6 sm:p-8 flex items-center justify-center font-sans",
                div { class: "max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 text-center shadow-xl",
                    h2 { class: "text-3xl font-extrabold text-teal-600 mb-3", "Practice Selesai" }
                    p { class: "text-slate-500 font-medium mb-8", "Kamu sudah menyelesaikan practice topik: ", span { class: "text-slate-800 font-bold", "{weakness_topic}" } }
                    Link { to: Route::Dashboard {}, class: "inline-block w-full bg-teal-500 hover:bg-teal-600 text-white px-6 py-3.5 rounded-xl font-bold shadow-md transition-colors", "Kembali ke Dashboard" }
                }
            }
        };
    }

    if quiz.questions.is_empty() {
        return rsx! { div { class: "p-8 text-amber-600 font-bold text-center", "Practice quiz kosong. Coba refresh halaman." } };
    }

    let current = quiz.questions[idx()].clone();
    let question_text = current.question.clone();
    let is_listening_question = current.question_type.eq_ignore_ascii_case("listening");
    let tts_question = question_audio_text(&current);
    let question_lines = format_question_for_display(&current.question);
    let tts_lang_code = LANGUAGE_COURSES
        .iter()
        .find(|course| course.id.eq_ignore_ascii_case(&language))
        .map(|course| course.tts_lang_code)
        .unwrap_or("en-US");
    let question_tts_lang_code = resolve_tts_lang_code(tts_lang_code, &tts_question);

    rsx! {
        div { class: "min-h-screen bg-slate-50 text-slate-900 px-4 py-6 sm:p-8 flex items-start sm:items-center justify-center font-sans",
            div { class: "max-w-3xl w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-lg",
                div { class: "flex flex-wrap items-center gap-3 mb-2",
                    p { class: "text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1 rounded-full uppercase tracking-wider", "Weakness focus: {weakness_topic}" }
                    if is_listening_question {
                        span { class: "text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1 rounded-full", "Listening Test" }
                    }
                }
                p { class: "text-xs text-slate-500 font-medium mb-4", "Global language: ", span { class: "font-bold text-teal-600", "{language}" }, " - Level {active_level}" }
                p { class: "text-sm text-slate-500 font-bold bg-slate-50 px-4 py-1.5 rounded-full inline-block mb-6", "Soal {idx() + 1}/{quiz.questions.len()}" }

                div { class: "flex flex-col gap-4 mb-8",
                    h2 { class: "text-lg sm:text-xl font-extrabold text-slate-800 leading-relaxed space-y-2",
                        for line in question_lines {
                            p {
                                class: if line.starts_with("A:")
                                    || line.starts_with("B:")
                                    || line.starts_with("C:")
                                    || line.starts_with("D:")
                                    || line.starts_with("E:")
                                {
                                    "text-slate-700 font-bold"
                                } else if line.starts_with('\'') || line.starts_with('"') {
                                    "text-amber-700 italic font-medium"
                                } else {
                                    "text-slate-800"
                                },
                                "{line}"
                            }
                        }
                    }
                    div { class: "flex flex-wrap items-center gap-3",
                        select {
                            class: "bg-white border border-slate-300 text-slate-700 font-medium rounded-xl text-sm px-4 py-2 min-h-10 shadow-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20",
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
                            class: "bg-teal-500 hover:bg-teal-600 text-white px-5 py-2 min-h-10 rounded-xl text-sm font-bold transition-colors shadow-sm",
                            onclick: move |_| speak_with_edge_or_fallback(question_tts_lang_code.clone(), tts_question.clone(), listen_speed()),
                            "Listen"
                        }
                        button {
                            class: "bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2 min-h-10 rounded-xl text-sm font-bold transition-colors shadow-sm",
                            onclick: move |_| stop_speech(),
                            "Stop"
                        }
                    }
                    p { class: "text-xs text-slate-500 font-medium", "Tip: klik opsi untuk memilih jawaban, klik tombol Listen pada opsi untuk mendengarkan." }
                    if is_listening_question {
                        p { class: "text-xs text-amber-600 font-bold", "Mode listening aktif: dengarkan audio dulu, kemudian pilih jawaban yang paling sesuai." }
                    }
                }

                div { class: "flex flex-col gap-3 sm:gap-4 mb-8",
                    for opt in current.options.clone() {
                        {
                            let opt_for_select = opt.clone();
                            let opt_for_listen = opt.clone();
                            let option_tts_lang_code = resolve_tts_lang_code(tts_lang_code, &opt_for_listen);
                            rsx! {
                                div { class: "flex items-stretch gap-3",
                                    button {
                                        class: format!(
                                            "flex-1 text-left px-5 py-4 rounded-xl border-2 text-base leading-relaxed transition-all font-bold {}",
                                            if selected() == Some(opt_for_select.clone()) {
                                                "bg-teal-50 border-teal-500 text-teal-800 shadow-sm"
                                            } else {
                                                "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm"
                                            }
                                        ),
                                        disabled: show_expl(),
                                        onclick: move |_| selected.set(Some(opt_for_select.clone())),
                                        "{opt}"
                                    }
                                    button {
                                        class: "shrink-0 px-4 py-2 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-600 text-sm font-bold min-w-20 transition-colors shadow-sm",
                                        disabled: show_expl(),
                                        onclick: move |_| speak_with_edge_or_fallback(option_tts_lang_code.clone(), opt_for_listen.clone(), listen_speed()),
                                        "Listen"
                                    }
                                }
                            }
                        }
                    }
                }

                if show_expl() {
                    div { class: "bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-8 text-sm shadow-inner",
                        if selected() == Some(current.correct_answer.clone()) {
                            p { class: "text-emerald-600 font-extrabold mb-2 text-base", "✓ Jawaban Benar!" }
                        } else {
                            p { class: "text-rose-600 font-extrabold mb-2 text-base", "✗ Jawaban Salah!" }
                            p { class: "text-slate-600 text-sm mb-3 font-medium", "Kunci Jawaban: ", span { class: "text-slate-900 font-bold bg-white px-2 py-1 rounded border border-slate-200", "{current.correct_answer}" } }
                        }
                        p { class: "text-slate-700 text-sm leading-relaxed font-medium", "{current.explanation}" }
                    }
                }

                div { class: "border-t border-slate-100 pt-6",
                    if !show_expl() {
                        button {
                            class: "w-full sm:w-auto sm:ml-auto block bg-teal-500 hover:bg-teal-600 text-white font-bold px-8 py-3.5 rounded-xl text-base disabled:opacity-50 transition-colors shadow-md hover:shadow-lg",
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
                            "Cek Jawaban"
                        }
                    } else if idx() + 1 < quiz.questions.len() {
                        button {
                            class: "w-full sm:w-auto sm:ml-auto block bg-slate-800 hover:bg-slate-900 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors shadow-md hover:shadow-lg",
                            onclick: move |_| {
                                stop_speech();
                                idx.set(idx() + 1);
                                selected.set(None);
                                show_expl.set(false);
                            },
                            "Pertanyaan Berikutnya"
                        }
                    } else {
                        button {
                            class: "w-full sm:w-auto sm:ml-auto block bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg hover:shadow-xl",
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
