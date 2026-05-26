use dioxus::prelude::*;
use crate::services::profile::{get_public_profile_server, get_user_frames_server, get_user_titles_server, get_user_colors_server, equip_frame_server, equip_title_server, equip_color_server};
use crate::views::leaderboard::{get_name_color_class, render_title_badge};
use crate::models::user::UserProfile;

#[component]
pub fn Profile(email: String) -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let mut show_gallery = use_signal(|| false);
    let mut gallery_tab = use_signal(|| "frames".to_string());
    
    let email_for_frames = email.clone();
    let mut frames_resource = use_resource(move || {
        let e = email_for_frames.clone();
        async move { get_user_frames_server(e).await }
    });
    
    let email_for_titles = email.clone();
    let mut titles_resource = use_resource(move || {
        let e = email_for_titles.clone();
        async move { get_user_titles_server(e).await }
    });
    
    let email_for_colors = email.clone();
    let mut colors_resource = use_resource(move || {
        let e = email_for_colors.clone();
        async move { get_user_colors_server(e).await }
    });
    
    let mut is_loading = use_signal(|| false);
    let email_clone = email.clone();
    
    let mut profile_resource = use_resource(move || {
        let e = email_clone.clone();
        async move { get_public_profile_server(e).await }
    });

    let content = match profile_resource.value()() {
        Some(Ok(profile)) => {
            let initial = profile.full_name.chars().next().unwrap_or('?').to_uppercase();
            
            let is_gold = profile.active_frame.as_deref() == Some("gold") || profile.active_frame.as_deref() == Some("profile_frame_gold");
            let is_diamond = profile.active_frame.as_deref() == Some("diamond") || profile.active_frame.as_deref() == Some("profile_frame_diamond");
            let is_mythic = profile.active_frame.as_deref() == Some("mythic") || profile.active_frame.as_deref() == Some("profile_frame_mythic");
            
            let frame_class = if is_mythic {
                "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 text-white border-4 border-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.7)] animate-pulse"
            } else if is_diamond {
                "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-cyan-100 text-cyan-800 border-4 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)]"
            } else if is_gold {
                "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-yellow-500 text-slate-900 border-4 border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]"
            } else {
                "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-indigo-600 text-white"
            };

            let (me_opt, _) = session_state();
            let is_my_profile = me_opt.map(|me| me.email == profile.email).unwrap_or(false);

            rsx! {
                div { class: "max-w-4xl mx-auto space-y-8",
                    // Header Card
                    div { class: "bg-white dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row items-center md:items-start gap-6",
                        div { class: "relative",
                            div { class: "{frame_class}",
                                "{initial}"
                            }
                            if is_mythic {
                                div { class: "absolute -bottom-2 -right-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-pink-400",
                                    "MYTHIC"
                                }
                            } else if is_diamond {
                                div { class: "absolute -bottom-2 -right-2 bg-cyan-400 text-cyan-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg",
                                    "DIAMOND"
                                }
                            } else if is_gold {
                                div { class: "absolute -bottom-2 -right-2 bg-yellow-500 text-slate-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg",
                                    "VIP"
                                }
                            }
                        }
                        
                        div { class: "text-center md:text-left flex-1",
                            div { class: "flex items-center gap-2 mb-2 justify-center md:justify-start flex-wrap",
                                h1 { class: "text-3xl font-bold truncate {get_name_color_class(profile.active_name_color.as_deref())}", "{profile.full_name}" }
                                {render_title_badge(profile.active_title.as_deref())}
                            }
                            p { class: "text-slate-500 dark:text-slate-400 mb-4", "{profile.email}" }
                            
                            if is_my_profile {
                                button {
                                    class: "px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold rounded-xl text-sm mb-4 cursor-pointer hover:bg-indigo-200 transition-colors flex items-center gap-2",
                                    onclick: move |_| {
                                        frames_resource.restart();
                                        titles_resource.restart();
                                        colors_resource.restart();
                                        show_gallery.set(true);
                                    },
                                    span { class: "text-lg", "🎨" }
                                    "Ganti Kosmetik"
                                }
                            }

                            div { class: "grid grid-cols-3 gap-4 text-center mt-6 border-t border-slate-200 dark:border-slate-800 pt-6",
                                div {
                                    div { class: "text-2xl font-bold text-indigo-400", "{profile.score}" }
                                    div { class: "text-sm text-slate-500", "Total Skor" }
                                }
                                div {
                                    div { class: "text-2xl font-bold text-orange-400", "{profile.current_streak} 🔥" }
                                    div { class: "text-sm text-slate-500", "Streak" }
                                }
                                div {
                                    div { class: "text-2xl font-bold text-yellow-400", "{profile.longest_streak} 👑" }
                                    div { class: "text-sm text-slate-500", "Max Streak" }
                                }
                            }
                        }
                    }

                    // Badges Section
                    div { class: "bg-white dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-8",
                        h2 { class: "text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2",
                            "🏅", " Lencana yang Diraih"
                        }
                        
                        if profile.badges.is_empty() {
                            div { class: "text-center py-8 text-slate-500",
                                "Pengguna ini belum mengumpulkan lencana apapun."
                            }
                        } else {
                            div { class: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4",
                                for badge in profile.badges {
                                    div { class: "bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                                        div { class: "text-4xl mb-2", "{badge.icon_name}" }
                                        div { class: "font-semibold text-slate-700 dark:text-slate-200 text-sm", "{badge.name}" }
                                        div { class: "text-xs text-slate-500 dark:text-slate-400 mt-1", "{badge.description}" }
                                    }
                                }
                            }
                        }
                    }
                }

                // Modal Gallery
                if show_gallery() {
                    div { class: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4",
                        div { class: "bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-xl",
                            div { class: "flex justify-between items-center mb-4",
                                h3 { class: "text-xl font-black text-slate-800 dark:text-slate-200 flex items-center gap-2", span { class: "text-2xl", "🎨" } "Galeri Kosmetik" }
                                button { class: "text-slate-400 hover:text-slate-600 cursor-pointer text-xl", onclick: move |_| show_gallery.set(false), "✕" }
                            }
                            
                            // Tabs
                            div { class: "flex gap-2 mb-4 overflow-x-auto pb-1",
                                button {
                                    class: format!("px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap {}", if gallery_tab() == "frames" { "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" } else { "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700" }),
                                    onclick: move |_| gallery_tab.set("frames".to_string()),
                                    "🖼️ Bingkai"
                                }
                                button {
                                    class: format!("px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap {}", if gallery_tab() == "titles" { "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" } else { "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700" }),
                                    onclick: move |_| gallery_tab.set("titles".to_string()),
                                    "🏅 Gelar"
                                }
                                button {
                                    class: format!("px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap {}", if gallery_tab() == "colors" { "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" } else { "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700" }),
                                    onclick: move |_| gallery_tab.set("colors".to_string()),
                                    "✨ Warna Nama"
                                }
                            }

                            div { class: "space-y-4 max-h-[50vh] overflow-y-auto",
                                if gallery_tab() == "frames" {
                                    match frames_resource.value()() {
                                        None => rsx! { div { class: "text-center py-4", "Memuat..." } },
                                        Some(Err(e)) => rsx! { div { class: "text-red-500", "{e}" } },
                                        Some(Ok(frames)) => {
                                            let mut all_frames = vec!["default".to_string()];
                                            all_frames.extend(frames);
                                            rsx! {
                                                for frame in all_frames {
                                                    {
                                                        let f = frame.clone();
                                                        let f_name = match f.as_str() {
                                                            "gold" => "VIP Gold",
                                                            "diamond" => "Diamond 💎",
                                                            "mythic" => "Mythic 🌌",
                                                            _ => "Bawaan (Default)",
                                                        };
                                                        let is_active = (f == "default" && profile.active_frame.is_none()) || (Some(&f) == profile.active_frame.as_ref());
                                                        let email_for_equip = profile.email.clone();
                                                        rsx! {
                                                            div { class: format!("flex items-center justify-between p-4 rounded-xl border {}", if is_active { "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" } else { "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950" }),
                                                                span { class: "font-bold text-slate-800 dark:text-slate-200", "{f_name}" }
                                                                if is_active {
                                                                    span { class: "text-indigo-600 font-bold text-sm", "Dipakai" }
                                                                } else {
                                                                    button {
                                                                        class: "px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50",
                                                                        disabled: is_loading(),
                                                                        onclick: move |_| {
                                                                            let target_f = if f == "default" { "".to_string() } else { f.clone() };
                                                                            let u = email_for_equip.clone();
                                                                            is_loading.set(true);
                                                                            spawn(async move {
                                                                                if let Ok(_) = equip_frame_server(u, target_f).await {
                                                                                    profile_resource.restart();
                                                                                }
                                                                                is_loading.set(false);
                                                                            });
                                                                        },
                                                                        "Pakai"
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } else if gallery_tab() == "titles" {
                                    match titles_resource.value()() {
                                        None => rsx! { div { class: "text-center py-4", "Memuat..." } },
                                        Some(Err(e)) => rsx! { div { class: "text-red-500", "{e}" } },
                                        Some(Ok(titles)) => {
                                            let mut all_titles = vec!["default".to_string()];
                                            all_titles.extend(titles);
                                            rsx! {
                                                for title in all_titles {
                                                    {
                                                        let t = title.clone();
                                                        let is_active = (t == "default" && profile.active_title.is_none()) || (Some(&t) == profile.active_title.as_ref());
                                                        let email_for_equip = profile.email.clone();
                                                        let title_badge_element = crate::views::leaderboard::render_title_badge(Some(&t));
                                                        rsx! {
                                                            div { class: format!("flex items-center justify-between p-4 rounded-xl border {}", if is_active { "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" } else { "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950" }),
                                                                div { class: "flex items-center gap-2",
                                                                    if t == "default" {
                                                                        span { class: "font-bold text-slate-800 dark:text-slate-200", "Tanpa Gelar" }
                                                                    } else {
                                                                        span { class: "font-bold text-slate-800 dark:text-slate-200", "Gelar:" }
                                                                        {title_badge_element}
                                                                    }
                                                                }
                                                                if is_active {
                                                                    span { class: "text-indigo-600 font-bold text-sm", "Dipakai" }
                                                                } else {
                                                                    button {
                                                                        class: "px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50",
                                                                        disabled: is_loading(),
                                                                        onclick: move |_| {
                                                                            let target_t = if t == "default" { "".to_string() } else { t.clone() };
                                                                            let u = email_for_equip.clone();
                                                                            is_loading.set(true);
                                                                            spawn(async move {
                                                                                if let Ok(_) = equip_title_server(u, target_t).await {
                                                                                    profile_resource.restart();
                                                                                }
                                                                                is_loading.set(false);
                                                                            });
                                                                        },
                                                                        "Pakai"
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } else if gallery_tab() == "colors" {
                                    match colors_resource.value()() {
                                        None => rsx! { div { class: "text-center py-4", "Memuat..." } },
                                        Some(Err(e)) => rsx! { div { class: "text-red-500", "{e}" } },
                                        Some(Ok(colors)) => {
                                            let mut all_colors = vec!["default".to_string()];
                                            all_colors.extend(colors);
                                            rsx! {
                                                for color in all_colors {
                                                    {
                                                        let c = color.clone();
                                                        let is_active = (c == "default" && profile.active_name_color.is_none()) || (Some(&c) == profile.active_name_color.as_ref());
                                                        let email_for_equip = profile.email.clone();
                                                        let color_class_str = crate::views::leaderboard::get_name_color_class(if c == "default" { None } else { Some(&c) });
                                                        rsx! {
                                                            div { class: format!("flex items-center justify-between p-4 rounded-xl border {}", if is_active { "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" } else { "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950" }),
                                                                div { class: "flex items-center gap-2",
                                                                    span { class: "font-bold text-slate-800 dark:text-slate-200", "Warna:" }
                                                                    span { class: "text-lg {color_class_str}", "Contoh Nama" }
                                                                }
                                                                if is_active {
                                                                    span { class: "text-indigo-600 font-bold text-sm", "Dipakai" }
                                                                } else {
                                                                    button {
                                                                        class: "px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50",
                                                                        disabled: is_loading(),
                                                                        onclick: move |_| {
                                                                            let target_c = if c == "default" { "".to_string() } else { c.clone() };
                                                                            let u = email_for_equip.clone();
                                                                            is_loading.set(true);
                                                                            spawn(async move {
                                                                                if let Ok(_) = equip_color_server(u, target_c).await {
                                                                                    profile_resource.restart();
                                                                                }
                                                                                is_loading.set(false);
                                                                            });
                                                                        },
                                                                        "Pakai"
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
        },
        Some(Err(e)) => rsx! {
            div { class: "text-center text-red-400 py-12", "Gagal memuat profil: {e.to_string()}" }
        },
        None => rsx! {
            div { class: "flex justify-center py-12",
                div { class: "animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" }
            }
        }
    };

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-300 pt-24 pb-12 px-4 sm:px-6",
            {content}
        }
    }
}
