use dioxus::prelude::*;

use crate::routes::Route;
use crate::services::gemini::generate_lesson_server;

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

fn parse_lesson_sections(content: &str) -> Vec<(String, Vec<String>)> {
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

        let cleaned = normalize_markdown_line(line);
        if !cleaned.is_empty() {
            current_lines.push(cleaned);
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
pub fn Lesson(level: String, goal: String) -> Element {
    let selected_language = use_context::<Signal<String>>();
    let session_state = use_context::<Signal<(Option<crate::models::user::UserProfile>, bool)>>();
    let (user_opt, _ready) = session_state();

    let language = selected_language();
    let active_level = user_opt
        .as_ref()
        .and_then(|u| u.current_level.get(&language).cloned())
        .unwrap_or_else(|| level.clone());

    let goal_clone = goal.clone();
    let selected_lang_for_resource = selected_language;
    let session_for_resource = session_state;
    let fallback_level = level.clone();

    let lesson_resource = use_resource(move || {
        let lang = selected_lang_for_resource();
        let (resource_user_opt, _) = session_for_resource();
        let lvl = resource_user_opt
            .as_ref()
            .and_then(|u| u.current_level.get(&lang).cloned())
            .unwrap_or_else(|| fallback_level.clone());
        let goal_value = goal_clone.clone();
        async move { generate_lesson_server(lang, lvl, goal_value).await }
    });

    let Some(lesson_result) = lesson_resource.value()() else {
        return rsx! {
            div { class: "min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center gap-4",
                div { class: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-400" }
                p { class: "text-slate-400 animate-pulse text-sm", "Menyusun materi belajar khusus untuk Anda..." }
            }
        };
    };

    let lesson_data = match lesson_result {
        Ok(data) => data,
        Err(e) => {
            return rsx! {
                div { class: "p-8 text-rose-400 text-center mt-20", "Gagal memuat materi: {e}" }
            }
        }
    };

    let sections = parse_lesson_sections(&lesson_data.content);

    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white p-4 sm:p-6 pb-24",
            div { class: "max-w-6xl mx-auto mt-4",
                div { class: "bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 mb-5",
                    div { class: "flex flex-wrap items-center gap-2 mb-3",
                        span { class: "text-[11px] font-extrabold bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full uppercase tracking-wider", "Materi {language} • {active_level}" }
                        span { class: "text-[11px] font-semibold bg-teal-500/15 text-teal-300 px-3 py-1 rounded-full", "Goal: {goal}" }
                    }
                    h1 { class: "text-2xl sm:text-3xl font-black text-slate-100 mb-2", "{lesson_data.title}" }
                    p { class: "text-xs text-slate-400", "Bahasa aktif global: " span { class: "text-orange-300 font-semibold", "{selected_language()}" } }
                }

                div { class: "grid grid-cols-1 lg:grid-cols-12 gap-5",
                    div { class: "lg:col-span-8 space-y-4",
                        if sections.is_empty() {
                            div { class: "bg-slate-900 border border-slate-800 rounded-2xl p-5",
                                h2 { class: "text-lg font-bold text-teal-300 mb-3", "Penjelasan Materi" }
                                p { class: "text-slate-300 leading-relaxed whitespace-pre-wrap", "{lesson_data.content}" }
                            }
                        } else {
                            for (section_title, section_lines) in sections {
                                div { class: "bg-slate-900 border border-slate-800 rounded-2xl p-5",
                                    h2 { class: "text-lg font-bold text-teal-300 mb-3", "{section_title}" }
                                    div { class: "space-y-2",
                                        for line in section_lines {
                                            if line.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) && line.contains('.') {
                                                p { class: "text-sm font-semibold text-orange-200 pt-1", "{line}" }
                                            } else {
                                                div { class: "flex items-start gap-2",
                                                    span { class: "mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" }
                                                    p { class: "text-sm text-slate-300 leading-relaxed", "{line}" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        div { class: "bg-slate-900 border border-slate-800 rounded-2xl p-5",
                            h2 { class: "text-lg font-bold text-amber-300 mb-3", "Contoh Penggunaan" }
                            div { class: "space-y-3",
                                for (idx, sentence) in lesson_data.example_sentences.iter().enumerate() {
                                    {
                                        let (target, meaning) = split_example(sentence);
                                        rsx! {
                                            div { class: "bg-slate-950 border border-slate-800 rounded-xl p-3",
                                                p { class: "text-xs text-slate-500 mb-1", "Contoh {idx + 1}" }
                                                p { class: "text-sm text-slate-100", "{target}" }
                                                if let Some(m) = meaning {
                                                    p { class: "text-xs text-slate-400 mt-1", "{m}" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    div { class: "lg:col-span-4 space-y-4",
                        div { class: "bg-slate-900 border border-slate-800 rounded-2xl p-5",
                            h2 { class: "text-lg font-bold text-rose-300 mb-3", "Kosa Kata Inti" }
                            div { class: "space-y-2",
                                for vocab in lesson_data.vocabulary.iter() {
                                    div { class: "bg-slate-950 border border-slate-800 rounded-xl p-3",
                                        p { class: "text-sm font-bold text-slate-100", "{vocab.word}" }
                                        p { class: "text-xs text-slate-400 mt-1", "{vocab.meaning}" }
                                    }
                                }
                            }
                        }

                        div { class: "bg-slate-900 border border-slate-800 rounded-2xl p-5",
                            p { class: "text-sm text-slate-300 mb-3", "Jika sudah paham materinya, lanjutkan ke quiz untuk evaluasi." }
                            div { class: "space-y-2",
                                Link {
                                    to: Route::Quiz { level: active_level.clone(), goal: goal.clone() },
                                    class: "block w-full text-center bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold px-4 py-2.5 rounded-lg transition-colors",
                                    "Mulai Quiz"
                                }
                                Link {
                                    to: Route::Dashboard {},
                                    class: "block w-full text-center bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-lg transition-colors",
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
