use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::models::constants::LANGUAGE_COURSES;
use crate::models::quiz::QuizQuestion;
use crate::services::gemini::generate_exam_server;
use crate::services::gemini::resolve_tts_lang_code;
use crate::services::gemini::sanitize_tts_text;
use crate::services::auth::submit_exam_result;
use crate::routes::Route;

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
        .replace("read the dialog:", "read the dialog:\n")
        .replace("Read the passage:", "Read the passage:\n")
        .replace("Read the text:", "Read the text:\n");

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
pub fn Exam(level: String) -> Element {
    let mut session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, ready) = session_state();

    if !ready {
        return rsx! { div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900/30 dark:text-slate-50 flex items-center justify-center font-sans", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" } } };
    }
    let Some(user) = user_opt.clone() else {
        return rsx! { div { class: "p-6 text-slate-600 dark:text-slate-400 font-sans", "Silakan login dulu." } };
    };

    let language = selected_language();
    
    // Validasi agar cuma user yang di topik akhir yang boleh ikut ujian
    let user_level_str = user.get_language_level(&language);
    let (base_lvl, topic_idx) = if let Some(idx) = user_level_str.find('.') {
        let base = user_level_str[..idx].to_string();
        let topic = user_level_str[idx + 1..].parse::<usize>().unwrap_or(0);
        (base, topic)
    } else {
        (user_level_str.clone(), 0)
    };

    if base_lvl != level || topic_idx < 4 {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center font-sans p-6",
                div { class: "bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-lg text-center max-w-md w-full border border-slate-200 dark:border-slate-800",
                    h2 { class: "text-5xl mb-4", "🔒" }
                    h3 { class: "text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2", "Ujian Belum Terbuka" }
                    p { class: "text-slate-600 dark:text-slate-400 mb-6", "Anda belum menyelesaikan semua topik di level {level} untuk mengambil ujian ini." }
                    Link { to: Route::Roadmap {}, class: "block w-full bg-teal-500 text-white font-bold py-3 rounded-xl hover:bg-teal-600 transition", "Kembali ke Roadmap" }
                }
            }
        };
    }

    let lang = language.clone();
    let lvl = level.clone();
    
    let exam_resource = use_resource(move || {
        let l = lang.clone();
        let lv = lvl.clone();
        async move { generate_exam_server(l, lv).await }
    });

    let mut current_question_idx = use_signal(|| 0usize);
    let mut selected_option = use_signal(|| None::<String>);
    let mut show_explanation = use_signal(|| false);
    let mut correct_answers_count = use_signal(|| 0usize);
    let mut listen_speed = use_signal(|| 0.95_f32);
    let mut exam_finished = use_signal(|| false);
    let mut submitting_result = use_signal(|| false);

    let Some(exam_result) = exam_resource.value()() else {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col items-center justify-center font-sans p-6",
                div { class: "animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-500 mb-6" }
                p { class: "text-amber-700 dark:text-amber-500 font-bold text-lg animate-pulse", "Menyusun soal ujian tingkat lanjut..." }
                p { class: "text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-md text-center", "Proses ini mungkin memakan waktu hingga 30 detik untuk memastikan kualitas soal ujian yang tinggi." }
            }
        };
    };

    let exam_container = match exam_result {
        Ok(q) => q,
        Err(e) => {
            return rsx! {
                div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center",
                    div { class: "bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-lg border border-red-200 dark:border-red-900/30 max-w-md text-center",
                        h3 { class: "text-2xl font-bold text-red-600 dark:text-red-500 mb-4", "Gagal Memuat Ujian" }
                        p { class: "text-slate-600 dark:text-slate-400 mb-6 text-sm", "{e}" }
                        Link { to: Route::Roadmap {}, class: "block w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition", "Kembali ke Roadmap" }
                    }
                }
            };
        }
    };

    if exam_finished() {
        let total = exam_container.questions.len();
        let correct = correct_answers_count();
        let passing_score = (total as f32 * 0.75).ceil() as usize; // 75% to pass
        let passed = correct >= passing_score;

        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center px-4 py-6 font-sans",
                div { class: "bg-white dark:bg-slate-900 p-8 md:p-10 rounded-3xl border border-slate-200/50 dark:border-slate-800 text-center max-w-md w-full shadow-2xl relative overflow-hidden",
                    // Decorative background gradient
                    div { class: format!("absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none {}", if passed { "bg-emerald-500" } else { "bg-rose-500" }) }
                    div { class: format!("absolute -bottom-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none {}", if passed { "bg-emerald-500" } else { "bg-rose-500" }) }
                    
                    if passed {
                        h2 { class: "text-6xl mb-4 animate-bounce", "🎉" }
                        h3 { class: "text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mb-2", "LULUS UJIAN!" }
                        p { class: "text-slate-600 dark:text-slate-400 text-sm mb-6 font-medium", "Selamat! Anda telah menguasai materi level {level} dan siap untuk melangkah lebih jauh." }
                    } else {
                        h2 { class: "text-6xl mb-4", "💪" }
                        h3 { class: "text-3xl font-extrabold text-rose-600 dark:text-rose-400 mb-2", "BELUM LULUS" }
                        p { class: "text-slate-600 dark:text-slate-400 text-sm mb-6 font-medium", "Jangan menyerah! Pelajari lagi bagian yang kurang dan coba kembali ujian ini nanti." }
                    }

                    div { class: "bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 mb-8",
                        div { class: "flex items-center justify-between mb-2",
                            span { class: "text-slate-500 font-bold text-sm", "Skor Anda" }
                            span { class: format!("font-black text-xl {}", if passed { "text-emerald-600" } else { "text-rose-600" }), "{correct} / {total}" }
                        }
                        div { class: "w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 mb-2",
                            div {
                                class: format!("h-2.5 rounded-full {}", if passed { "bg-emerald-500" } else { "bg-rose-500" }),
                                style: "width: {(correct as f32 / total as f32) * 100.0}%"
                            }
                        }
                        p { class: "text-xs text-slate-400 font-medium text-left mt-2", "Batas kelulusan minimal {passing_score} benar (75%)." }
                    }

                    button {
                        class: "w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50",
                        disabled: submitting_result(),
                        onclick: move |_| {
                            submitting_result.set(true);
                            let email_val = user.email.clone();
                            let lang_val = language.clone();
                            let passed_val = passed;
                            spawn(async move {
                                if let Ok(updated_profile) = submit_exam_result(email_val, lang_val, passed_val).await {
                                    session_state.set((Some(updated_profile), true));
                                }
                                // Navigate anyway
                                let navigator = use_navigator();
                                navigator.replace(Route::Roadmap {});
                            });
                        },
                        if submitting_result() {
                            "Menyimpan..."
                        } else {
                            "Kembali ke Roadmap"
                        }
                    }
                }
            }
        };
    }

    if exam_container.questions.is_empty() {
        return rsx! { div { class: "p-8 text-rose-600 font-bold text-center", "Ujian kosong." } };
    }

    let current_q = exam_container.questions[current_question_idx()].clone();
    let is_listening_question = current_q.question_type.eq_ignore_ascii_case("listening");
    let tts_question = question_audio_text(&current_q);
    let question_lines = format_question_for_display(&current_q.question);
    
    let tts_lang_code = LANGUAGE_COURSES
        .iter()
        .find(|course| course.id.eq_ignore_ascii_case(&language))
        .map(|course| course.tts_lang_code)
        .unwrap_or("en-US");
    let question_tts_lang_code = resolve_tts_lang_code(tts_lang_code, &tts_question);

    let correct_ans_check = current_q.correct_answer.clone();
    let explanation_text = current_q.explanation.clone();
    let quiz_options = current_q.options.clone();
    let total_questions = exam_container.questions.len();

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 px-0 sm:px-4 py-0 sm:py-8 flex items-stretch sm:items-center justify-center font-sans pb-24 sm:pb-8",
            div { class: "max-w-4xl w-full bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-3xl p-6 sm:p-10 shadow-none sm:shadow-2xl flex flex-col justify-between min-h-screen sm:min-h-0",
                
                div {
                    // Header progress bar timeline (Exam style - more serious)
                    div { class: "flex items-center gap-4 mb-6 sm:mb-8 border-b border-slate-200/50 dark:border-slate-800 pb-4",
                        Link {
                            to: Route::Roadmap {},
                            class: "text-slate-400 hover:text-slate-600 dark:text-slate-500 text-xl font-bold transition-colors cursor-pointer p-1",
                            "✕"
                        }
                        div { class: "flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden",
                            div {
                                class: "h-full bg-amber-500 rounded-full transition-all duration-300",
                                width: "{((current_question_idx() + 1) * 100 / total_questions).min(100)}%"
                            }
                        }
                        span { class: "text-sm font-black text-amber-600 dark:text-amber-500 shrink-0 uppercase tracking-widest", "EXAM: {current_question_idx() + 1}/{total_questions}" }
                    }

                    // Level and status badges
                    div { class: "flex flex-wrap items-center gap-2 mb-6",
                        if is_listening_question {
                            span { class: "text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full", "Listening Section" }
                        } else {
                            span { class: "text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full", "Reading & Grammar" }
                        }
                        span { class: "text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full uppercase tracking-wider", "{language} - CEFR {level}" }
                    }

                    // Question lines
                    div { class: "flex flex-col gap-4 mb-8",
                        h2 { class: "text-lg sm:text-xl font-medium text-slate-800 dark:text-slate-200 leading-loose space-y-3",
                            for line in question_lines {
                                p {
                                    class: if line.starts_with("A:")
                                        || line.starts_with("B:")
                                        || line.starts_with("C:")
                                        || line.starts_with("D:")
                                        || line.starts_with("E:")
                                    {
                                        "text-slate-700 dark:text-slate-300 font-bold mt-2"
                                    } else if line.starts_with('\'') || line.starts_with('"') {
                                        "text-amber-700 dark:text-amber-500 italic font-medium p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100/50 dark:border-amber-900/30"
                                    } else {
                                        "text-slate-800 dark:text-slate-200"
                                    },
                                    "{line}"
                                }
                            }
                        }
                    }

                    // Listen control card
                    div { class: "flex items-center justify-between bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 mb-8 gap-3 shadow-inner",
                        div { class: "flex items-center gap-3",
                            button {
                                class: "w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center text-sm font-bold transition-all shadow-md active:scale-95 cursor-pointer",
                                onclick: move |_| speak_with_edge_or_fallback(question_tts_lang_code.clone(), tts_question.clone(), listen_speed()),
                                "🔊"
                            }
                            button {
                                class: "w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center text-xs font-bold transition-all active:scale-95 cursor-pointer",
                                onclick: move |_| stop_speech(),
                                "⏹"
                            }
                            span { class: "text-xs font-bold text-slate-500 dark:text-slate-400", if is_listening_question { "Dengarkan Audio" } else { "Putar Pengucapan" } }
                        }
                        select {
                            class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer shadow-sm",
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
                    div { class: "flex flex-col gap-4 mb-8",
                        {
                            quiz_options.into_iter().enumerate().map(|(opt_idx, option)| {
                                let option_for_select = option.clone();
                                let option_for_listen = option.clone();
                                let option_for_click = option.clone();
                                let option_tts_lang_code = resolve_tts_lang_code(tts_lang_code, &option_for_listen);
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
                                            "flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 text-sm sm:text-base leading-relaxed transition-all font-medium active:scale-[0.99] cursor-pointer shadow-sm {}",
                                            if selected_option() == Some(option_for_select.clone()) {
                                                if show_explanation() {
                                                    if option_for_select == correct_ans_check {
                                                        "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-900 dark:text-emerald-300 shadow-md ring-1 ring-emerald-500/20"
                                                    } else {
                                                        "bg-rose-50 dark:bg-rose-900/30 border-rose-500 text-rose-900 dark:text-rose-300 shadow-md ring-1 ring-rose-500/20"
                                                    }
                                                } else {
                                                    "bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-300 shadow-md ring-1 ring-amber-500/20"
                                                }
                                            } else if show_explanation() && option_for_select == correct_ans_check {
                                                "bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-500/50 text-emerald-800 dark:text-emerald-400"
                                            } else {
                                                "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                                            }
                                        ),
                                        onclick: move |_| {
                                            if !show_explanation() {
                                                selected_option.set(Some(option_for_click.clone()));
                                            }
                                        },
                                        div { class: "flex-1 flex items-center gap-4 pr-2",
                                            div {
                                                class: format!(
                                                    "w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 shadow-sm {}",
                                                    if selected_option() == Some(option_for_select.clone()) {
                                                        if show_explanation() {
                                                            if option_for_select == correct_ans_check {
                                                                "bg-emerald-500 text-white"
                                                            } else {
                                                                "bg-rose-500 text-white"
                                                            }
                                                        } else {
                                                            "bg-amber-500 text-white"
                                                        }
                                                    } else if show_explanation() && option_for_select == correct_ans_check {
                                                        "bg-emerald-400 text-white"
                                                    } else {
                                                        "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                                    }
                                                ),
                                                "{prefix}"
                                            }
                                            span { class: "text-left", "{option}" }
                                        }
                                        button {
                                            class: "w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:text-amber-600 dark:text-amber-400 transition-colors shadow-sm active:scale-90 cursor-pointer shrink-0",
                                            disabled: show_explanation(),
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
                    if show_explanation() {
                        div { class: "bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mb-8 text-sm shadow-inner",
                            if selected_option() == Some(correct_ans_check.clone()) {
                                p { class: "text-emerald-600 font-extrabold mb-3 text-base flex items-center gap-2", "✓ Tepat Sekali" }
                            } else {
                                p { class: "text-rose-600 dark:text-rose-400 font-extrabold mb-3 text-base flex items-center gap-2", "✗ Jawaban Salah" }
                            }
                            p { class: "text-slate-700 dark:text-slate-300 text-sm leading-loose font-medium", "{explanation_text}" }
                        }
                    }
                }

                // Sticky Bottom Action Container
                div { class: "fixed bottom-0 inset-x-0 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 sm:relative sm:border-0 sm:p-0 sm:bg-transparent sm:pt-6 z-40 safe-bottom flex justify-end",
                    if !show_explanation() {
                        button {
                            class: "w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold px-10 py-4 rounded-2xl text-base disabled:opacity-50 transition-colors shadow-md hover:shadow-lg cursor-pointer tracking-wide",
                            disabled: selected_option().is_none(),
                            onclick: move |_| {
                                stop_speech();
                                if selected_option() == Some(correct_ans_check.clone()) {
                                    play_sfx(SFX_CORRECT);
                                    correct_answers_count.set(correct_answers_count() + 1);
                                } else {
                                    play_sfx(SFX_WRONG);
                                }
                                show_explanation.set(true);
                            },
                            "Kunci Jawaban"
                        }
                    } else if current_question_idx() + 1 < total_questions {
                        button {
                            class: "w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold px-10 py-4 rounded-2xl text-base transition-colors shadow-md hover:shadow-lg cursor-pointer tracking-wide",
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
                            class: "w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-bold px-10 py-4 rounded-2xl text-base transition-colors shadow-lg hover:shadow-xl cursor-pointer tracking-wide",
                            onclick: move |_| {
                                stop_speech();
                                if correct_answers_count() >= (total_questions as f32 * 0.75).ceil() as usize {
                                    play_sfx(SFX_WINNER);
                                }
                                exam_finished.set(true);
                            },
                            "Selesai & Lihat Hasil Ujian"
                        }
                    }
                }
            }
        }
    }
}
