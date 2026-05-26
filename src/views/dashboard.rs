use dioxus::prelude::*;
use crate::models::constants::LanguageCourse;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::flashcard::get_due_flashcard_count_server;
use crate::services::mission::{get_daily_mission_server, claim_mission_reward_server};
use crate::services::weakness::{get_top_weaknesses_server, get_weakness_analytics_server, get_skill_progress_7d_server};
use crate::services::engagement::get_engagement_stats_server;
use crate::services::auth::update_preferred_language_server;
use crate::services::badge::get_user_badges_server;
use crate::services::flashcard::get_due_flashcards_server;
use crate::services::gemini::generate_lesson_server;
use crate::services::offline::{save_offline_lesson, save_offline_flashcards};
use crate::services::pet::{get_active_pet_server, feed_pet_server, get_all_pets_server, set_active_pet_server};
use crate::services::social::{get_social_feed_server, like_activity_server};

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
    let mut offline_download_status = use_signal(String::new);
    let mut show_tour = use_signal(|| false);
    let mut pet_modal_open = use_signal(|| false);
    let mut hearts_modal_open = use_signal(|| false);
    let mut refill_status = use_signal(String::new);

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
        edge_tts_voice: "".to_string(),
    };

    let mut dynamic_categories = vec!["All".to_string()];
    for lang in &langs {
        if !dynamic_categories.contains(&lang.category) && !lang.category.is_empty() {
            dynamic_categories.push(lang.category.clone());
        }
    }

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

    let email_for_pet = user.email.clone();
    let mut pet_resource = use_resource(move || {
        let e = email_for_pet.clone();
        async move { get_active_pet_server(e).await }
    });
    let active_pet = pet_resource.value()().and_then(|r| r.ok()).flatten();

    let email_for_feed = user.email.clone();
    let mut feed_status = use_signal(String::new);
    let feed_pet = move |pet_id: i32| {
        let e = email_for_feed.clone();
        let mut pr = pet_resource;
        let mut er = engagement_resource;
        spawn(async move {
            match feed_pet_server(e, pet_id).await {
                Ok(msg) => {
                    feed_status.set(msg);
                    pr.restart();
                    er.restart();
                },
                Err(err) => {
                    feed_status.set(err.to_string());
                }
            }
        });
    };
    let email_for_all_pets = user.email.clone();
    let mut all_pets_resource = use_resource(move || {
        let e = email_for_all_pets.clone();
        let is_open = pet_modal_open();
        async move {
            if is_open {
                get_all_pets_server(e).await
            } else {
                Ok(vec![])
            }
        }
    });

    let email_for_set_pet = user.email.clone();
    let set_active_pet = move |pet_id: i32| {
        let e = email_for_set_pet.clone();
        let mut pr = pet_resource;
        let mut apr = all_pets_resource;
        let mut pmo = pet_modal_open;
        spawn(async move {
            if let Ok(_) = set_active_pet_server(e, pet_id).await {
                pr.restart();
                apr.restart();
                pmo.set(false);
            }
        });
    };

    let email_for_social = user.email.clone();
    let mut social_feed_resource = use_resource(move || {
        let e = email_for_social.clone();
        async move { get_social_feed_server(e).await }
    });
    
    let feed_items = social_feed_resource.value()().and_then(|r| r.ok()).unwrap_or_default();
    let email_for_like = user.email.clone();

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
                    div { class: "mt-4 bg-indigo-50/30 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm",
                        div {
                            p { class: "text-sm font-bold text-indigo-800 dark:text-white", "Belum yakin dengan level Anda?" }
                            p { class: "text-xs text-indigo-600 dark:text-indigo-200 mt-1 font-medium", "Ikuti tes penempatan singkat (Placement Test) dengan AI." }
                        }
                        Link {
                            to: Route::PlacementTest {},
                            class: "bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-sm shadow-sm transition-colors w-full sm:w-auto text-center shrink-0",
                            "Mulai Tes"
                        }
                    }
                }

                if let Some(ref es) = engagement {
                    div { class: "bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-700 rounded-2xl p-5 shadow-sm",
                        div { class: "flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3",
                            p { class: "text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2", span { class: "text-amber-500", "🔥" } "Streak & Pencapaian" }
                            div { class: "flex gap-2 items-center",
                                button {
                                    class: "px-3 py-1 bg-rose-50/30 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-bold border border-rose-200 dark:border-rose-900/50 shadow-sm cursor-pointer hover:bg-rose-100 transition-colors",
                                    onclick: move |_| { refill_status.set(String::new()); hearts_modal_open.set(true); },
                                    "❤️ {es.hearts}/5"
                                }
                                div { class: "px-3 py-1 bg-amber-50/30 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-900/50 shadow-sm", "🪙 {es.coins} Koin" }
                                div { class: "px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-200 shadow-sm", "❄️ {es.streak_freezes} Freeze" }
                                Link {
                                    to: Route::Shop {},
                                    class: "px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1",
                                    "Buka Toko 🛒"
                                }
                            }
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
                        p { class: "text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2", span { class: "text-amber-500", "📜" } "Quest Harian Bertingkat" }
                        div { class: "grid grid-cols-1 sm:grid-cols-3 gap-4",
                            
                            // Tier 1: Peti Kayu
                            div { class: format!("border {} rounded-xl p-4 flex flex-col items-center text-center relative overflow-hidden transition-all", if m.tier1_claimed { "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 opacity-70" } else { "border-amber-200 dark:border-amber-900 bg-gradient-to-b from-white to-amber-50 dark:from-slate-900 dark:to-amber-950/20" }),
                                div { class: "text-4xl mb-2", "🪵" }
                                h4 { class: "font-black text-amber-800 dark:text-amber-500 text-sm", "Peti Kayu" }
                                p { class: "text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium min-h-[3rem]", "Selesaikan 1 Kuis Apapun." }
                                
                                // Progress Bar
                                div { class: "w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-3 mb-2",
                                    div { class: "bg-amber-500 h-2 rounded-full", width: "{((m.quiz_progress as f32 / 1.0) * 100.0).min(100.0)}%" }
                                }
                                p { class: "text-[10px] font-bold text-slate-500 mb-3", "{m.quiz_progress}/1 Selesai" }
                                
                                if m.tier1_claimed {
                                    button { class: "w-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold py-1.5 rounded-lg text-xs cursor-not-allowed", disabled: true, "Diklaim" }
                                } else if m.quiz_progress >= 1 {
                                    button {
                                        class: "w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 rounded-lg text-xs shadow-md animate-pulse cursor-pointer",
                                        onclick: {
                                            let e = user.email.clone();
                                            move |_| {
                                                let e_clone = e.clone();
                                                spawn(async move {
                                                    if let Ok(msg) = claim_mission_reward_server(e_clone, 1).await {
                                                        #[cfg(target_arch = "wasm32")]
                                                        if let Some(window) = web_sys::window() {
                                                            let _ = window.alert_with_message(&msg);
                                                            let _ = window.location().reload();
                                                        }
                                                    }
                                                });
                                            }
                                        },
                                        "Klaim 20 Koin!"
                                    }
                                } else {
                                    button { class: "w-full bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold py-1.5 rounded-lg text-xs cursor-not-allowed", disabled: true, "Terkunci" }
                                }
                            }
                            
                            // Tier 2: Peti Perak
                            div { class: format!("border {} rounded-xl p-4 flex flex-col items-center text-center relative overflow-hidden transition-all", if m.tier2_claimed { "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 opacity-70" } else { "border-slate-300 dark:border-slate-600 bg-gradient-to-b from-white to-slate-100 dark:from-slate-900 dark:to-slate-800" }),
                                div { class: "text-4xl mb-2 drop-shadow-md", "🥈" }
                                h4 { class: "font-black text-slate-700 dark:text-slate-300 text-sm", "Peti Perak" }
                                p { class: "text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium min-h-[3rem]", "Jawab 50 pertanyaan dengan benar hari ini." }
                                
                                div { class: "w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-3 mb-2",
                                    div { class: "bg-slate-400 h-2 rounded-full", width: "{((m.correct_answers_today as f32 / 50.0) * 100.0).min(100.0)}%" }
                                }
                                p { class: "text-[10px] font-bold text-slate-500 mb-3", "{m.correct_answers_today}/50 Benar" }
                                
                                if m.tier2_claimed {
                                    button { class: "w-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold py-1.5 rounded-lg text-xs cursor-not-allowed", disabled: true, "Diklaim" }
                                } else if m.correct_answers_today >= 50 {
                                    button {
                                        class: "w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-1.5 rounded-lg text-xs shadow-md animate-pulse cursor-pointer",
                                        onclick: {
                                            let e = user.email.clone();
                                            move |_| {
                                                let e_clone = e.clone();
                                                spawn(async move {
                                                    if let Ok(msg) = claim_mission_reward_server(e_clone, 2).await {
                                                        #[cfg(target_arch = "wasm32")]
                                                        if let Some(window) = web_sys::window() {
                                                            let _ = window.alert_with_message(&msg);
                                                            let _ = window.location().reload();
                                                        }
                                                    }
                                                });
                                            }
                                        },
                                        "Klaim 50 Koin!"
                                    }
                                } else {
                                    button { class: "w-full bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold py-1.5 rounded-lg text-xs cursor-not-allowed", disabled: true, "Terkunci" }
                                }
                            }
                            
                            // Tier 3: Peti Emas
                            div { class: format!("border {} rounded-xl p-4 flex flex-col items-center text-center relative overflow-hidden transition-all", if m.tier3_claimed { "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 opacity-70" } else { "border-yellow-300 dark:border-yellow-700 bg-gradient-to-b from-white to-yellow-50 dark:from-slate-900 dark:to-yellow-900/20" }),
                                div { class: "text-4xl mb-2 drop-shadow-xl", "🥇" }
                                h4 { class: "font-black text-yellow-600 dark:text-yellow-500 text-sm", "Peti Emas" }
                                p { class: "text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium min-h-[3rem]", "Menangkan 3 PvP Battle hari ini." }
                                
                                div { class: "w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-3 mb-2",
                                    div { class: "bg-yellow-500 h-2 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.5)]", width: "{((m.pvp_wins_today as f32 / 3.0) * 100.0).min(100.0)}%" }
                                }
                                p { class: "text-[10px] font-bold text-slate-500 mb-3", "{m.pvp_wins_today}/3 Menang" }
                                
                                if m.tier3_claimed {
                                    button { class: "w-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold py-1.5 rounded-lg text-xs cursor-not-allowed", disabled: true, "Diklaim" }
                                } else if m.pvp_wins_today >= 3 {
                                    button {
                                        class: "w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-yellow-950 font-bold py-1.5 rounded-lg text-xs shadow-lg animate-bounce cursor-pointer",
                                        onclick: {
                                            let e = user.email.clone();
                                            move |_| {
                                                let e_clone = e.clone();
                                                spawn(async move {
                                                    if let Ok(msg) = claim_mission_reward_server(e_clone, 3).await {
                                                        #[cfg(target_arch = "wasm32")]
                                                        if let Some(window) = web_sys::window() {
                                                            let _ = window.alert_with_message(&msg);
                                                            let _ = window.location().reload();
                                                        }
                                                    }
                                                });
                                            }
                                        },
                                        "Klaim 100 Koin + Bonus!"
                                    }
                                } else {
                                    button { class: "w-full bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold py-1.5 rounded-lg text-xs cursor-not-allowed", disabled: true, "Terkunci" }
                                }
                            }
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
                    
                    if let Some(pet) = active_pet.as_ref() {
                        div { class: "bg-gradient-to-br from-amber-50 to-orange-100 dark:from-slate-800 dark:to-slate-900 border border-amber-200 dark:border-slate-700 rounded-2xl p-5 hover:shadow-lg transition-all flex flex-col items-center sm:col-span-2 lg:col-span-3 text-center",
                            h3 { class: "font-black text-xl text-amber-800 dark:text-amber-400 mb-4", "Peliharaan Saya" }
                            
                            // Avatar Pet (Floating effect)
                            div { class: "w-32 h-32 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center text-6xl shadow-inner mb-2 animate-[bounce_3s_ease-in-out_infinite] cursor-pointer hover:scale-110 transition-transform drop-shadow-xl",
                                "{pet.emoji}"
                            }
                            
                            p { class: "font-bold text-lg text-slate-800 dark:text-slate-200", "{pet.label} (Lv. {pet.stage})" }
                            
                            // EXP Bar
                            div { class: "w-full max-w-xs mt-3 bg-white/60 dark:bg-slate-950/60 rounded-full h-4 overflow-hidden shadow-inner border border-amber-200/50 dark:border-slate-700 relative",
                                {
                                    let max_exp = if pet.stage == 1 { 100 } else if pet.stage == 2 { 300 } else { 1000 };
                                    let percentage = if pet.stage >= 4 { 100 } else { (pet.exp as f32 / max_exp as f32 * 100.0) as i32 };
                                    let max_exp_str = if pet.stage >= 4 { "Max".to_string() } else { max_exp.to_string() };
                                    rsx! {
                                        div {
                                            class: "h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500",
                                            style: "width: {percentage}%"
                                        }
                                        div { class: "absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-700/50", "{pet.exp}/{max_exp_str}" }
                                    }
                                }
                            }
                            
                            button {
                                class: "mt-4 bg-gradient-to-r from-orange-400 to-rose-400 hover:from-orange-500 hover:to-rose-500 text-white font-black py-3 px-8 rounded-full shadow-lg shadow-rose-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2",
                                onclick: {
                                    let id = pet.id;
                                    move |_| feed_pet(id)
                                },
                                "🍎 Beri Makan (50 Koin)"
                            }
                            if !feed_status().is_empty() {
                                p { class: "text-xs font-bold mt-2 text-rose-500 animate-pulse", "{feed_status}" }
                            }

                            button {
                                class: "mt-3 text-xs font-bold text-amber-700 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-400 bg-amber-100 dark:bg-slate-800 px-4 py-2 rounded-xl transition-colors",
                                onclick: move |_| pet_modal_open.set(true),
                                "🔄 Ganti Peliharaan"
                            }
                        }
                    }

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
                    Link { to: Route::PronunciationPractice {}, class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-teal-400 hover:shadow-md transition-all group", h3 { class: "font-bold text-teal-500 text-lg group-hover:text-teal-600 dark:text-teal-400 transition-colors", "Speech Scoring" } p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium", "Latih akurasi pronunciation." } }
                    Link { to: Route::Leaderboard {}, class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-yellow-400 hover:shadow-md transition-all group sm:col-span-2 lg:col-span-3", h3 { class: "font-bold text-yellow-500 text-lg group-hover:text-yellow-600 transition-colors", "🏆 Leaderboard" } p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium", "Lihat peringkat poin semua pengguna." } }
                }
            }
            
            // Timeline Feed
            div { class: "mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm sm:col-span-2 lg:col-span-3",
                div { class: "flex justify-between items-center mb-4",
                    h3 { class: "font-black text-xl text-slate-800 dark:text-slate-200 flex items-center gap-2", span { class: "text-2xl", "📰" } "Beranda Aktivitas Teman" }
                    button { class: "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300", onclick: move |_| social_feed_resource.restart(), "🔄 Refresh" }
                }
                
                if feed_items.is_empty() {
                    div { class: "bg-slate-50 dark:bg-slate-950 rounded-xl p-6 text-center border border-slate-100 dark:border-slate-800",
                        p { class: "text-slate-500 dark:text-slate-400 font-medium", "Belum ada aktivitas baru dari teman yang Anda ikuti." }
                        Link { to: Route::Leaderboard {}, class: "text-indigo-500 hover:underline text-sm font-bold mt-2 inline-block", "Cari teman baru di Leaderboard" }
                    }
                } else {
                    div { class: "space-y-4",
                        for item in feed_items {
                            div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex gap-4 transition-all hover:shadow-md",
                                div { class: "w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-2xl shadow-sm shrink-0 border border-slate-200 dark:border-slate-700",
                                    "{item.emoji}"
                                }
                                div { class: "flex-1 min-w-0",
                                    p { class: "font-bold text-slate-800 dark:text-slate-200", "{item.full_name}" }
                                    p { class: "text-sm text-slate-600 dark:text-slate-300 mt-0.5", "{item.content}" }
                                    p { class: "text-[10px] text-slate-400 mt-1", "{item.created_at}" }
                                }
                                div { class: "flex items-center shrink-0",
                                    button {
                                        class: format!("px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors {}", 
                                            if item.has_liked { "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400 cursor-default" } 
                                            else { "bg-slate-200 text-slate-600 hover:bg-pink-50 hover:text-pink-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" }
                                        ),
                                        disabled: item.has_liked,
                                        onclick: {
                                            let id = item.id;
                                            let e_like = email_for_like.clone();
                                            let mut sfr = social_feed_resource;
                                            move |_| {
                                                if !item.has_liked {
                                                    let e = e_like.clone();
                                                    spawn(async move {
                                                        if let Ok(_) = like_activity_server(id, e).await {
                                                            sfr.restart();
                                                        }
                                                    });
                                                }
                                            }
                                        },
                                        if item.has_liked {
                                            span { "🎉 {item.likes_count}" }
                                        } else {
                                            if item.likes_count > 0 {
                                                span { "Kasih Selamat 🎉 {item.likes_count}" }
                                            } else {
                                                span { "Kasih Selamat 🎉" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
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
                                for cat in dynamic_categories.clone() {
                                    button {
                                        class: if active_tab() == *cat {
                                            "px-3.5 py-1.5 rounded-full text-xs font-bold bg-teal-500 text-white shadow-sm transition-all cursor-pointer flex-shrink-0 whitespace-nowrap"
                                        } else {
                                            "px-3.5 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-950 hover:text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex-shrink-0 whitespace-nowrap"
                                        },
                                        onclick: move |_| active_tab.set(cat.clone()),
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
                            div { class: "text-slate-600 dark:text-slate-400 mb-6 text-sm font-medium leading-relaxed", 
                                p { "Kami siap membantu Anda menguasai bahasa baru dengan fitur-fitur terbaru kami:" }
                                br {}
                                div { class: "text-left pl-2 sm:pl-4 space-y-3 mt-4",
                                    p { "1. " span { class: "font-bold text-teal-600 dark:text-teal-400", "Roleplay Voice Chat & Speech Scoring" } ": Berlatih bicara dengan AI dan dapatkan penilaian akurasi per kata." }
                                    p { "2. " span { class: "font-bold text-amber-600 dark:text-amber-400", "Beranda Sosial" } ": Pantau pencapaian temanmu dan berikan reaksi dukungan." }
                                    p { "3. " span { class: "font-bold text-rose-600 dark:text-rose-400", "Sistem Nyawa (Hearts)" } ": Jawab kuis dengan hati-hati! Jika nyawa habis, kamu harus istirahat atau menggunakan koin." }
                                    p { "4. " span { class: "font-bold text-indigo-600 dark:text-indigo-400", "Peliharaan Virtual (Pet)" } ": Adopsi, beri makan, dan naikkan level hewan peliharaan dari poin belajarmu." }
                                }
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

            // Pet Collection Modal
            if pet_modal_open() {
                div { class: "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4",
                    div { class: "bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl relative max-h-[80vh] flex flex-col",
                        
                        button {
                            class: "absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer",
                            onclick: move |_| pet_modal_open.set(false),
                            "✕"
                        }
                        
                        h3 { class: "text-2xl font-black text-slate-800 dark:text-slate-200 mb-6 text-center flex items-center justify-center gap-2", span { class: "text-3xl", "🐾" } "Koleksi Peliharaan" }
                        
                        div { class: "flex-1 overflow-y-auto pr-2",
                            match all_pets_resource.value()() {
                                None => rsx! { div { class: "text-center py-10 text-slate-500", "Memuat koleksi..." } },
                                Some(Err(e)) => rsx! { div { class: "text-center py-10 text-rose-500", "{e}" } },
                                Some(Ok(pets)) => {
                                    if pets.is_empty() {
                                        rsx! {
                                            div { class: "text-center py-10 text-slate-500", "Anda belum memiliki peliharaan. Beli telur di Toko!" }
                                        }
                                    } else {
                                        rsx! {
                                            div { class: "grid grid-cols-2 sm:grid-cols-3 gap-4",
                                                for pet in pets {
                                                    {
                                                        let is_current = active_pet.as_ref().map(|p| p.id) == Some(pet.id);
                                                        let p_id = pet.id;
                                                        rsx! {
                                                            div { class: format!("border-2 rounded-2xl p-4 flex flex-col items-center text-center transition-all {}", if is_current { "border-amber-400 bg-amber-50 dark:bg-amber-900/20" } else { "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-amber-300" }),
                                                                div { class: "text-5xl mb-3 drop-shadow-md", "{pet.emoji}" }
                                                                p { class: "font-bold text-sm text-slate-800 dark:text-slate-200 line-clamp-1", "{pet.label}" }
                                                                p { class: "text-xs font-bold text-slate-500 mb-4", "Lv. {pet.stage} | {pet.exp} EXP" }
                                                                
                                                                if is_current {
                                                                    span { class: "text-xs font-black text-amber-600 bg-amber-200 px-3 py-1.5 rounded-lg", "Sedang Dipakai" }
                                                                } else {
                                                                    button {
                                                                        class: "text-xs font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors cursor-pointer w-full",
                                                                        onclick: {
                                                                            let email_copy = user.email.clone();
                                                                            let mut pr = pet_resource;
                                                                            let mut apr = all_pets_resource;
                                                                            let mut pmo = pet_modal_open;
                                                                            move |_| {
                                                                                let e = email_copy.clone();
                                                                                spawn(async move {
                                                                                    if let Ok(_) = set_active_pet_server(e, p_id).await {
                                                                                        pr.restart();
                                                                                        apr.restart();
                                                                                        pmo.set(false);
                                                                                    }
                                                                                });
                                                                            }
                                                                        },
                                                                        "Jadikan Utama"
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Modal Hearts Refill
        if hearts_modal_open() {
            div { class: "fixed inset-0 z-50 flex items-center justify-center p-4",
                div { class: "absolute inset-0 bg-slate-900/40 backdrop-blur-sm", onclick: move |_| hearts_modal_open.set(false) }
                div { class: "bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-sm w-full relative z-10",
                    div { class: "flex justify-between items-center mb-4",
                        h2 { class: "text-lg font-black text-slate-800 dark:text-slate-200 flex items-center gap-2", "❤️ Isi Ulang Nyawa" }
                        button { class: "text-slate-400 hover:text-slate-600", onclick: move |_| hearts_modal_open.set(false), "✕" }
                    }
                    if let Some(ref es) = engagement {
                        if es.hearts >= 5 {
                            p { class: "text-slate-600 dark:text-slate-400 text-sm mb-4 text-center", "Nyawa kamu sudah penuh! Teruslah belajar!" }
                            button {
                                class: "w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold",
                                onclick: move |_| hearts_modal_open.set(false),
                                "Tutup"
                            }
                        } else {
                            p { class: "text-slate-600 dark:text-slate-400 text-sm mb-4 text-center", "Nyawa kamu saat ini {es.hearts}/5. Kamu butuh nyawa untuk mengerjakan Kuis dan Ujian." }
                            
                            if !refill_status().is_empty() {
                                p { class: "text-sm text-center mb-3 font-medium text-rose-500", "{refill_status}" }
                            }
                            
                            div { class: "flex flex-col gap-3",
                                {
                                    let email_for_coin_refill = user.email.clone();
                                    rsx! {
                                        button {
                                            class: "w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors",
                                            onclick: move |_| {
                                                let e = email_for_coin_refill.clone();
                                                spawn(async move {
                                                    match crate::services::engagement::refill_hearts_with_coins_server(e).await {
                                                        Ok(_) => {
                                                            hearts_modal_open.set(false);
                                                        },
                                                        Err(err) => refill_status.set(err.to_string()),
                                                    }
                                                });
                                            },
                                            "🪙 Beli Full Nyawa (300 Koin)"
                                        }
                                    }
                                }
                                {
                                    let email_for_ad_refill = user.email.clone();
                                    rsx! {
                                        button {
                                            class: "w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors",
                                            onclick: move |_| {
                                                let e = email_for_ad_refill.clone();
                                                spawn(async move {
                                                    let _ = crate::services::engagement::refill_hearts_with_ad_server(e).await;
                                                    hearts_modal_open.set(false);
                                                });
                                            },
                                            "📺 Tonton Iklan (Coming Soon)"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
