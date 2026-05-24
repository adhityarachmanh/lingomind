use dioxus::prelude::*;
use crate::models::constants::{LanguageCourse, COURSE_CATEGORIES};
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::flashcard::get_due_flashcard_count_server;
use crate::services::mission::get_daily_mission_server;
use crate::services::weakness::{get_top_weaknesses_server, get_weakness_analytics_server, get_skill_progress_7d_server};
use crate::services::engagement::get_engagement_stats_server;
use crate::services::auth::update_preferred_language_server;
use crate::services::badge::get_user_badges_server;
use crate::services::flashcard::get_due_flashcards_server;
use crate::services::gemini::generate_lesson_server;
use crate::services::offline::{save_offline_lesson, save_offline_flashcards};

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

fn change_language(
    new_lang: String,
    mut selected_language: Signal<String>,
    user_opt: Option<UserProfile>,
    mut session_state: Signal<(Option<UserProfile>, bool)>,
    langs: &[LanguageCourse]
) {
    let selected = new_lang.trim().to_string();
    if selected.is_empty() {
        return;
    }
    if !langs.iter().any(|course| course.id == selected) {
        return;
    }

    selected_language.set(selected.clone());
    if let Some(mut profile) = user_opt {
        profile.preferred_language = selected.clone();
        session_state.set((Some(profile.clone()), true));

        let email = profile.email.clone();
        spawn(async move {
            if let Ok(updated_profile) = update_preferred_language_server(email, selected).await {
                session_state.set((Some(updated_profile), true));
            }
        });
    }
}

#[component]
pub fn Dashboard() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let languages_res = use_context::<Resource<Vec<LanguageCourse>>>();
    let langs = languages_res().unwrap_or_default();
    let mut is_modal_open = use_signal(|| false);
    let mut search_query = use_signal(String::new);
    let mut active_tab = use_signal(|| "All".to_string());
    let mut buy_status = use_signal(String::new);
    let mut offline_download_status = use_signal(String::new);
    let mut show_tour = use_signal(|| false);

    use_effect(move || {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(window) = web_sys::window() {
                if let Ok(Some(storage)) = window.local_storage() {
                    if storage.get_item("lingomind_tour_completed").ok().flatten().is_none() {
                        show_tour.set(true);
                    }
                }
            }
        }
    });

    let complete_tour = move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(window) = web_sys::window() {
                if let Ok(Some(storage)) = window.local_storage() {
                    let _ = storage.set_item("lingomind_tour_completed", "true");
                }
            }
        }
        show_tour.set(false);
    };

    let (user_opt, is_session_ready) = session_state();

    if !is_session_ready {
        return rsx! { div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex justify-center items-center", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    }
    if user_opt.is_none() {
        return rsx! { div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex justify-center items-center p-8", div { class: "bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center max-w-sm", p { class: "text-slate-600 dark:text-slate-400 mb-5 font-medium", "Silakan login terlebih dahulu." } Link { to: Route::Login {}, class: "inline-block bg-teal-500 hover:bg-teal-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors shadow-sm", "Kembali ke Login" } } } };
    }

    let user = user_opt.clone().unwrap();

    let selected = selected_language();
    
    let default_course = LanguageCourse {
        id: "English".to_string(),
        name: "English".to_string(),
        native_name: "English".to_string(),
        flag: "🇬🇧".to_string(),
        description: "".to_string(),
        theme_class: "".to_string(),
        button_class: "".to_string(),
        category: "".to_string(),
        tts_lang_code: "".to_string(),
    };

    let course = langs
        .iter()
        .find(|c| c.id == selected)
        .cloned()
        .unwrap_or_else(|| langs.first().cloned().unwrap_or(default_course));

    let lang_level = user.base_level(&course.id);
    let email = user.email.clone();
    let selected_lang_for_resources = selected_language;

    let due_resource = use_resource(move || {
        let u = email.clone();
        let l = selected_lang_for_resources();
        async move { get_due_flashcard_count_server(u, l).await }
    });
    let due_count = due_resource.value()().and_then(|r| r.ok()).unwrap_or(0);

    let email2 = user.email.clone();
    let selected_lang_for_weak = selected_language;
    let weak_resource = use_resource(move || {
        let u = email2.clone();
        let l = selected_lang_for_weak();
        async move { get_top_weaknesses_server(u, l, 2).await }
    });
    let weaknesses = weak_resource.value()().and_then(|r| r.ok()).unwrap_or_default();
    let weak_text = if weaknesses.is_empty() { "belum ada".to_string() } else { weaknesses.iter().map(|w| w.topic.clone()).collect::<Vec<_>>().join(", ") };

    let email3 = user.email.clone();
    let selected_lang_for_mission = selected_language;
    let mission_resource = use_resource(move || {
        let u = email3.clone();
        let l = selected_lang_for_mission();
        async move { get_daily_mission_server(u, l).await }
    });
    let mission = mission_resource.value()().and_then(|r| r.ok());

    let email4 = user.email.clone();
    let selected_lang_for_trend = selected_language;
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
    let selected_lang_for_skill = selected_language;
    let skill_progress_resource = use_resource(move || {
        let u = email5.clone();
        let l = selected_lang_for_skill();
        async move { get_skill_progress_7d_server(u, l).await }
    });
    let skill_points = skill_progress_resource.value()().and_then(|r| r.ok()).unwrap_or_default();

    let goal = "General".to_string();
    let email6 = user.email.clone();
    let mut engagement_resource = use_resource(move || {
        let u = email6.clone();
        async move { get_engagement_stats_server(u).await }
    });
    let engagement = engagement_resource.value()().and_then(|r| r.ok());

    let email7 = user.email.clone();
    let badges_resource = use_resource(move || {
        let u = email7.clone();
        async move { get_user_badges_server(u).await }
    });
    let badges = badges_resource.value()().and_then(|r| r.ok()).unwrap_or_default();

    let email_for_battles = user.email.clone();
    let battles_resource = use_resource(move || {
        let e = email_for_battles.clone();
        async move { crate::services::battle::get_active_battles_server(e).await }
    });
    let active_battles = battles_resource.value()().and_then(|r| r.ok()).unwrap_or_default();

    let email_for_buy = user.email.clone();
    let buy_freeze = move |_| {
        let u = email_for_buy.clone();
        spawn(async move {
            match crate::services::shop::buy_streak_freeze_server(u).await {
                Ok(msg) => buy_status.set(msg),
                Err(e) => {
                    let mut err_str = e.to_string();
                    if err_str.starts_with("error running server function: ") {
                        err_str = err_str.replace("error running server function: ", "");
                    }
                    if err_str.ends_with(" (details: None)") {
                        err_str = err_str.replace(" (details: None)", "");
                    }
                    buy_status.set(err_str);
                }
            }
            engagement_resource.restart();
        });
    };

    let selected_lang_for_dl = selected_language();
    let email_for_dl = user.email.clone();
    let lvl_for_dl = lang_level.clone();
    let start_offline_download = move |_| {
        let email = email_for_dl.clone();
        let lang = selected_lang_for_dl.clone();
        let lvl = lvl_for_dl.clone();
        
        offline_download_status.set("Mengunduh Flashcard...".to_string());
        spawn(async move {
            if let Ok(fc) = get_due_flashcards_server(email.clone(), lang.clone(), 50).await {
                save_offline_flashcards(&lang, &fc);
            }
            
            offline_download_status.set("Mengunduh Lesson...".to_string());
            if let Ok(lesson) = generate_lesson_server(email.clone(), lang.clone(), lvl.clone(), "General".to_string(), 1).await {
                save_offline_lesson(&lang, "General", &lesson);
            }
            
            offline_download_status.set("Selesai! Data tersimpan offline.".to_string());
        });
    };

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-4 sm:p-8 font-sans",
            div { class: "max-w-5xl mx-auto space-y-6",
                div { class: "relative overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700 rounded-3xl p-6 sm:p-10 shadow-xl shadow-teal-500/20 text-white",
                    div { class: "relative z-10",
                        h1 { class: "text-3xl sm:text-4xl font-extrabold mb-2", "Halo, {user.full_name}!" }
                        p { class: "text-teal-50 text-sm sm:text-base opacity-90 font-medium", "Siap untuk melanjutkan petualangan bahasamu hari ini?" }
                    }
                    div { class: "absolute -bottom-10 -right-10 w-48 h-48 bg-white dark:bg-slate-900 opacity-10 rounded-full blur-2xl pointer-events-none" }
                    div { class: "absolute top-10 right-20 w-24 h-24 bg-teal-300 opacity-20 rounded-full blur-xl pointer-events-none" }
                }

                div { class: "bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-sm",
                    div { class: "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                        div { class: "flex items-center gap-4",
                            div { class: "w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-2xl shadow-inner", "{course.flag}" }
                            div {
                                p { class: "text-xs font-bold uppercase tracking-wider text-slate-500/50 dark:text-slate-400", "Bahasa Aktif" }
                                h2 { class: "text-xl font-bold text-slate-800 dark:text-slate-200", "{course.id}" }
                                p { class: "text-sm text-slate-600 dark:text-slate-400 font-medium", "{course.native_name} - Level {lang_level}" }
                            }
                        }
                        button {
                            class: "flex items-center gap-2.5 px-4.5 py-2.5 rounded-xl border border-slate-200/50 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-100 dark:bg-slate-800 hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/50 cursor-pointer shadow-sm",
                            onclick: move |_| is_modal_open.set(true),
                            span { "Ubah Bahasa" }
                            span { class: "text-[10px] text-slate-500/30 dark:text-slate-400", "▼" }
                        }
                    }
                    div { class: "grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6",
                        div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100/30 dark:border-slate-800 rounded-xl p-3 flex items-center gap-3", 
                            div { class: "w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 text-lg shrink-0", "⏰" }
                            div { class: "min-w-0 flex-1",
                                p { class: "text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400", "Due Flashcard" }
                                p { class: "text-lg font-black text-slate-800 dark:text-slate-200 truncate", "{due_count}" }
                            }
                        }
                        div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 flex items-center gap-3", 
                            div { class: "w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 text-lg shrink-0", "📈" }
                            div { class: "min-w-0 flex-1",
                                p { class: "text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400", "Trend Kelemahan" }
                                p { class: "text-lg font-black text-slate-800 dark:text-slate-200 capitalize truncate", "{trend_label}" }
                            }
                        }
                        div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 flex items-center gap-3", 
                            div { class: "w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 text-lg shrink-0", "🎯" }
                            div { class: "min-w-0 flex-1",
                                p { class: "text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400", "Topik Lemah" }
                                p { class: "text-sm font-black text-slate-800 dark:text-slate-200 capitalize truncate", "{weak_text}" }
                            }
                        }
                    }
                    div { class: "mt-4 bg-indigo-50/30 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 flex items-center justify-between shadow-sm",
                        div {
                            p { class: "text-sm font-bold text-indigo-800 dark:text-white", "Belum yakin dengan level Anda?" }
                            p { class: "text-xs text-indigo-600 dark:text-indigo-200 mt-1 font-medium", "Ikuti tes penempatan singkat (Placement Test) dengan AI." }
                        }
                        Link {
                            to: Route::PlacementTest {},
                            class: "bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-sm transition-colors",
                            "Mulai Tes"
                        }
                    }
                }

                if let Some(es) = engagement {
                    div { class: "bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-700 rounded-2xl p-5 shadow-sm",
                        div { class: "flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3",
                            p { class: "text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2", span { class: "text-amber-500", "🔥" } "Streak & Pencapaian" }
                            div { class: "flex gap-2 items-center",
                                div { class: "px-3 py-1 bg-amber-50/30 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-900/50 shadow-sm", "🪙 {es.coins} Koin" }
                                div { class: "px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-200 shadow-sm", "❄️ {es.streak_freezes} Freeze" }
                                button {
                                    class: "px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer",
                                    onclick: buy_freeze,
                                    "Beli Freeze (50 Koin)"
                                }
                            }
                        }
                        if !buy_status().is_empty() {
                            p { class: "text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-3", "{buy_status()}" }
                        }
                        div { class: "grid grid-cols-2 md:grid-cols-4 gap-3 text-xs",
                            div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3", p { class: "text-slate-500 dark:text-slate-400 font-semibold mb-1", "Current Streak" } p { class: "text-base font-black text-slate-800 dark:text-slate-200", "{es.current_streak} hari" } }
                            div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3", p { class: "text-slate-500 dark:text-slate-400 font-semibold mb-1", "Longest Streak" } p { class: "text-base font-black text-slate-800 dark:text-slate-200", "{es.longest_streak} hari" } }
                            div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3", p { class: "text-slate-500 dark:text-slate-400 font-semibold mb-1", "Quiz Selesai" } p { class: "text-base font-black text-slate-800 dark:text-slate-200", "{es.total_quiz_completed}" } }
                            div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3", p { class: "text-slate-500 dark:text-slate-400 font-semibold mb-1", "Poin" } p { class: "text-base font-black text-slate-800 dark:text-slate-200", "{es.total_points_earned}" } }
                        }

                        // Badges Section
                        if !badges.is_empty() {
                            div { class: "mt-5 pt-5 border-t border-slate-100 dark:border-slate-800",
                                p { class: "text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2", span { class: "text-yellow-500", "🏅" } "Badges / Lencana" }
                                div { class: "flex flex-wrap gap-3",
                                    for badge in badges {
                                        div { class: "flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 pr-4",
                                            div { class: "w-8 h-8 rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-lg shadow-sm", "{badge.icon_name}" }
                                            div {
                                                p { class: "text-xs font-bold text-slate-800 dark:text-slate-200", "{badge.name}" }
                                                p { class: "text-[10px] text-slate-500 dark:text-slate-400 font-medium", "{badge.description}" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if let Some(m) = mission {
                    div { class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm",
                        p { class: "text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2", span { class: "text-teal-500", "🏆" } "Daily Mission (10-15 menit)" }
                        div { class: "grid grid-cols-2 md:grid-cols-4 gap-3 text-xs",
                            div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3", p { class: "text-slate-500 dark:text-slate-400 font-semibold mb-1", "Lesson" } p { class: "text-base font-black text-slate-800 dark:text-slate-200", "{m.lesson_target}x" } }
                            div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3", p { class: "text-slate-500 dark:text-slate-400 font-semibold mb-1", "Quiz" } p { class: "text-base font-black text-slate-800 dark:text-slate-200", "{m.quiz_target}x" } }
                            div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3", p { class: "text-slate-500 dark:text-slate-400 font-semibold mb-1", "Weakness" } p { class: "text-base font-black text-slate-800 dark:text-slate-200", "{m.weakness_target}x" } }
                            div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3", p { class: "text-slate-500 dark:text-slate-400 font-semibold mb-1", "Flashcard" } p { class: "text-base font-black text-slate-800 dark:text-slate-200", "{m.flashcard_target}x" } }
                        }
                    }
                }

                div { class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm",
                    p { class: "text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2", span { class: "text-indigo-500", "📊" } "Progress Skill 7 Hari" }
                    if skill_points.is_empty() {
                        div { class: "bg-slate-50 dark:bg-slate-950 rounded-xl p-6 text-center border border-slate-100 dark:border-slate-800", p { class: "text-sm text-slate-500 dark:text-slate-400 font-medium", "Belum ada data progress skill. Kerjakan quiz dulu." } }
                    } else {
                        div { class: "space-y-3",
                            for point in skill_points {
                                div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3.5",
                                    div { class: "flex justify-between items-center mb-2",
                                        span { class: "text-xs font-bold text-slate-600 dark:text-slate-400", "{format_date_id(&point.day)}" }
                                        span { class: "text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-900 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-800", "G:{point.grammar} • V:{point.vocabulary} • L:{point.listening}" }
                                    }
                                    div { class: "grid grid-cols-3 gap-3",
                                        div { class: "h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden", div { class: "h-2.5 bg-teal-400 rounded-full", width: "{(point.grammar * 18).min(100)}%" } }
                                        div { class: "h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden", div { class: "h-2.5 bg-amber-400 rounded-full", width: "{(point.vocabulary * 18).min(100)}%" } }
                                        div { class: "h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden", div { class: "h-2.5 bg-indigo-400 rounded-full", width: "{(point.listening * 18).min(100)}%" } }
                                    }
                                }
                            }
                        }
                        div { class: "flex gap-5 mt-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 justify-center",
                            span { class: "inline-flex items-center gap-1.5", span { class: "w-2.5 h-2.5 rounded-full bg-teal-400" } "Grammar" }
                            span { class: "inline-flex items-center gap-1.5", span { class: "w-2.5 h-2.5 rounded-full bg-amber-400" } "Vocabulary" }
                            span { class: "inline-flex items-center gap-1.5", span { class: "w-2.5 h-2.5 rounded-full bg-indigo-400" } "Listening" }
                        }
                    }
                }

                div { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2",
                    
                    // Arena Pertarungan
                    div { class: "bg-gradient-to-br from-indigo-500 to-purple-600 border border-indigo-200 rounded-2xl p-5 hover:shadow-lg transition-all group sm:col-span-2 lg:col-span-3 text-white relative overflow-hidden",
                        div { class: "relative z-10",
                            h3 { class: "font-black text-xl flex items-center gap-2", span { class: "text-2xl", "⚔️" } "Arena Pertarungan" }
                            p { class: "text-indigo-100 mt-1 text-sm font-medium mb-4", "Tantang temanmu dan buktikan siapa yang terbaik!" }
                            
                            if active_battles.is_empty() {
                                div { class: "bg-white/10 dark:bg-slate-900/10 rounded-xl p-4 text-center",
                                    p { class: "text-sm", "Belum ada pertarungan aktif." }
                                }
                            } else {
                                div { class: "space-y-3",
                                    for battle in active_battles {
                                        {
                                            let is_challenger = battle.challenger_email == user.email;
                                            let opponent_name = if is_challenger { &battle.challenged_name } else { &battle.challenger_name };
                                            let my_score = if is_challenger { Some(battle.challenger_score) } else { battle.challenged_score };
                                            let op_score = if is_challenger { battle.challenged_score } else { Some(battle.challenger_score) };
                                            
                                            rsx! {
                                                div { class: "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm",
                                                    div {
                                                        p { class: "font-bold", "Vs {opponent_name}" }
                                                        p { class: "text-xs text-slate-500 dark:text-slate-400 font-medium", "Topik: {battle.goal} ({battle.language})" }
                                                        if battle.status == "completed" {
                                                            p { class: "text-xs mt-1 font-bold text-teal-600 dark:text-teal-400", "Skor: Kamu {my_score.unwrap_or(0)} - {op_score.unwrap_or(0)} {opponent_name}" }
                                                        } else {
                                                            p { class: "text-xs mt-1 font-bold text-amber-500", "Status: Menunggu penyelesaian..." }
                                                        }
                                                    }
                                                    
                                                    if battle.status == "pending" && my_score.is_none() {
                                                        Link {
                                                            to: Route::Quiz { goal: battle.goal.clone(), battle_id: Some(battle.id) },
                                                            class: "bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap text-center shadow-sm",
                                                            "Terima Tantangan!"
                                                        }
                                                    } else if battle.status == "pending" {
                                                        span { class: "text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-center", "Menunggu Lawan" }
                                                    } else {
                                                        span { class: "text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-center", "Selesai" }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-white/5 dark:bg-slate-900/5 rounded-full -mr-10 -mt-10 blur-xl pointer-events-none" }
                    }

                    Link { to: Route::Roadmap {}, class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-orange-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-orange-500 text-lg group-hover:text-orange-600 dark:text-orange-400 transition-colors", "Kurikulum Terstruktur" } p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium", "Pilih topik & materi sesuai levelmu." } }
                    Link { to: Route::ChatRoleplay { goal: "Bebas".to_string() }, class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-indigo-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-indigo-500 text-lg group-hover:text-indigo-600 dark:text-indigo-400 transition-colors", "Chat AI" } p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium", "Simulasi percakapan teks bebas." } }
                    Link { to: Route::VoiceChat { goal: "Bebas".to_string() }, class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-emerald-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-emerald-500 text-lg group-hover:text-emerald-600 transition-colors", "Live Voice AI" } p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium", "Ngobrol langsung dengan suara." } }
                    Link { to: Route::WeaknessPractice { goal: goal.clone() }, class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-amber-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-amber-500 text-lg group-hover:text-amber-600 dark:text-amber-400 transition-colors", "Practice Weakness" } p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium", "Fokus latihan topik paling lemah." } }
                    Link { to: Route::WeaknessAnalytics {}, class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-fuchsia-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-fuchsia-500 text-lg group-hover:text-fuchsia-600 transition-colors", "Weakness Analytics" } p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium", "Lihat tren kelemahan detail." } }
                    Link { to: Route::FlashcardReview {}, class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-rose-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-rose-500 text-lg group-hover:text-rose-600 dark:text-rose-400 transition-colors", "Flashcard Review" } p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium", "Review {due_count} kartu jatuh tempo." } }
                    Link { to: Route::Leaderboard {}, class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-yellow-400 hover:shadow-md transition-all group sm:col-span-2 lg:col-span-3", h3 { class: "font-bold text-yellow-500 text-lg group-hover:text-yellow-600 transition-colors", "🏆 Leaderboard" } p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium", "Lihat peringkat poin semua pengguna." } }
                }
            }

            // Mode Offline Panel
            div { class: "mt-8 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700 rounded-2xl p-6 shadow-sm",
                h3 { class: "text-lg font-bold text-slate-800/60 dark:text-slate-200 mb-2 flex items-center gap-2",
                    "📱 Mode Offline (PWA)"
                }
                p { class: "text-sm text-slate-600 dark:text-slate-400 mb-4 font-medium",
                    "Unduh materi Flashcard & Lesson agar bisa dipelajari tanpa koneksi internet."
                }
                button {
                    class: "bg-teal-500 hover:bg-teal-600 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-colors shadow-sm cursor-pointer",
                    onclick: start_offline_download,
                    "Unduh Materi Sekarang"
                }
                if !offline_download_status().is_empty() {
                    p { class: "text-sm text-teal-600 dark:text-teal-400 mt-3 font-semibold", "{offline_download_status()}" }
                }
            }
            if is_modal_open() {
                div {
                    class: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm transition-all duration-300",
                    onclick: move |_| {
                        is_modal_open.set(false);
                        search_query.set(String::new());
                    },
                    div {
                        class: "bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] border border-slate-100 dark:border-slate-800 transition-all transform scale-100",
                        onclick: move |e| e.stop_propagation(),
                        
                        // Header
                        div {
                            class: "p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between",
                            div {
                                h3 { class: "text-lg font-extrabold text-slate-900 dark:text-slate-50", "Pilih Bahasa Belajar" }
                                p { class: "text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5", "Pilih bahasa target untuk materi dan kuis Anda" }
                            }
                            button {
                                class: "w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold transition-colors cursor-pointer",
                                onclick: move |_| {
                                    is_modal_open.set(false);
                                    search_query.set(String::new());
                                },
                                "✕"
                            }
                        }

                        // Search & Filters
                        div {
                            class: "p-6 py-4 bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100/20 dark:border-slate-800 space-y-3.5",
                            div {
                                class: "relative flex items-center",
                                span {
                                    class: "absolute left-4 text-slate-400 text-sm pointer-events-none",
                                    "🔍"
                                }
                                input {
                                    class: "w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 font-semibold focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all",
                                    placeholder: "Cari nama bahasa...",
                                    value: "{search_query()}",
                                    oninput: move |e| search_query.set(e.value()),
                                    autofocus: true,
                                }
                            }
                            
                            // Category tabs
                            div {
                                class: "flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none w-full",
                                for cat in &["All", "Eropa", "Asia", "Amerika", "Timur Tengah"] {
                                    button {
                                        class: if active_tab() == *cat {
                                            "px-3.5 py-1.5 rounded-full text-xs font-bold bg-teal-500 text-white shadow-sm transition-all cursor-pointer flex-shrink-0 whitespace-nowrap"
                                        } else {
                                            "px-3.5 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-950 hover:text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex-shrink-0 whitespace-nowrap"
                                        },
                                        onclick: move |_| active_tab.set(cat.to_string()),
                                        "{cat}"
                                    }
                                }
                            }
                        }

                        // Scrollable grid
                        div {
                            class: "flex-1 overflow-y-auto p-6 space-y-4 min-h-[250px]",
                            {
                                let q = search_query().to_lowercase();
                                let filtered = langs.iter().filter(|c| {
                                    let matches_search = c.id.to_lowercase().contains(&q) || c.native_name.to_lowercase().contains(&q) || c.name.to_lowercase().contains(&q);
                                    let matches_cat = active_tab() == "All" || c.category == active_tab();
                                    matches_search && matches_cat
                                }).collect::<Vec<_>>();

                                if filtered.is_empty() {
                                    rsx! {
                                        div {
                                            class: "flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-2",
                                            span { class: "text-3xl", "🗺️" }
                                            p { class: "text-sm font-bold", "Bahasa tidak ditemukan" }
                                            p { class: "text-xs opacity-75 max-w-[200px]", "Coba kata kunci lain atau pilih kategori berbeda." }
                                        }
                                    }
                                } else {
                                    rsx! {
                                        div {
                                            class: "grid grid-cols-1 sm:grid-cols-2 gap-3",
                                            {
                                                filtered.into_iter().map(|c| {
                                                    let is_active = c.id == selected_language();
                                                    let c_id = c.id.clone();
                                                    let user_opt = user_opt.clone();
                                                    let langs_ref = langs.clone();
                                                    rsx! {
                                                        div {
                                                            key: "{c.id}",
                                                            class: if is_active {
                                                                "flex items-center gap-3.5 p-3.5 rounded-2xl border-2 border-teal-500 bg-teal-50/30 dark:bg-teal-900/30/40 text-teal-900 cursor-pointer shadow-sm transition-all"
                                                            } else {
                                                                "flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-950 cursor-pointer transition-all"
                                                            },
                                                            onclick: move |_| {
                                                                change_language(
                                                                    c_id.clone(),
                                                                    selected_language,
                                                                    user_opt.clone(),
                                                                    session_state,
                                                                    &langs_ref,
                                                                );
                                                                is_modal_open.set(false);
                                                                search_query.set(String::new());
                                                            },
                                                            div { class: "w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-2xl shadow-sm", "{c.flag}" }
                                                            div {
                                                                p { class: "text-sm font-bold text-slate-800 dark:text-slate-200", "{c.id}" }
                                                                p { class: "text-xs text-slate-500 dark:text-slate-400 font-semibold", "{c.native_name} • {c.category}" }
                                                            }
                                                            if is_active {
                                                                span { class: "ml-auto text-teal-500 font-bold", "✓" }
                                                            }
                                                        }
                                                    }
                                                })
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Onboarding Tour Modal
                if show_tour() {
                    div { class: "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in",
                        div { class: "bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl relative text-center border-4 border-teal-500 transform transition-all",
                            div { class: "absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center text-2xl shadow-lg border-4 border-white", "👋" }
                            h2 { class: "text-2xl font-black text-slate-800 dark:text-slate-200 mt-6 mb-2", "Selamat Datang di LingoMind!" }
                            p { class: "text-slate-600 dark:text-slate-400 mb-6 text-sm font-medium leading-relaxed", 
                                "Kami siap membantu Anda menguasai bahasa baru:"
                                br {} br {}
                                "1. " span { class: "font-bold text-teal-600 dark:text-teal-400", "Roleplay Voice Chat" } ": Berlatih bicara langsung dengan AI." br {}
                                "2. " span { class: "font-bold text-teal-600 dark:text-teal-400", "Mode Offline" } ": Download materi di bagian bawah dashboard." br {}
                                "3. " span { class: "font-bold text-teal-600 dark:text-teal-400", "Quiz Battles" } ": Kumpulkan koin dan tantang temanmu!"
                            }
                            button {
                                class: "w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 shadow-md cursor-pointer",
                                onclick: complete_tour,
                                "Mulai Belajar Sekarang 🚀"
                            }
                        }
                    }
                }
            }
        }
    }
}
