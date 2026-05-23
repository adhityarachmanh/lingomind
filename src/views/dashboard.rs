use dioxus::prelude::*;
use crate::models::constants::LANGUAGE_COURSES;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::flashcard::get_due_flashcard_count_server;
use crate::services::mission::get_daily_mission_server;
use crate::services::weakness::{get_top_weaknesses_server, get_weakness_analytics_server, get_skill_progress_7d_server};
use crate::services::engagement::get_engagement_stats_server;
use crate::services::auth::update_preferred_language_server;

fn format_date_id(date: &str) -> String {
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() != 3 {
        return date.to_string();
    }

    let year = parts[0];
    let month = match parts[1].parse::<u8>() {
        Ok(v) => v,
        Err(_) => return date.to_string(),
    };
    let day = match parts[2].parse::<u8>() {
        Ok(v) => v,
        Err(_) => return date.to_string(),
    };

    let month_name = match month {
        1 => "Januari",
        2 => "Februari",
        3 => "Maret",
        4 => "April",
        5 => "Mei",
        6 => "Juni",
        7 => "Juli",
        8 => "Agustus",
        9 => "September",
        10 => "Oktober",
        11 => "November",
        12 => "Desember",
        _ => return date.to_string(),
    };

    format!("{day} {month_name} {year}")
}

#[component]
pub fn Dashboard() -> Element {
    let mut session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let mut selected_language = use_context::<Signal<String>>();
    let (user_opt, is_session_ready) = session_state();

    if !is_session_ready {
        return rsx! { div { class: "min-h-screen bg-slate-50 text-slate-900 flex justify-center items-center", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    }
    if user_opt.is_none() {
        return rsx! { div { class: "min-h-screen bg-slate-50 text-slate-900 flex justify-center items-center p-8", div { class: "bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center max-w-sm", p { class: "text-slate-600 mb-5 font-medium", "Silakan login terlebih dahulu." } Link { to: Route::Login {}, class: "inline-block bg-teal-500 hover:bg-teal-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors shadow-sm", "Kembali ke Login" } } } };
    }

    let user_for_language_change = user_opt.clone();
    let user = user_opt.unwrap();
    let mut handle_language_change = move |new_lang: String| {
        let selected = new_lang.trim().to_string();
        if selected.is_empty() {
            return;
        }
        if !LANGUAGE_COURSES.iter().any(|course| course.id == selected) {
            return;
        }

        selected_language.set(selected.clone());
        if let Some(mut profile) = user_for_language_change.clone() {
            profile.preferred_language = selected.clone();
            session_state.set((Some(profile.clone()), true));

            let email = profile.email.clone();
            let mut session_state_after_save = session_state;
            spawn(async move {
                if let Ok(updated_profile) = update_preferred_language_server(email, selected).await {
                    session_state_after_save.set((Some(updated_profile), true));
                }
            });
        }
    };

    let selected = selected_language();
    let course = LANGUAGE_COURSES
        .iter()
        .find(|c| c.id == selected)
        .unwrap_or(&LANGUAGE_COURSES[0]);

    let lang_level = user.current_level.get(course.id).cloned().unwrap_or_else(|| "A1".to_string());
    let email = user.email.clone();
    let mut selected_lang_for_resources = selected_language;

    let due_resource = use_resource(move || {
        let u = email.clone();
        let l = selected_lang_for_resources();
        async move { get_due_flashcard_count_server(u, l).await }
    });
    let due_count = due_resource.value()().and_then(|r| r.ok()).unwrap_or(0);

    let email2 = user.email.clone();
    let mut selected_lang_for_weak = selected_language;
    let weak_resource = use_resource(move || {
        let u = email2.clone();
        let l = selected_lang_for_weak();
        async move { get_top_weaknesses_server(u, l, 2).await }
    });
    let weaknesses = weak_resource.value()().and_then(|r| r.ok()).unwrap_or_default();
    let weak_text = if weaknesses.is_empty() { "belum ada".to_string() } else { weaknesses.iter().map(|w| w.topic.clone()).collect::<Vec<_>>().join(", ") };

    let email3 = user.email.clone();
    let mut selected_lang_for_mission = selected_language;
    let mission_resource = use_resource(move || {
        let u = email3.clone();
        let l = selected_lang_for_mission();
        async move { get_daily_mission_server(u, l).await }
    });
    let mission = mission_resource.value()().and_then(|r| r.ok());

    let email4 = user.email.clone();
    let mut selected_lang_for_trend = selected_language;
    let trend_resource = use_resource(move || {
        let u = email4.clone();
        let l = selected_lang_for_trend();
        async move { get_weakness_analytics_server(u, l, 1).await }
    });
    let trend = trend_resource.value()().and_then(|r| r.ok()).and_then(|v| v.into_iter().next());
    let trend_label = if let Some(t) = trend {
        let ratio = if t.count_30d == 0 { 0.0 } else { t.count_7d as f64 / t.count_30d as f64 };
        if ratio >= 0.6 { "naik" } else if ratio >= 0.35 { "stabil" } else { "membaik" }
    } else {
        "belum ada"
    };

    let email5 = user.email.clone();
    let mut selected_lang_for_skill = selected_language;
    let skill_progress_resource = use_resource(move || {
        let u = email5.clone();
        let l = selected_lang_for_skill();
        async move { get_skill_progress_7d_server(u, l).await }
    });
    let skill_points = skill_progress_resource.value()().and_then(|r| r.ok()).unwrap_or_default();

    let goal = "General".to_string();
    let email6 = user.email.clone();
    let engagement_resource = use_resource(move || {
        let u = email6.clone();
        async move { get_engagement_stats_server(u).await }
    });
    let engagement = engagement_resource.value()().and_then(|r| r.ok());
    rsx! {
        div { class: "min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 font-sans",
            div { class: "max-w-5xl mx-auto space-y-6",
                div { class: "relative overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700 rounded-3xl p-6 sm:p-10 shadow-xl shadow-teal-500/20 text-white",
                    div { class: "relative z-10",
                        h1 { class: "text-3xl sm:text-4xl font-extrabold mb-2", "Halo, {user.full_name}!" }
                        p { class: "text-teal-50 text-sm sm:text-base opacity-90 font-medium", "Siap untuk melanjutkan petualangan bahasamu hari ini?" }
                    }
                    div { class: "absolute -bottom-10 -right-10 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl pointer-events-none" }
                    div { class: "absolute top-10 right-20 w-24 h-24 bg-teal-300 opacity-20 rounded-full blur-xl pointer-events-none" }
                }

                div { class: "bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm",
                    div { class: "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                        div { class: "flex items-center gap-4",
                            div { class: "w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-2xl shadow-inner", "{course.flag}" }
                            div {
                                p { class: "text-xs font-bold uppercase tracking-wider text-slate-500", "Bahasa Aktif" }
                                h2 { class: "text-xl font-bold text-slate-800", "{course.id}" }
                                p { class: "text-sm text-slate-600 font-medium", "{course.native_name} - Level {lang_level}" }
                            }
                        }
                        select {
                            class: "px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/50 cursor-pointer",
                            value: "{selected_language()}",
                            onchange: move |e| handle_language_change(e.value()),
                            for c in LANGUAGE_COURSES {
                                option { value: "{c.id}", "{c.flag} {c.id}" }
                            }
                        }
                    }
                    div { class: "grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6",
                        div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3", 
                            div { class: "w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 text-lg", "⏰" }
                            div {
                                p { class: "text-[10px] uppercase font-bold text-slate-500", "Due Flashcard" }
                                p { class: "text-lg font-black text-slate-800", "{due_count}" }
                            }
                        }
                        div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3", 
                            div { class: "w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 text-lg", "📈" }
                            div {
                                p { class: "text-[10px] uppercase font-bold text-slate-500", "Trend Kelemahan" }
                                p { class: "text-lg font-black text-slate-800 capitalize", "{trend_label}" }
                            }
                        }
                        div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3", 
                            div { class: "w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 text-lg", "🎯" }
                            div {
                                p { class: "text-[10px] uppercase font-bold text-slate-500", "Topik Lemah" }
                                p { class: "text-sm font-black text-slate-800 capitalize line-clamp-1", "{weak_text}" }
                            }
                        }
                    }
                }

                if let Some(es) = engagement {
                    div { class: "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm",
                        p { class: "text-sm font-bold text-slate-800 mb-3 flex items-center gap-2", span { class: "text-amber-500", "🔥" } "Streak & Achievement" }
                        div { class: "grid grid-cols-2 md:grid-cols-4 gap-3 text-xs",
                            div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3", p { class: "text-slate-500 font-semibold mb-1", "Current Streak" } p { class: "text-base font-black text-slate-800", "{es.current_streak} hari" } }
                            div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3", p { class: "text-slate-500 font-semibold mb-1", "Longest Streak" } p { class: "text-base font-black text-slate-800", "{es.longest_streak} hari" } }
                            div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3", p { class: "text-slate-500 font-semibold mb-1", "Quiz Selesai" } p { class: "text-base font-black text-slate-800", "{es.total_quiz_completed}" } }
                            div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3", p { class: "text-slate-500 font-semibold mb-1", "Poin" } p { class: "text-base font-black text-slate-800", "{es.total_points_earned}" } }
                        }
                    }
                }

                if let Some(m) = mission {
                    div { class: "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm",
                        p { class: "text-sm font-bold text-slate-800 mb-3 flex items-center gap-2", span { class: "text-teal-500", "🏆" } "Daily Mission (10-15 menit)" }
                        div { class: "grid grid-cols-2 md:grid-cols-4 gap-3 text-xs",
                            div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3", p { class: "text-slate-500 font-semibold mb-1", "Lesson" } p { class: "text-base font-black text-slate-800", "{m.lesson_target}x" } }
                            div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3", p { class: "text-slate-500 font-semibold mb-1", "Quiz" } p { class: "text-base font-black text-slate-800", "{m.quiz_target}x" } }
                            div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3", p { class: "text-slate-500 font-semibold mb-1", "Weakness" } p { class: "text-base font-black text-slate-800", "{m.weakness_target}x" } }
                            div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3", p { class: "text-slate-500 font-semibold mb-1", "Flashcard" } p { class: "text-base font-black text-slate-800", "{m.flashcard_target}x" } }
                        }
                    }
                }

                div { class: "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm",
                    p { class: "text-sm font-bold text-slate-800 mb-4 flex items-center gap-2", span { class: "text-indigo-500", "📊" } "Progress Skill 7 Hari" }
                    if skill_points.is_empty() {
                        div { class: "bg-slate-50 rounded-xl p-6 text-center border border-slate-100", p { class: "text-sm text-slate-500 font-medium", "Belum ada data progress skill. Kerjakan quiz dulu." } }
                    } else {
                        div { class: "space-y-3",
                            for point in skill_points {
                                div { class: "bg-slate-50 border border-slate-100 rounded-xl p-3.5",
                                    div { class: "flex justify-between items-center mb-2",
                                        span { class: "text-xs font-bold text-slate-600", "{format_date_id(&point.day)}" }
                                        span { class: "text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-100", "G:{point.grammar} • V:{point.vocabulary} • L:{point.listening}" }
                                    }
                                    div { class: "grid grid-cols-3 gap-3",
                                        div { class: "h-2.5 bg-slate-200 rounded-full overflow-hidden", div { class: "h-2.5 bg-teal-400 rounded-full", width: "{(point.grammar * 18).min(100)}%" } }
                                        div { class: "h-2.5 bg-slate-200 rounded-full overflow-hidden", div { class: "h-2.5 bg-amber-400 rounded-full", width: "{(point.vocabulary * 18).min(100)}%" } }
                                        div { class: "h-2.5 bg-slate-200 rounded-full overflow-hidden", div { class: "h-2.5 bg-indigo-400 rounded-full", width: "{(point.listening * 18).min(100)}%" } }
                                    }
                                }
                            }
                        }
                        div { class: "flex gap-5 mt-4 text-[11px] font-bold text-slate-500 justify-center",
                            span { class: "inline-flex items-center gap-1.5", span { class: "w-2.5 h-2.5 rounded-full bg-teal-400" } "Grammar" }
                            span { class: "inline-flex items-center gap-1.5", span { class: "w-2.5 h-2.5 rounded-full bg-amber-400" } "Vocabulary" }
                            span { class: "inline-flex items-center gap-1.5", span { class: "w-2.5 h-2.5 rounded-full bg-indigo-400" } "Listening" }
                        }
                    }
                }

                div { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2",
                    Link { to: Route::Roadmap {}, class: "bg-white border border-slate-200 rounded-2xl p-5 hover:border-orange-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-orange-500 text-lg group-hover:text-orange-600 transition-colors", "Kurikulum Terstruktur" } p { class: "text-sm text-slate-500 mt-1 font-medium", "Pilih topik & materi sesuai levelmu." } }
                    Link { to: Route::ChatRoleplay { goal: "Bebas".to_string() }, class: "bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-indigo-500 text-lg group-hover:text-indigo-600 transition-colors", "Chat AI" } p { class: "text-sm text-slate-500 mt-1 font-medium", "Simulasi percakapan teks bebas." } }
                    Link { to: Route::VoiceChat { goal: "Bebas".to_string() }, class: "bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-emerald-500 text-lg group-hover:text-emerald-600 transition-colors", "Live Voice AI" } p { class: "text-sm text-slate-500 mt-1 font-medium", "Ngobrol langsung dengan suara." } }
                    Link { to: Route::WeaknessPractice { goal: goal.clone() }, class: "bg-white border border-slate-200 rounded-2xl p-5 hover:border-amber-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-amber-500 text-lg group-hover:text-amber-600 transition-colors", "Practice Weakness" } p { class: "text-sm text-slate-500 mt-1 font-medium", "Fokus latihan topik paling lemah." } }
                    Link { to: Route::WeaknessAnalytics {}, class: "bg-white border border-slate-200 rounded-2xl p-5 hover:border-fuchsia-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-fuchsia-500 text-lg group-hover:text-fuchsia-600 transition-colors", "Weakness Analytics" } p { class: "text-sm text-slate-500 mt-1 font-medium", "Lihat tren kelemahan detail." } }
                    Link { to: Route::FlashcardReview {}, class: "bg-white border border-slate-200 rounded-2xl p-5 hover:border-rose-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-rose-500 text-lg group-hover:text-rose-600 transition-colors", "Flashcard Review" } p { class: "text-sm text-slate-500 mt-1 font-medium", "Review {due_count} kartu jatuh tempo." } }
                    Link { to: Route::Leaderboard {}, class: "bg-white border border-slate-200 rounded-2xl p-5 hover:border-yellow-400 hover:shadow-md transition-all group sm:col-span-2 lg:col-span-3", h3 { class: "font-bold text-yellow-500 text-lg group-hover:text-yellow-600 transition-colors", "🏆 Leaderboard" } p { class: "text-sm text-slate-500 mt-1 font-medium", "Lihat peringkat poin semua pengguna." } }
                }
            }
        }
    }
}
