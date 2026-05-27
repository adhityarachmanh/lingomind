use dioxus::prelude::*;

use crate::routes::Route;
use crate::services::gemini::generate_lesson_server;
use crate::models::constants::LanguageCourse;
#[cfg(target_arch = "wasm32")]
use crate::services::gemini::generate_tts_audio_server;

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



fn parse_lesson_sections(content: &str) -> Vec<(String, Vec<String>)> {
    let mut sections: Vec<(String, Vec<String>)> = Vec::new();
    let mut current_title = "Ringkasan".to_string();
    let mut current_lines: Vec<String> = Vec::new();

    // Ensure main section headers are always on their own lines
    // because AI sometimes forgets to add newlines before/after them
    let safe_content = content
        .replace("[Konsep Inti]", "\n[Konsep Inti]\n")
        .replace("[Pola]", "\n[Pola]\n")
        .replace("[Kesalahan Umum]", "\n[Kesalahan Umum]\n")
        .replace("[Tips Praktik]", "\n[Tips Praktik]\n")
        .replace(".1.", ".\n1.")
        .replace(".2.", ".\n2.")
        .replace(".3.", ".\n3.")
        .replace(".4.", ".\n4.")
        .replace(".5.", ".\n5.")
        .replace(".6.", ".\n6.")
        .replace("?1.", "?\n1.")
        .replace("?2.", "?\n2.")
        .replace("?3.", "?\n3.")
        .replace("?4.", "?\n4.")
        .replace("?5.", "?\n5.")
        .replace("?6.", "?\n6.")
        .replace(".Contoh:", ".\nContoh:");

    for raw in safe_content.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }

        // Check if the line starts with a section label like [Title]
        if line.starts_with('[') && line.contains(']') {
            let end_idx = line.find(']').unwrap();
            let label = line[1..end_idx].trim();
            
            // Only treat it as a section header if the label is valid
            if is_section_label(label) {
                if !current_lines.is_empty() {
                    sections.push((current_title.clone(), current_lines));
                }
                current_title = label.to_string();
                current_lines = Vec::new();
                
                // Add the rest of the line to the body if there is any text after the ]
                let remainder = line[end_idx + 1..].trim();
                if !remainder.is_empty() {
                    let cleaned = normalize_markdown_line(remainder);
                    if !cleaned.is_empty() {
                        current_lines.push(cleaned);
                    }
                }
                continue;
            }
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
pub fn Lesson(goal: String) -> Element {
    let languages_res = use_context::<Resource<Vec<LanguageCourse>>>();
    let langs = languages_res().unwrap_or_default();
    let selected_language = use_context::<Signal<String>>();
    let session_state = use_context::<Signal<(Option<crate::models::user::UserProfile>, bool)>>();
    let (user_opt, _ready) = session_state();

    let language = selected_language();
    let active_level = user_opt
        .as_ref()
        .map(|u| u.base_level(&language))
        .unwrap_or_else(|| "A1".to_string());

    #[cfg(target_arch = "wasm32")]
    let edge_tts_voice = langs
        .iter()
        .find(|course| course.id.eq_ignore_ascii_case(&language))
        .map(|course| course.edge_tts_voice.clone())
        .unwrap_or_else(|| "en-US-AriaNeural".to_string());

    let play_text_audio = move |text: String| {
        #[cfg(target_arch = "wasm32")]
        {
            let voice = edge_tts_voice.to_string();
            let request_id = LESSON_AUDIO_SEQ.fetch_add(1, Ordering::SeqCst) + 1;
            
            spawn(async move {
                if let Ok(src) = generate_tts_audio_server(text, voice, 1.0).await {
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

    let mut is_retrying = use_signal(|| false);

    let mut lesson_resource = use_resource(move || {
        let lang = selected_lang_for_resource();
        let (resource_user_opt, _) = session_for_resource();
        let lvl = resource_user_opt
            .as_ref()
            .map(|u| u.base_level(&lang))
            .unwrap_or_else(|| "A1".to_string());
        let email = resource_user_opt.as_ref().map(|u| u.email.clone()).unwrap_or_default();
        let part_value = lesson_part_signal();
        let goal_value = goal_clone.clone();
        async move { 
            let res = generate_lesson_server(email, lang, lvl, goal_value, part_value).await;
            is_retrying.set(false);
            res
        }
    });

    let lesson_value = lesson_resource.value()();
    let is_loading_next_lesson = lesson_resource.pending() && lesson_value.is_some();

    let Some(lesson_result) = lesson_value else {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900/30 dark:text-slate-50 flex flex-col justify-center items-center gap-4 font-sans",
                div { class: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500" }
                p { class: "text-slate-500 dark:text-slate-400 animate-pulse text-sm font-medium", "Menyusun materi belajar khusus untuk Anda..." }
            }
        };
    };

    if is_retrying() {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col items-center justify-center font-sans p-6",
                div { class: "animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-500 mb-6" }
                p { class: "text-amber-700 dark:text-amber-500 font-bold text-lg animate-pulse", "Mencoba ulang menghubungi AI..." }
            }
        };
    }

    let (lesson_data, is_offline) = match lesson_result {
        Ok(data) => (data, false),
        Err(e) => {
            if let Some(cached) = crate::services::offline::get_offline_lesson(&selected_language(), &goal) {
                (cached, true)
            } else {
                return rsx! {
                    div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center",
                        div { class: "bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-lg border border-red-200 dark:border-red-900/30 max-w-md text-center",
                            h3 { class: "text-2xl font-bold text-red-600 dark:text-red-500 mb-4", "Gagal Memuat Materi" }
                            p { class: "text-slate-600 dark:text-slate-400 mb-6 text-sm", "Gagal memuat materi: {e} (Tidak ada cache offline)" }
                            button { 
                                class: "block w-full bg-amber-500 text-white font-bold py-3 rounded-xl hover:bg-amber-600 transition mb-3 cursor-pointer", 
                                onclick: move |_| {
                                    is_retrying.set(true);
                                    lesson_resource.restart();
                                }, 
                                "Coba Lagi" 
                            }
                            Link { to: Route::Roadmap {}, class: "block w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition", "Kembali ke Roadmap" }
                        }
                    }
                }
            }
        }
    };

    let sections = parse_lesson_sections(&lesson_data.content);

    rsx! {
        div { class: "min-h-screen bg-white dark:bg-slate-900 sm:bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 px-0 sm:px-6 py-0 sm:py-8 font-sans pb-24 sm:pb-8",
            div { class: "max-w-5xl w-full mx-auto bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-700 rounded-none sm:rounded-3xl p-6 sm:p-10 shadow-none sm:shadow-lg flex flex-col min-h-screen sm:min-h-0",
                
                // Header (Duolingo style close button on mobile, clean details)
                div { class: "flex items-center gap-4 mb-6 sm:mb-8 border-b border-slate-100 dark:border-slate-800 pb-4",
                    Link {
                        to: Route::Dashboard {},
                        class: "text-slate-400 hover:text-slate-600 dark:text-slate-400 text-xl font-bold transition-colors cursor-pointer p-1",
                        "✕"
                    }
                    div { class: "flex-1",
                        h1 { class: "text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-200 leading-tight", "{lesson_data.title}" }
                    }
                }

                // Badges
                div { class: "flex flex-wrap items-center gap-2 mb-6",
                    span { class: "text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50/30 dark:bg-teal-900/30 px-2.5 py-1 rounded-full uppercase tracking-wider border border-teal-100/50 dark:border-teal-900/50", "Materi {language} ({active_level})" }
                    span { class: "text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full uppercase tracking-wider border border-indigo-100 dark:border-indigo-900/50", "Goal: {goal}" }
                    span { class: "text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50/30 dark:bg-orange-900/30 px-2.5 py-1 rounded-full uppercase tracking-wider border border-orange-100 dark:border-orange-900/50", "Bagian {lesson_part}" }
                    if is_offline {
                        span { class: "text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-900/30 px-2.5 py-1 rounded-full uppercase tracking-wider border border-rose-100 dark:border-rose-900/50", "📵 Offline Mode" }
                    }
                    if is_loading_next_lesson {
                        span { class: "text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full animate-pulse border border-indigo-100 dark:border-indigo-900/50", "Memuat..." }
                    }
                }

                div { class: "grid grid-cols-1 lg:grid-cols-12 gap-6",
                    div { class: "lg:col-span-8 space-y-6",
                        if sections.is_empty() {
                            div { class: "bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-sm",
                                h2 { class: "text-xl font-bold text-teal-600 dark:text-teal-400 mb-4", "Penjelasan Materi" }
                                p { class: "text-slate-600/30 dark:text-slate-400 leading-relaxed whitespace-pre-wrap", "{lesson_data.content}" }
                            }
                        } else {
                            for (section_title, section_lines) in sections {
                                div { class: "bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow",
                                    h2 { class: "text-xl font-bold text-teal-600 dark:text-teal-400 mb-4", "{section_title}" }
                                    div { class: "space-y-3",
                                        for line in section_lines {
                                            if line.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) && line.contains('.') {
                                                p { class: "text-sm font-bold text-slate-800 dark:text-slate-200 pt-2", "{line}" }
                                            } else {
                                                div { class: "flex items-start gap-3",
                                                    span { class: "mt-2 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" }
                                                    p { class: "text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium", "{line}" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        div { class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-sm",
                            h2 { class: "text-xl font-bold text-amber-600 dark:text-amber-400 mb-4", "Contoh Penggunaan" }
                            div { class: "space-y-4",
                                for (idx, sentence) in lesson_data.example_sentences.iter().enumerate() {
                                    {
                                        let (target, meaning) = split_example(sentence);
                                        rsx! {
                                            div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-4 relative hover:border-amber-300 transition-colors group",
                                                p { class: "text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-2", "Contoh {idx + 1}" }
                                                p { class: "text-base font-bold text-slate-800 dark:text-slate-200 pr-10", "{target}" }
                                                if let Some(m) = meaning {
                                                    p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium", "{m}" }
                                                }
                                                button {
                                                    class: "absolute top-4 right-4 text-slate-400 hover:text-amber-500 hover:bg-amber-50/30 dark:bg-amber-900/30 transition-colors p-2 rounded-full",
                                                    title: "Dengarkan",
                                                    onclick: {
                                                        let play_audio = play_text_audio.clone();
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
                        div { class: "bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-700 rounded-2xl p-6 shadow-sm",
                            h2 { class: "text-xl font-bold text-rose-600 dark:text-rose-400 mb-4", "Kosa Kata Inti" }
                            div { class: "space-y-3",
                                for vocab in lesson_data.vocabulary.iter() {
                                    div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-4 relative hover:border-rose-300 transition-colors group",
                                        p { class: "text-base font-bold text-slate-800 dark:text-slate-200 pr-10", "{vocab.word}" }
                                        p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium", "{vocab.meaning}" }
                                        button {
                                            class: "absolute top-4 right-4 text-slate-400 hover:text-rose-500 hover:bg-rose-50/30 dark:bg-rose-900/30 transition-colors p-2 rounded-full",
                                            title: "Dengarkan",
                                            onclick: {
                                                let play_audio = play_text_audio.clone();
                                                let text_to_play = vocab.word.clone();
                                                move |_| play_audio(text_to_play.clone())
                                            },
                                            "🔊"
                                        }
                                    }
                                }
                            }
                        }

                        div { class: "hidden sm:block bg-white dark:bg-slate-900 border border-slate-200/20 dark:border-slate-700 rounded-2xl p-6 shadow-sm",
                            p { class: "text-sm font-medium text-slate-600 dark:text-slate-400 mb-5", "Jika sudah paham materinya, lanjutkan ke quiz untuk evaluasi." }
                            div { class: "space-y-3",
                                button {
                                    class: if is_loading_next_lesson {
                                        "block w-full text-center bg-indigo-100 text-indigo-800 font-bold px-4 py-3 rounded-xl cursor-not-allowed shadow-sm"
                                    } else {
                                        "block w-full text-center bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-4 py-3 rounded-xl transition-colors shadow-md hover:shadow-lg hover:shadow-indigo-500/20 cursor-pointer"
                                    },
                                    disabled: is_loading_next_lesson,
                                    onclick: {
                                        let e = user_opt.as_ref().map(|u| u.email.clone()).unwrap_or_default();
                                        move |_| {
                                            lesson_part.set(lesson_part() + 1);
                                            let email_for_spawn = e.clone();
                                            spawn(async move {
                                                let _ = crate::services::mission::increment_mission_progress_server(email_for_spawn, "lesson".to_string()).await;
                                            });
                                        }
                                    },
                                    if is_loading_next_lesson { "Memuat..." } else { "Lesson Selanjutnya" }
                                }
                                Link {
                                    to: Route::Quiz { goal: goal.clone(), battle_id: None },
                                    class: "block w-full text-center bg-teal-500 hover:bg-teal-600 text-white font-bold px-4 py-3 rounded-xl transition-colors shadow-md hover:shadow-lg hover:shadow-teal-500/20",
                                    "Mulai Quiz"
                                }
                                Link {
                                    to: Route::Dashboard {},
                                    class: "block w-full text-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-3 rounded-xl transition-colors",
                                    "Kembali ke Dashboard"
                                }
                            }
                        }
                    }
                }

                // Sticky Bottom Action Container for Mobile
                div { class: "fixed bottom-0 inset-x-0 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 z-40 safe-bottom flex gap-3 sm:hidden",
                    button {
                        class: if is_loading_next_lesson {
                            "flex-1 bg-indigo-100 text-indigo-800 font-bold px-4 py-3.5 rounded-2xl text-sm cursor-not-allowed text-center shadow-sm"
                        } else {
                            "flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-4 py-3.5 rounded-2xl text-sm transition-colors shadow-md hover:shadow-lg text-center cursor-pointer"
                        },
                        disabled: is_loading_next_lesson,
                        onclick: {
                            let e = user_opt.as_ref().map(|u| u.email.clone()).unwrap_or_default();
                            move |_| {
                                lesson_part.set(lesson_part() + 1);
                                let email_for_spawn = e.clone();
                                spawn(async move {
                                    let _ = crate::services::mission::increment_mission_progress_server(email_for_spawn, "lesson".to_string()).await;
                                });
                            }
                        },
                        if is_loading_next_lesson { "Memuat..." } else { "Lanjut Belajar" }
                    }
                    Link {
                        to: Route::Quiz { goal: goal.clone(), battle_id: None },
                        class: "flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold px-4 py-3.5 rounded-2xl text-sm transition-colors shadow-md hover:shadow-lg text-center cursor-pointer",
                        "Mulai Quiz"
                    }
                }
            }
        }
    }
}
