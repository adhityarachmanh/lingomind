use dioxus::prelude::*;
use crate::models::constants::LanguageCourse;
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
    let languages_res = use_context::<Resource<Vec<LanguageCourse>>>();
    let langs = languages_res().unwrap_or_default();
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, ready) = session_state();

    if !ready {
        return rsx! { div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900/30 dark:text-slate-50 flex items-center justify-center font-sans", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    }
    let Some(user) = user_opt else {
        return rsx! { div { class: "p-6 text-slate-600 dark:text-slate-400 font-sans", "Silakan login dulu." } };
    };

    let language = selected_language();
    let active_level = user.base_level(&language);

    let email = user.email.clone();
    let selected_lang_for_weakness = selected_language;
    let weakness_res = use_resource(move || {
        let u = email.clone();
        let l = selected_lang_for_weakness();
        async move { get_priority_weakness_server(u, l).await }
    });

    let Some(weakness_data) = weakness_res.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex items-center justify-center font-sans", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    };
    let weakness_topic = weakness_data.ok().flatten().unwrap_or(goal);

    let selected_lang_for_quiz = selected_language;
    let session_for_level = session_state;
    let topic2 = weakness_topic.clone();
    let email_for_quiz = user.email.clone();
    let quiz_res = use_resource(move || {
        let email_value = email_for_quiz.clone();
        let l = selected_lang_for_quiz();
        let (resource_user_opt, _) = session_for_level();
        let lv = resource_user_opt
            .as_ref()
            .map(|u| u.base_level(&l))
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
        return rsx! { div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex items-center justify-center font-sans", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    };
    let quiz = match quiz_data {
        Ok(q) => q,
        Err(e) => return rsx! { div { class: "p-6 text-rose-600 dark:text-rose-400 font-bold", "Gagal generate practice quiz: {e}" } },
    };

    if finished() {
        play_sfx(SFX_WINNER);
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col justify-center items-center px-4 py-6 sm:p-8 font-sans",
                div { class: "bg-white dark:bg-slate-900 p-6 sm:p-10 rounded-3xl border border-slate-200/30 dark:border-slate-700 text-center max-w-md w-full shadow-xl",
                    h2 { class: "text-5xl mb-4", "🎉" }
                    h3 { class: "text-3xl font-extrabold text-teal-600 dark:text-teal-400 mb-2", "Latihan Selesai!" }
                    p { class: "text-slate-500 dark:text-slate-400 text-sm mb-8 font-medium", "Kamu berhasil menuntaskan latihan fokus kelemahan." }
                    div { class: "bg-teal-50/30 dark:bg-teal-900/30 p-6 rounded-2xl border border-teal-100/50 dark:border-teal-900/50 mb-8",
                        p { class: "text-xs uppercase tracking-widest text-teal-600 dark:text-teal-400 font-bold mb-2", "Topik Fokus" }
                        p { class: "text-xl font-extrabold text-teal-700 leading-snug", "{weakness_topic}" }
                    }
                    Link { to: Route::Dashboard {}, class: "inline-block w-full bg-slate-800 hover:bg-slate-900 text-white py-3.5 rounded-xl font-bold transition-colors shadow-md", "Kembali ke Dashboard" }
                }
            }
        };
    }

    if quiz.questions.is_empty() {
        return rsx! { div { class: "p-8 text-amber-600 dark:text-amber-400 font-bold text-center", "Practice quiz kosong. Coba refresh halaman." } };
    }

    let current = quiz.questions[idx()].clone();
    let question_text = current.question.clone();
    let is_listening_question = current.question_type.eq_ignore_ascii_case("listening");
    let tts_question = question_audio_text(&current);
    let question_lines = format_question_for_display(&current.question);
    let tts_lang_code = langs
        .iter()
        .find(|course| course.id.eq_ignore_ascii_case(&language))
        .map(|course| course.tts_lang_code.clone())
        .unwrap_or_else(|| "en-US".to_string());
    let question_tts_lang_code = resolve_tts_lang_code(&tts_lang_code, &tts_question);

    let correct_ans_check = current.correct_answer.clone();
    let explanation_text = current.explanation.clone();
    let quiz_options = current.options.clone();

    rsx! {
        div { class: "min-h-screen bg-white dark:bg-slate-900 sm:bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 px-0 sm:px-4 py-0 sm:py-8 flex items-stretch sm:items-center justify-center font-sans pb-24 sm:pb-8",
            div { class: "max-w-3xl w-full bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-700 rounded-none sm:rounded-3xl p-6 sm:p-10 shadow-none sm:shadow-lg flex flex-col justify-between min-h-screen sm:min-h-0",
                
                div {
                    // Header progress bar timeline (Duolingo style)
                    div { class: "flex items-center gap-4 mb-6 sm:mb-8 border-b border-slate-100/50 dark:border-slate-800 pb-4",
                        Link {
                            to: Route::Dashboard {},
                            class: "text-slate-400 hover:text-slate-600/50 dark:text-slate-400 text-xl font-bold transition-colors cursor-pointer p-1",
                            "✕"
                        }
                        div { class: "flex-1 h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50 p-[2px]",
                            div {
                                class: "h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full transition-all duration-300 shadow-sm",
                                width: "{((idx() + 1) * 100 / quiz.questions.len()).min(100)}%"
                            }
                        }
                        span { class: "text-xs font-bold text-slate-500 dark:text-slate-400 font-mono shrink-0", "{idx() + 1}/{quiz.questions.len()}" }
                    }

                    // Level and status badges
                    div { class: "flex flex-wrap items-center gap-2 mb-4",
                        span { class: "text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/30 px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-100", "Fokus Kelemahan: {weakness_topic}" }
                        if is_listening_question {
                            span { class: "text-[10px] font-bold uppercase tracking-wider bg-amber-50/30 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 px-2.5 py-1 rounded-full", "Listening Test" }
                        }
                        span { class: "text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50/30 dark:bg-teal-900/30 px-2.5 py-1 rounded-full uppercase tracking-wider border border-teal-100/50 dark:border-teal-900/50", "{language} - {active_level}" }
                    }

                    // Question lines
                    div { class: "flex flex-col gap-4 mb-6",
                        h2 { class: "text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-200 leading-relaxed space-y-2",
                            for line in question_lines {
                                p {
                                    class: if line.starts_with("A:")
                                        || line.starts_with("B:")
                                        || line.starts_with("C:")
                                        || line.starts_with("D:")
                                        || line.starts_with("E:")
                                    {
                                        "text-slate-700 dark:text-slate-300 font-bold"
                                    } else if line.starts_with('\'') || line.starts_with('"') {
                                        "text-amber-700 italic font-medium"
                                    } else {
                                        "text-slate-800 dark:text-slate-200"
                                    },
                                    "{line}"
                                }
                            }
                        }
                    }

                    // Listen control card
                    div { class: "flex items-center justify-between bg-slate-50 dark:bg-slate-950 border border-slate-100/20 dark:border-slate-800 rounded-2xl p-3 sm:p-4 mb-6 gap-3 shadow-sm",
                        div { class: "flex items-center gap-2",
                            button {
                                class: "w-9 h-9 rounded-full bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center text-sm font-bold transition-all shadow-md shadow-teal-500/20 active:scale-95 cursor-pointer",
                                onclick: move |_| speak_with_edge_or_fallback(question_tts_lang_code.clone(), tts_question.clone(), listen_speed()),
                                "🔊"
                            }
                            button {
                                class: "w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 flex items-center justify-center text-xs font-bold transition-all active:scale-95 cursor-pointer",
                                onclick: move |_| stop_speech(),
                                "⏹"
                            }
                            span { class: "text-xs font-bold text-slate-500 dark:text-slate-400", if is_listening_question { "Dengarkan Soal" } else { "Pengucapan" } }
                        }
                        select {
                            class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs px-2 py-1.5 focus:outline-none focus:border-teal-500 cursor-pointer shadow-sm",
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
                            option { value: "slow", "🐢 Lambat" }
                            option { value: "normal", "🗣️ Normal" }
                            option { value: "fast", "⚡ Cepat" }
                        }
                    }

                    // Options Grid
                    div { class: "flex flex-col gap-3 mb-6",
                        {
                            quiz_options.into_iter().enumerate().map(|(opt_idx, option)| {
                                let option_for_select = option.clone();
                                let option_for_listen = option.clone();
                                let option_for_click = option.clone();
                                let option_tts_lang_code = resolve_tts_lang_code(&tts_lang_code, &option_for_listen);
                                let prefix = match opt_idx {
                                    0 => "A",
                                    1 => "B",
                                    2 => "C",
                                    3 => "D",
                                    4 => "E",
                                    _ => "?",
                                };
                                rsx! {
                                    div {
                                        key: "{option}",
                                        class: format!(
                                            "flex items-center justify-between p-4 rounded-2xl border-2 text-sm sm:text-base leading-relaxed transition-all font-bold active:scale-[0.99] cursor-pointer shadow-sm {}",
                                            if selected() == Some(option_for_select.clone()) {
                                                "bg-teal-50/30 dark:bg-teal-900/30/70 border-teal-500 text-teal-900 shadow-md ring-1 ring-teal-500/20"
                                            } else {
                                                "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                                            }
                                        ),
                                        onclick: move |_| {
                                            if !show_expl() {
                                                selected.set(Some(option_for_click.clone()));
                                            }
                                        },
                                        div { class: "flex-1 flex items-center gap-3.5 pr-2",
                                            div {
                                                class: format!(
                                                    "w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 shadow-sm {}",
                                                    if selected() == Some(option_for_select.clone()) {
                                                        "bg-teal-500 text-white"
                                                    } else {
                                                        "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                                    }
                                                ),
                                                "{prefix}"
                                            }
                                            span { class: "font-semibold text-left", "{option}" }
                                        }
                                        button {
                                            class: "w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:text-teal-600 dark:text-teal-400 transition-colors shadow-sm active:scale-90 cursor-pointer shrink-0",
                                            disabled: show_expl(),
                                            onclick: move |e| {
                                                e.stop_propagation();
                                                speak_with_edge_or_fallback(option_tts_lang_code.clone(), option_for_listen.clone(), listen_speed());
                                            },
                                            "🔊"
                                        }
                                    }
                                }
                            })
                        }
                    }

                    // Explanation Box
                    if show_expl() {
                        div { class: "bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6 text-sm shadow-inner",
                            if selected() == Some(correct_ans_check.clone()) {
                                p { class: "text-emerald-600 font-extrabold mb-2 text-base", "✓ Jawaban Benar!" }
                            } else {
                                p { class: "text-rose-600 dark:text-rose-400 font-extrabold mb-2 text-base", "✗ Jawaban Salah!" }
                                p { class: "text-slate-600 dark:text-slate-400 text-sm mb-3 font-medium", "Kunci Jawaban: ", span { class: "text-slate-900 dark:text-slate-50 font-bold bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700", "{correct_ans_check}" } }
                            }
                            p { class: "text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium", "{explanation_text}" }
                        }
                    }
                }

                // Sticky Bottom Action Container for Mobile / Relative for Desktop
                div { class: "fixed bottom-0 inset-x-0 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 sm:relative sm:border-0 sm:p-0 sm:bg-transparent sm:pt-6 z-40 safe-bottom flex justify-end",
                    if !show_expl() {
                        button {
                            class: "w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-bold px-8 py-3.5 rounded-2xl text-base disabled:opacity-50 transition-colors shadow-md hover:shadow-lg cursor-pointer",
                            disabled: selected().is_none(),
                            onclick: move |_| {
                                stop_speech();
                                if selected() != Some(correct_ans_check.clone()) {
                                    play_sfx(SFX_WRONG);
                                    let email_log = user.email.clone();
                                    let lang = language.clone();
                                    let topic = weakness_topic.clone();
                                    let note = format!(
                                        "Practice Q: {} | Selected: {} | Correct: {}",
                                        question_text.clone(),
                                        selected().unwrap_or_default(),
                                        correct_ans_check.clone()
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
                            class: "w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold px-8 py-3.5 rounded-2xl text-base transition-colors shadow-md hover:shadow-lg cursor-pointer",
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
                            class: "w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-8 py-3.5 rounded-2xl text-base transition-colors shadow-lg hover:shadow-xl cursor-pointer",
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
