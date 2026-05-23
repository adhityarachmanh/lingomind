use dioxus::prelude::*;

use crate::routes::Route;
use crate::services::gemini::generate_lesson_server;
use crate::services::gemini::{generate_tts_audio_server, split_tts_segments};
use crate::models::constants::LANGUAGE_COURSES;

#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
#[cfg(target_arch = "wasm32")]
use std::sync::atomic::{AtomicU64, Ordering};

#[cfg(target_arch = "wasm32")]
thread_local! {
    static LESSON_ACTIVE_AUDIO: RefCell<Option<web_sys::HtmlAudioElement>> = const { RefCell::new(None) };
}

#[cfg(target_arch = "wasm32")]
static LESSON_AUDIO_SEQ: AtomicU64 = AtomicU64::new(0);

fn normalize_markdown_line(line: &str) -> String {
    let mut s = line.trim().replace("**", "").replace('`', "");
    while s.starts_with("* ") || s.starts_with("- ") {
        s = s[2..].trim().to_string();
    }
    if s.starts_with('*') {
        s = s[1..].trim().to_string();
    }
    s
}

fn is_section_label(label: &str) -> bool {
    let trimmed = label.trim();
    !trimmed.is_empty()
        && trimmed.len() <= 40
        && trimmed
            .chars()
            .all(|c| c.is_alphanumeric() || c.is_whitespace() || c == '/' || c == '-' || c == '_')
}

fn split_compact_line(line: &str) -> Vec<String> {
    let normalized = line
        .replace(". ", ".\n")
        .replace("! ", "!\n")
        .replace("? ", "?\n")
        .replace(": ", ":\n");

    normalized
        .lines()
        .map(normalize_markdown_line)
        .filter(|x| !x.is_empty())
        .collect()
}

fn expand_section_lines(content: &str) -> Vec<String> {
    let mut lines = Vec::new();
    for raw in content.lines() {
        let base = normalize_markdown_line(raw);
        if base.is_empty() {
            continue;
        }
        if base.len() > 110 {
            lines.extend(split_compact_line(&base));
        } else {
            lines.push(base);
        }
    }
    lines
}

fn extract_inline_sections(content: &str) -> Vec<(String, String)> {
    let mut sections = Vec::new();
    let mut cursor = 0usize;
    let mut current_title: Option<String> = None;
    let mut current_body = String::new();

    while cursor < content.len() {
        let Some(start_rel) = content[cursor..].find('[') else {
            break;
        };
        let start = cursor + start_rel;
        let Some(end_rel) = content[start + 1..].find(']') else {
            break;
        };
        let end = start + 1 + end_rel;
        let label = content[start + 1..end].trim();

        if !is_section_label(label) {
            cursor = end + 1;
            continue;
        }

        if let Some(title) = current_title.take() {
            sections.push((title, current_body.trim().to_string()));
            current_body.clear();
        }
        current_title = Some(label.to_string());

        let content_start = end + 1;
        let next_start = content[content_start..]
            .find('[')
            .map(|v| content_start + v)
            .unwrap_or(content.len());
        let chunk = content[content_start..next_start].trim();
        if !chunk.is_empty() {
            if !current_body.is_empty() {
                current_body.push('\n');
            }
            current_body.push_str(chunk);
        }
        cursor = next_start;
    }

    if let Some(title) = current_title {
        sections.push((title, current_body.trim().to_string()));
    }

    sections
}

fn parse_lesson_sections(content: &str) -> Vec<(String, Vec<String>)> {
    let inline_sections = extract_inline_sections(content);
    if !inline_sections.is_empty() {
        return inline_sections
            .into_iter()
            .map(|(title, body)| (title, expand_section_lines(&body)))
            .filter(|(_, lines)| !lines.is_empty())
            .collect();
    }

    let mut sections: Vec<(String, Vec<String>)> = Vec::new();
    let mut current_title = "Ringkasan".to_string();
    let mut current_lines: Vec<String> = Vec::new();

    for raw in content.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }

        if line.starts_with('[') && line.ends_with(']') && line.len() > 2 {
            if !current_lines.is_empty() {
                sections.push((current_title, current_lines));
            }
            current_title = line.trim_matches(&['[', ']'][..]).trim().to_string();
            current_lines = Vec::new();
            continue;
        }

        let expanded = if line.len() > 110 {
            split_compact_line(line)
        } else {
            vec![normalize_markdown_line(line)]
        };
        for cleaned in expanded {
            if !cleaned.is_empty() {
                current_lines.push(cleaned);
            }
        }
    }

    if !current_lines.is_empty() {
        sections.push((current_title, current_lines));
    }

    sections
}

fn split_example(sentence: &str) -> (String, Option<String>) {
    if let Some((target, meaning)) = sentence.split_once("||") {
        let target_clean = target.trim().trim_matches('"').to_string();
        let meaning_clean = meaning.trim().trim_matches('"').to_string();
        return (target_clean, Some(meaning_clean));
    }

    let cleaned = sentence.trim().trim_matches('"').to_string();
    (cleaned, None)
}

#[component]
pub fn Lesson(goal: String) -> Element {
    let selected_language = use_context::<Signal<String>>();
    let session_state = use_context::<Signal<(Option<crate::models::user::UserProfile>, bool)>>();
    let (user_opt, _ready) = session_state();

    let language = selected_language();
    let active_level = user_opt
        .as_ref()
        .and_then(|u| u.current_level.get(&language).cloned())
        .unwrap_or_else(|| "A1".to_string());

    let tts_lang_code = LANGUAGE_COURSES
        .iter()
        .find(|course| course.id.eq_ignore_ascii_case(&language))
        .map(|course| course.tts_lang_code)
        .unwrap_or("en-US");

    let play_text_audio = move |text: String| {
        #[cfg(target_arch = "wasm32")]
        {
            let lang = tts_lang_code.to_string();
            let request_id = LESSON_AUDIO_SEQ.fetch_add(1, Ordering::SeqCst) + 1;
            
            spawn(async move {
                if let Ok(src) = generate_tts_audio_server(text, lang, 1.0).await {
                    if LESSON_AUDIO_SEQ.load(Ordering::SeqCst) == request_id {
                        if let Ok(audio) = web_sys::HtmlAudioElement::new_with_src(&src) {
                            LESSON_ACTIVE_AUDIO.with(|slot| {
                                if let Some(prev) = slot.borrow_mut().take() {
                                    let _ = prev.pause();
                                }
                                *slot.borrow_mut() = Some(audio.clone());
                            });
                            let _ = audio.play();
                        }
                    }
                }
            });
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            let _ = text;
        }
    };

    let mut lesson_part = use_signal(|| 1_i32);
    let goal_clone = goal.clone();
    let selected_lang_for_resource = selected_language;
    let session_for_resource = session_state;
    let lesson_part_signal = lesson_part;

    let lesson_resource = use_resource(move || {
        let lang = selected_lang_for_resource();
        let (resource_user_opt, _) = session_for_resource();
        let lvl = resource_user_opt
            .as_ref()
            .and_then(|u| u.current_level.get(&lang).cloned())
            .unwrap_or_else(|| "A1".to_string());
        let part_value = lesson_part_signal();
        let goal_value = goal_clone.clone();
        async move { generate_lesson_server(lang, lvl, goal_value, part_value).await }
    });

    let lesson_value = lesson_resource.value()();
    let is_loading_next_lesson = lesson_resource.pending() && lesson_value.is_some();

    let Some(lesson_result) = lesson_value else {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center gap-4 font-sans",
                div { class: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500" }
                p { class: "text-slate-500 animate-pulse text-sm font-medium", "Menyusun materi belajar khusus untuk Anda..." }
            }
        };
    };

    let lesson_data = match lesson_result {
        Ok(data) => data,
        Err(e) => {
            return rsx! {
                div { class: "p-8 text-rose-600 text-center mt-20 font-bold bg-rose-50 border border-rose-200 rounded-xl m-4", "Gagal memuat materi: {e}" }
            }
        }
    };

    let sections = parse_lesson_sections(&lesson_data.content);

    rsx! {
        div { class: "min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 pb-24 font-sans",
            div { class: "max-w-6xl mx-auto mt-4",
                div { class: "bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 mb-6 shadow-sm",
                    div { class: "flex flex-wrap items-center gap-3 mb-4",
                        span { class: "text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-100 px-3 py-1 rounded-full uppercase tracking-wider", "Materi {language} • {active_level}" }
                        span { class: "text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full", "Goal: {goal}" }
                        span { class: "text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1 rounded-full", "Bagian {lesson_part}" }
                    }
                    h1 { class: "text-2xl sm:text-4xl font-extrabold text-slate-800 mb-3", "{lesson_data.title}" }
                    p { class: "text-sm text-slate-500 font-medium", "Bahasa aktif global: " span { class: "text-teal-600 font-bold", "{selected_language()}" } }
                    if is_loading_next_lesson {
                        div { class: "mt-4 inline-flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2",
                            span { class: "inline-block h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" }
                            span { "Memuat lesson berikutnya..." }
                        }
                    }
                }

                div { class: "grid grid-cols-1 lg:grid-cols-12 gap-6",
                    div { class: "lg:col-span-8 space-y-6",
                        if sections.is_empty() {
                            div { class: "bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm",
                                h2 { class: "text-xl font-bold text-teal-600 mb-4", "Penjelasan Materi" }
                                p { class: "text-slate-600 leading-relaxed whitespace-pre-wrap", "{lesson_data.content}" }
                            }
                        } else {
                            for (section_title, section_lines) in sections {
                                div { class: "bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow",
                                    h2 { class: "text-xl font-bold text-teal-600 mb-4", "{section_title}" }
                                    div { class: "space-y-3",
                                        for line in section_lines {
                                            if line.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) && line.contains('.') {
                                                p { class: "text-sm font-bold text-slate-800 pt-2", "{line}" }
                                            } else {
                                                div { class: "flex items-start gap-3",
                                                    span { class: "mt-2 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" }
                                                    p { class: "text-sm text-slate-600 leading-relaxed font-medium", "{line}" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        div { class: "bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm",
                            h2 { class: "text-xl font-bold text-amber-600 mb-4", "Contoh Penggunaan" }
                            div { class: "space-y-4",
                                for (idx, sentence) in lesson_data.example_sentences.iter().enumerate() {
                                    {
                                        let (target, meaning) = split_example(sentence);
                                        rsx! {
                                            div { class: "bg-slate-50 border border-slate-200 rounded-xl p-4 relative hover:border-amber-300 transition-colors group",
                                                p { class: "text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-2", "Contoh {idx + 1}" }
                                                p { class: "text-base font-bold text-slate-800 pr-10", "{target}" }
                                                if let Some(m) = meaning {
                                                    p { class: "text-sm text-slate-500 mt-1.5 font-medium", "{m}" }
                                                }
                                                button {
                                                    class: "absolute top-4 right-4 text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors p-2 rounded-full",
                                                    title: "Dengarkan",
                                                    onclick: {
                                                        let mut play_audio = play_text_audio.clone();
                                                        let text_to_play = target.clone();
                                                        move |_| play_audio(text_to_play.clone())
                                                    },
                                                    "🔊"
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    div { class: "lg:col-span-4 space-y-6",
                        div { class: "bg-white border border-slate-200 rounded-2xl p-6 shadow-sm",
                            h2 { class: "text-xl font-bold text-rose-600 mb-4", "Kosa Kata Inti" }
                            div { class: "space-y-3",
                                for vocab in lesson_data.vocabulary.iter() {
                                    div { class: "bg-slate-50 border border-slate-200 rounded-xl p-4 relative hover:border-rose-300 transition-colors group",
                                        p { class: "text-base font-bold text-slate-800 pr-10", "{vocab.word}" }
                                        p { class: "text-sm text-slate-500 mt-1 font-medium", "{vocab.meaning}" }
                                        button {
                                            class: "absolute top-4 right-4 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors p-2 rounded-full",
                                            title: "Dengarkan",
                                            onclick: {
                                                let mut play_audio = play_text_audio.clone();
                                                let text_to_play = vocab.word.clone();
                                                move |_| play_audio(text_to_play.clone())
                                            },
                                            "🔊"
                                        }
                                    }
                                }
                            }
                        }

                        div { class: "bg-white border border-slate-200 rounded-2xl p-6 shadow-sm",
                            p { class: "text-sm font-medium text-slate-600 mb-5", "Jika sudah paham materinya, lanjutkan ke quiz untuk evaluasi." }
                            div { class: "space-y-3",
                                button {
                                    class: if is_loading_next_lesson {
                                        "block w-full text-center bg-indigo-100 text-indigo-800 font-bold px-4 py-3 rounded-xl cursor-not-allowed shadow-sm"
                                    } else {
                                        "block w-full text-center bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-4 py-3 rounded-xl transition-colors shadow-md hover:shadow-lg hover:shadow-indigo-500/20"
                                    },
                                    disabled: is_loading_next_lesson,
                                    onclick: move |_| lesson_part.set(lesson_part() + 1),
                                    if is_loading_next_lesson { "Memuat..." } else { "Lesson Selanjutnya" }
                                }
                                Link {
                                    to: Route::Quiz { goal: goal.clone() },
                                    class: "block w-full text-center bg-teal-500 hover:bg-teal-600 text-white font-bold px-4 py-3 rounded-xl transition-colors shadow-md hover:shadow-lg hover:shadow-teal-500/20",
                                    "Mulai Quiz"
                                }
                                Link {
                                    to: Route::Dashboard {},
                                    class: "block w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors",
                                    "Kembali ke Dashboard"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
