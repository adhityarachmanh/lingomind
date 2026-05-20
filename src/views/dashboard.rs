// src/views/dashboard.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::models::constants::LANGUAGE_COURSES;
use crate::routes::Route;
use crate::services::flashcard::get_due_flashcard_count_server;
use crate::services::mission::get_daily_mission_server;
use crate::services::weakness::{get_top_weaknesses_server, get_weakness_analytics_server};
use std::sync::atomic::{AtomicU64, Ordering};

static SEARCH_SEQ: AtomicU64 = AtomicU64::new(0);

#[cfg(target_arch = "wasm32")]
async fn sleep_ms(ms: u64) {
    gloo_timers::future::sleep(std::time::Duration::from_millis(ms)).await;
}

#[cfg(not(target_arch = "wasm32"))]
async fn sleep_ms(ms: u64) {
    tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
}

fn split_highlight<'a>(text: &'a str, query: &str) -> Vec<(&'a str, bool)> {
    if query.is_empty() {
        return vec![(text, false)];
    }
    let lower = text.to_lowercase();
    let q = query.to_lowercase();
    let mut out = Vec::new();
    let mut idx = 0usize;
    while let Some(pos) = lower[idx..].find(&q) {
        let abs = idx + pos;
        if abs > idx {
            out.push((&text[idx..abs], false));
        }
        let end = abs + q.len();
        out.push((&text[abs..end], true));
        idx = end;
        if idx >= text.len() {
            break;
        }
    }
    if idx < text.len() {
        out.push((&text[idx..], false));
    }
    out
}

#[component]
fn CourseCard(username: String, course_id: String, course_name: String, course_flag: String, course_native_name: String, course_desc: String, course_theme_class: String, course_button_class: String, lang_level: String, search_query: String) -> Element {
    let c1 = course_id.clone();
    let u1 = username.clone();
    let due_resource = use_resource(move || {
        let lang = c1.clone();
        let user = u1.clone();
        async move { get_due_flashcard_count_server(user, lang).await }
    });

    let c2 = course_id.clone();
    let u2 = username.clone();
    let weakness_resource = use_resource(move || {
        let lang = c2.clone();
        let user = u2.clone();
        async move { get_top_weaknesses_server(user, lang, 2).await }
    });

    let due_count = due_resource.value()().and_then(|r| r.ok()).unwrap_or(0);
    let weaknesses = weakness_resource.value()().and_then(|r| r.ok()).unwrap_or_default();
    let weakness_text = weaknesses.iter().map(|w| w.topic.clone()).collect::<Vec<_>>().join(", ");
    let c3 = course_id.clone();
    let u3 = username.clone();
    let trend_resource = use_resource(move || {
        let lang = c3.clone();
        let user = u3.clone();
        async move { get_weakness_analytics_server(user, lang, 1).await }
    });
    let trend_item = trend_resource.value()().and_then(|r| r.ok()).and_then(|v| v.into_iter().next());
    let trend_text = if let Some(t) = trend_item.clone() {
        let ratio = if t.count_30d == 0 { 0.0 } else { t.count_7d as f64 / t.count_30d as f64 };
        if ratio >= 0.6 {
            "naik"
        } else if ratio >= 0.35 {
            "stabil"
        } else {
            "membaik"
        }
    } else { "trend belum ada" };
    let trend_badge_class = match trend_text {
        "naik" => "text-rose-300 bg-rose-500/20 border-rose-500/30",
        "stabil" => "text-amber-300 bg-amber-500/20 border-amber-500/30",
        "membaik" => "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
        _ => "text-slate-300 bg-slate-700/20 border-slate-600/30",
    };
    let trend_symbol = match trend_text {
        "naik" => "↑",
        "stabil" => "→",
        "membaik" => "↓",
        _ => "•",
    };
    let (count_7d, count_30d) = if let Some(t) = trend_item {
        (t.count_7d.max(0), t.count_30d.max(0))
    } else {
        (0, 0)
    };
    let max_count = count_7d.max(count_30d).max(1) as f64;
    let width_7d = ((count_7d as f64 / max_count) * 100.0).round() as i32;
    let width_30d = ((count_30d as f64 / max_count) * 100.0).round() as i32;
    let c4 = course_id.clone();
    let u4 = username.clone();
    let mission_resource = use_resource(move || {
        let lang = c4.clone();
        let user = u4.clone();
        async move { get_daily_mission_server(user, lang).await }
    });
    let mission = mission_resource.value()().and_then(|r| r.ok());

    let goal = "General".to_string();
    rsx! {
        div {
            class: format!("bg-slate-900 p-4 sm:p-6 rounded-xl border flex flex-col justify-between transition-all shadow-lg hover:-translate-y-0.5 {}", course_theme_class),
            div {
                div { class: "flex items-center gap-2 mb-3",
                    span { class: "text-3xl", "{course_flag}" }
                    h3 { class: "text-xl font-bold text-white",
                        for (seg, is_hit) in split_highlight(&course_name, &search_query) {
                            if is_hit {
                                mark { class: "bg-amber-500/30 text-amber-200 px-0.5 rounded", "{seg}" }
                            } else {
                                span { "{seg}" }
                            }
                        }
                    }
                }
                p { class: "text-xs text-slate-500 font-medium tracking-wide mb-3 uppercase",
                    for (seg, is_hit) in split_highlight(&course_native_name, &search_query) {
                        if is_hit {
                            mark { class: "bg-amber-500/30 text-amber-200 px-0.5 rounded", "{seg}" }
                        } else {
                            span { "{seg}" }
                        }
                    }
                    " - Level {lang_level}"
                }
                p { class: "text-sm text-slate-400 mb-3 leading-relaxed min-h-[44px] sm:min-h-[60px]",
                    for (seg, is_hit) in split_highlight(&course_desc, &search_query) {
                        if is_hit {
                            mark { class: "bg-amber-500/30 text-amber-200 px-0.5 rounded", "{seg}" }
                        } else {
                            span { "{seg}" }
                        }
                    }
                }
                div { class: "bg-slate-950 border border-slate-800 rounded p-2 mb-3",
                    p { class: "text-[11px] text-slate-400", "Due flashcard: " span { class: "text-teal-400 font-semibold", "{due_count}" } }
                    p { class: "text-[11px] text-slate-500 mt-1 flex items-center gap-2",
                        "Trend: "
                        span { class: format!("px-1.5 py-0.5 rounded border text-[10px] {}", trend_badge_class), "{trend_symbol} {trend_text}" }
                        span {
                            class: "text-[10px] text-slate-500 cursor-help",
                            title: "Naik: frekuensi kesalahan cenderung meningkat. Stabil: relatif konstan. Membaik: frekuensi kesalahan menurun.",
                            "(?)"
                        }
                    }
                    div { class: "mt-2 space-y-1.5",
                        div { class: "flex items-center gap-2",
                            span { class: "text-[10px] text-slate-500 w-8", "7d" }
                            div { class: "flex-1 bg-slate-900 border border-slate-800 rounded h-2 overflow-hidden",
                                div { class: "bg-amber-400 h-2", width: "{width_7d}%" }
                            }
                            span { class: "text-[10px] text-amber-300 w-6 text-right", "{count_7d}" }
                        }
                        div { class: "flex items-center gap-2",
                            span { class: "text-[10px] text-slate-500 w-8", "30d" }
                            div { class: "flex-1 bg-slate-900 border border-slate-800 rounded h-2 overflow-hidden",
                                div { class: "bg-teal-400 h-2", width: "{width_30d}%" }
                            }
                            span { class: "text-[10px] text-teal-300 w-6 text-right", "{count_30d}" }
                        }
                    }
                    p { class: "text-[11px] text-slate-400 mt-1", "Weakness: "
                        if weaknesses.is_empty() {
                            span { class: "text-slate-500", "belum ada" }
                        } else {
                            span { class: "text-amber-300", "{weakness_text}" }
                        }
                    }
                }
                if let Some(m) = mission {
                    div { class: "bg-slate-950 border border-slate-800 rounded p-2 mb-3",
                        p { class: "text-[11px] text-slate-300 font-semibold mb-1", "Daily Mission (10-15 menit)" }
                        ul { class: "space-y-1 text-[11px] text-slate-400",
                            li { "Lesson: {m.lesson_target}x" }
                            li { "Quiz: {m.quiz_target}x" }
                            li { "Practice Weakness: {m.weakness_target} soal" }
                            li { "Flashcard Review: {m.flashcard_target} kartu" }
                        }
                    }
                }
            }
            div { class: "flex flex-col gap-2 mt-2",
                div { class: "flex flex-col sm:flex-row gap-2",
                    Link { to: Route::Lesson { language: course_id.clone(), level: lang_level.clone(), goal: goal.clone() }, class: "flex-1 text-center bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded transition-all text-xs", "Materi" }
                    Link { to: Route::ChatRoleplay { language: course_id.clone(), level: lang_level.clone(), goal: goal.clone() }, class: "flex-1 text-center bg-slate-800 hover:bg-slate-700 text-teal-400 font-bold py-2 rounded transition-all text-xs border border-teal-500/20", "Chat AI" }
                }
                Link { to: Route::Quiz { language: course_id.clone(), level: lang_level.clone(), goal: goal.clone() }, class: format!("text-center font-bold py-2.5 rounded transition-all text-xs shadow-md {}", course_button_class), "Mulai Quiz" }
                Link { to: Route::WeaknessPractice { language: course_id.clone(), level: lang_level.clone(), goal: goal.clone() }, class: "text-center font-bold py-2 rounded transition-all text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30", "Practice Weakness" }
                Link { to: Route::WeaknessAnalytics { language: course_id.clone() }, class: "text-center font-bold py-2 rounded transition-all text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30", "Lihat Analitik" }
                Link { to: Route::FlashcardReview { language: course_id.clone() }, class: "text-center font-bold py-2 rounded transition-all text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700", "Review Flashcard" }
            }
        }
    }
}

#[component]
pub fn Dashboard() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let (user_opt, is_session_ready) = session_state();
    let mut search_input = use_signal(String::new);
    let mut search_query = use_signal(String::new);

    if !is_session_ready { return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center gap-2", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400" } } }; }
    if user_opt.is_none() { return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex justify-center items-center p-8", div { class: "bg-slate-900 p-6 rounded-xl border border-slate-800 text-center max-w-sm", p { class: "text-slate-400 mb-4", "Silakan login terlebih dahulu untuk mengakses Dashboard." } Link { to: Route::Login {}, class: "inline-block bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold py-2 px-4 rounded transition-colors text-sm", "Kembali ke Login" } } } }; }

    let user = user_opt.unwrap();
    use_effect(move || {
        let seq = SEARCH_SEQ.fetch_add(1, Ordering::SeqCst) + 1;
        let input = search_input();
        spawn(async move {
            sleep_ms(200).await;
            if SEARCH_SEQ.load(Ordering::SeqCst) == seq {
                search_query.set(input);
            }
        });
    });

    let query = search_query().to_lowercase();
    let filtered_courses: Vec<_> = LANGUAGE_COURSES
        .iter()
        .filter(|course| {
            if query.is_empty() {
                true
            } else {
                course.id.to_lowercase().contains(&query)
                    || course.name.to_lowercase().contains(&query)
                    || course.native_name.to_lowercase().contains(&query)
                    || course.description.to_lowercase().contains(&query)
            }
        })
        .map(|course| {
            let lang_level = user.current_level.get(course.id).cloned().unwrap_or_else(|| "A1".to_string());
            (course, lang_level)
        })
        .collect();

    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white p-4 sm:p-8 animate-fadeIn",
            div { class: "max-w-5xl mx-auto",
                div { class: "mb-8", h1 { class: "text-3xl font-extrabold mb-1 text-slate-100 tracking-tight", "Halo, {user.username}!" } p { class: "text-slate-400 text-sm", "Pilih modul bahasa bertenaga AI untuk menguji kemampuan Anda hari ini." } }
                div { class: "mb-6",
                    input {
                        r#type: "text",
                        class: "w-full md:max-w-md bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-teal-500/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all placeholder-slate-600",
                        placeholder: "Cari bahasa... contoh: English, Japanese, Arabic",
                        value: "{search_input}",
                        oninput: move |e| search_input.set(e.value()),
                    }
                }
                div { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6",
                    for (course, lang_level) in filtered_courses {
                        CourseCard {
                            username: user.username.clone(),
                            course_id: course.id.to_string(),
                            course_name: course.name.to_string(),
                            course_flag: course.flag.to_string(),
                            course_native_name: course.native_name.to_string(),
                            course_desc: course.description.to_string(),
                            course_theme_class: course.theme_class.to_string(),
                            course_button_class: course.button_class.to_string(),
                            lang_level: lang_level,
                            search_query: search_query(),
                        }
                    }
                }
            }
        }
    }
}
