use dioxus::prelude::*;
use crate::models::constants::LANGUAGE_COURSES;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::flashcard::get_due_flashcard_count_server;
use crate::services::mission::get_daily_mission_server;
use crate::services::weakness::{get_top_weaknesses_server, get_weakness_analytics_server, get_skill_progress_7d_server};
use crate::services::engagement::get_engagement_stats_server;

#[component]
pub fn Dashboard() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let mut selected_language = use_context::<Signal<String>>();
    let (user_opt, is_session_ready) = session_state();

    if !is_session_ready {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex justify-center items-center", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400" } } };
    }
    if user_opt.is_none() {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex justify-center items-center p-8", div { class: "bg-slate-900 p-6 rounded-xl border border-slate-800 text-center max-w-sm", p { class: "text-slate-400 mb-4", "Silakan login terlebih dahulu." } Link { to: Route::Login {}, class: "inline-block bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold py-2 px-4 rounded text-sm", "Kembali ke Login" } } } };
    }

    let user = user_opt.unwrap();
    let selected = selected_language();
    let course = LANGUAGE_COURSES
        .iter()
        .find(|c| c.id == selected)
        .unwrap_or(&LANGUAGE_COURSES[0]);

    let lang_level = user.current_level.get(course.id).cloned().unwrap_or_else(|| "A1".to_string());
    let username = user.username.clone();
    let lang_id = course.id.to_string();

    let due_resource = use_resource(move || {
        let u = username.clone();
        let l = lang_id.clone();
        async move { get_due_flashcard_count_server(u, l).await }
    });
    let due_count = due_resource.value()().and_then(|r| r.ok()).unwrap_or(0);

    let username2 = user.username.clone();
    let lang_id2 = course.id.to_string();
    let weak_resource = use_resource(move || {
        let u = username2.clone();
        let l = lang_id2.clone();
        async move { get_top_weaknesses_server(u, l, 2).await }
    });
    let weaknesses = weak_resource.value()().and_then(|r| r.ok()).unwrap_or_default();
    let weak_text = if weaknesses.is_empty() { "belum ada".to_string() } else { weaknesses.iter().map(|w| w.topic.clone()).collect::<Vec<_>>().join(", ") };

    let username3 = user.username.clone();
    let lang_id3 = course.id.to_string();
    let mission_resource = use_resource(move || {
        let u = username3.clone();
        let l = lang_id3.clone();
        async move { get_daily_mission_server(u, l).await }
    });
    let mission = mission_resource.value()().and_then(|r| r.ok());

    let username4 = user.username.clone();
    let lang_id4 = course.id.to_string();
    let trend_resource = use_resource(move || {
        let u = username4.clone();
        let l = lang_id4.clone();
        async move { get_weakness_analytics_server(u, l, 1).await }
    });
    let trend = trend_resource.value()().and_then(|r| r.ok()).and_then(|v| v.into_iter().next());
    let trend_label = if let Some(t) = trend {
        let ratio = if t.count_30d == 0 { 0.0 } else { t.count_7d as f64 / t.count_30d as f64 };
        if ratio >= 0.6 { "naik" } else if ratio >= 0.35 { "stabil" } else { "membaik" }
    } else {
        "belum ada"
    };

    let username5 = user.username.clone();
    let lang_id5 = course.id.to_string();
    let skill_progress_resource = use_resource(move || {
        let u = username5.clone();
        let l = lang_id5.clone();
        async move { get_skill_progress_7d_server(u, l).await }
    });
    let skill_points = skill_progress_resource.value()().and_then(|r| r.ok()).unwrap_or_default();

    let goal = "General".to_string();
    let username6 = user.username.clone();
    let engagement_resource = use_resource(move || {
        let u = username6.clone();
        async move { get_engagement_stats_server(u).await }
    });
    let engagement = engagement_resource.value()().and_then(|r| r.ok());
    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white p-4 sm:p-8",
            div { class: "max-w-5xl mx-auto",
                div { class: "mb-6 sm:mb-8",
                    h1 { class: "text-3xl font-extrabold text-slate-100", "Halo, {user.full_name}!" }
                    p { class: "text-slate-400 text-sm mt-1", "Bahasa aktif global dipakai untuk semua fitur di bawah." }
                }

                div { class: "bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 mb-6",
                    div { class: "flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                        div {
                            p { class: "text-xs uppercase tracking-wider text-slate-500", "Bahasa Aktif" }
                            h2 { class: "text-xl font-bold text-white mt-1", "{course.flag} {course.id}" }
                            p { class: "text-xs text-slate-500 mt-1", "{course.native_name} - Level {lang_level}" }
                        }
                        select {
                            class: "px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200",
                            value: "{selected_language}",
                            onchange: move |e| selected_language.set(e.value()),
                            for c in LANGUAGE_COURSES {
                                option { value: "{c.id}", "{c.flag} {c.id}" }
                            }
                        }
                    }
                    div { class: "grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs",
                        div { class: "bg-slate-950 border border-slate-800 rounded p-2.5", "Due Flashcard: " span { class: "text-teal-400 font-bold", "{due_count}" } }
                        div { class: "bg-slate-950 border border-slate-800 rounded p-2.5", "Trend Kelemahan: " span { class: "text-amber-300 font-bold", "{trend_label}" } }
                        div { class: "bg-slate-950 border border-slate-800 rounded p-2.5", "Topik Lemah: " span { class: "text-slate-300 font-semibold", "{weak_text}" } }
                    }
                }
                if let Some(es) = engagement {
                    div { class: "bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6",
                        p { class: "text-sm font-bold text-slate-200 mb-2", "Streak & Achievement" }
                        div { class: "grid grid-cols-2 md:grid-cols-4 gap-2 text-xs",
                            div { class: "bg-slate-950 border border-slate-800 rounded p-2", "Streak: {es.current_streak} hari" }
                            div { class: "bg-slate-950 border border-slate-800 rounded p-2", "Longest: {es.longest_streak} hari" }
                            div { class: "bg-slate-950 border border-slate-800 rounded p-2", "Quiz selesai: {es.total_quiz_completed}" }
                            div { class: "bg-slate-950 border border-slate-800 rounded p-2", "Poin dari quiz: {es.total_points_earned}" }
                        }
                        p { class: "text-[11px] text-slate-400 mt-2", "Reminder: targetkan minimal 1 quiz per hari untuk menjaga streak." }
                    }
                }

                if let Some(m) = mission {
                    div { class: "bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6",
                        p { class: "text-sm font-bold text-slate-200 mb-2", "Daily Mission (10-15 menit)" }
                        div { class: "grid grid-cols-2 md:grid-cols-4 gap-2 text-xs",
                            div { class: "bg-slate-950 border border-slate-800 rounded p-2", "Lesson {m.lesson_target}x" }
                            div { class: "bg-slate-950 border border-slate-800 rounded p-2", "Quiz {m.quiz_target}x" }
                            div { class: "bg-slate-950 border border-slate-800 rounded p-2", "Weakness {m.weakness_target}" }
                            div { class: "bg-slate-950 border border-slate-800 rounded p-2", "Flashcard {m.flashcard_target}" }
                        }
                    }
                }

                div { class: "bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6",
                    p { class: "text-sm font-bold text-slate-200 mb-3", "Progress Skill 7 Hari (Jawaban Benar)" }
                    if skill_points.is_empty() {
                        p { class: "text-xs text-slate-500", "Belum ada data progress skill. Kerjakan quiz dulu." }
                    } else {
                        div { class: "space-y-2",
                            for point in skill_points {
                                div { class: "bg-slate-950 border border-slate-800 rounded p-2.5",
                                    div { class: "flex justify-between text-[11px] text-slate-400 mb-1",
                                        span { "{point.day}" }
                                        span { "G:{point.grammar} • V:{point.vocabulary} • L:{point.listening}" }
                                    }
                                    div { class: "grid grid-cols-3 gap-2",
                                        div { class: "h-2 bg-slate-800 rounded overflow-hidden", div { class: "h-2 bg-teal-400", width: "{(point.grammar * 18).min(100)}%" } }
                                        div { class: "h-2 bg-slate-800 rounded overflow-hidden", div { class: "h-2 bg-amber-400", width: "{(point.vocabulary * 18).min(100)}%" } }
                                        div { class: "h-2 bg-slate-800 rounded overflow-hidden", div { class: "h-2 bg-indigo-400", width: "{(point.listening * 18).min(100)}%" } }
                                    }
                                }
                            }
                        }
                        div { class: "flex gap-4 mt-3 text-[10px] text-slate-400",
                            span { class: "inline-flex items-center gap-1", span { class: "w-2 h-2 rounded bg-teal-400" } "Grammar" }
                            span { class: "inline-flex items-center gap-1", span { class: "w-2 h-2 rounded bg-amber-400" } "Vocabulary" }
                            span { class: "inline-flex items-center gap-1", span { class: "w-2 h-2 rounded bg-indigo-400" } "Listening" }
                        }
                    }
                }

                div { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
                    Link { to: Route::Lesson { language: course.id.to_string(), level: lang_level.clone(), goal: goal.clone() }, class: "bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-orange-400/50 transition", h3 { class: "font-bold text-orange-300", "Lesson" } p { class: "text-xs text-slate-400 mt-1", "Belajar materi terstruktur." } }
                    Link { to: Route::Quiz { language: course.id.to_string(), level: lang_level.clone(), goal: goal.clone() }, class: "bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-teal-400/50 transition", h3 { class: "font-bold text-teal-300", "Quiz" } p { class: "text-xs text-slate-400 mt-1", "Latihan soal + evaluasi." } }
                    Link { to: Route::ChatRoleplay { language: course.id.to_string(), level: lang_level.clone(), goal: goal.clone() }, class: "bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-indigo-400/50 transition", h3 { class: "font-bold text-indigo-300", "Chat AI" } p { class: "text-xs text-slate-400 mt-1", "Simulasi percakapan." } }
                    Link { to: Route::WeaknessPractice { language: course.id.to_string(), level: lang_level.clone(), goal: goal.clone() }, class: "bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-amber-400/50 transition", h3 { class: "font-bold text-amber-300", "Practice Weakness" } p { class: "text-xs text-slate-400 mt-1", "Fokus topik paling lemah." } }
                    Link { to: Route::WeaknessAnalytics { language: course.id.to_string() }, class: "bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-fuchsia-400/50 transition", h3 { class: "font-bold text-fuchsia-300", "Weakness Analytics" } p { class: "text-xs text-slate-400 mt-1", "Lihat tren kelemahan." } }
                    Link { to: Route::FlashcardReview { language: course.id.to_string() }, class: "bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-emerald-400/50 transition", h3 { class: "font-bold text-emerald-300", "Flashcard Review" } p { class: "text-xs text-slate-400 mt-1", "Review kartu jatuh tempo." } }
                }
            }
        }
    }
}
