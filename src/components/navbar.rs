use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::routes::Route;

#[component]
pub fn Navbar() -> Element {
    let mut session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let mut is_dark_mode = use_context::<Signal<bool>>();
    let navigator = use_navigator();
    let (user_opt, _is_ready) = session_state();
    let current_route = use_route::<Route>();
    
    // State for mobile drawer
    let mut is_drawer_open = use_signal(|| false);

    let toggle_theme = move |_| {
        is_dark_mode.set(!is_dark_mode());
    };

    let handle_logout = move |_| {
        session_state.set((None, true));
        is_drawer_open.set(false); // Close drawer if open
        navigator.push(Route::Login {});
    };

    let is_home = matches!(current_route, Route::Dashboard {});
    let is_roadmap = matches!(current_route, Route::Roadmap {});
    let is_leaderboard = matches!(current_route, Route::Leaderboard {});
    let is_analytics = matches!(current_route, Route::WeaknessAnalytics {});
    let is_guide = matches!(current_route, Route::Guide {});
    let is_shop = matches!(current_route, Route::Shop {});

    let tab_class_desktop = |active: bool| -> &'static str {
        if active {
            "text-teal-600 dark:text-teal-400 font-bold transition-colors"
        } else {
            "text-slate-600/50 dark:text-slate-400 hover:text-teal-600 dark:text-teal-400 font-bold transition-colors"
        }
    };
    
    let drawer_link_class = |active: bool| -> &'static str {
        if active {
            "flex items-center gap-4 px-4 py-3 rounded-2xl bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 font-bold"
        } else {
            "flex items-center gap-4 px-4 py-3 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-teal-600 dark:hover:text-teal-400 font-semibold transition-colors"
        }
    };

    rsx! {
        header { class: "fixed top-0 inset-x-0 z-40 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-sm",
            div { class: "max-w-6xl mx-auto px-4 sm:px-6",
                div { class: "h-16 flex items-center justify-between gap-3",
                    Link {
                        to: Route::Dashboard {},
                        class: "flex items-center gap-2 hover:opacity-90 transition-opacity",
                        img {
                            src: asset!("/assets/logo.png"),
                            alt: "LingoMind Logo",
                            class: "w-8 h-8 rounded-xl shadow-sm object-cover border border-slate-100 dark:border-slate-800",
                        }
                        span {
                            class: "text-xl font-black tracking-wider bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent",
                            "LingoMind"
                        }
                    }

                    if let Some(user) = user_opt.as_ref() {
                        // Desktop Nav
                        div { class: "hidden sm:flex items-center gap-4",
                            Link { 
                                to: Route::Roadmap {}, 
                                class: tab_class_desktop(is_roadmap),
                                "Kurikulum" 
                            }
                            Link { 
                                to: Route::Leaderboard {}, 
                                class: tab_class_desktop(is_leaderboard),
                                "Leaderboard" 
                            }
                            Link { 
                                to: Route::WeaknessAnalytics {}, 
                                class: tab_class_desktop(is_analytics),
                                "Analisis" 
                            }
                            Link { 
                                to: Route::Guide {}, 
                                class: tab_class_desktop(is_guide),
                                "Panduan" 
                            }
                            Link { 
                                to: Route::Shop {}, 
                                class: tab_class_desktop(is_shop),
                                "Toko" 
                            }
                            div { class: "px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/30 text-xs font-black text-amber-700 shadow-sm flex items-center gap-1", 
                                span { "🔥" }
                                span { "{user.score} pts" }
                            }
                            Link {
                                to: Route::Profile { email: user.email.clone() },
                                class: "max-w-[180px] truncate text-sm font-bold text-slate-700/80 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors",
                                "{user.full_name}"
                            }
                            button {
                                class: "p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors shadow-sm cursor-pointer text-sm",
                                onclick: toggle_theme,
                                if is_dark_mode() { "☀️\u{FE0F}" } else { "🌙\u{FE0F}" }
                            }
                            button {
                                r#type: "button",
                                class: "px-3.5 py-1.5 rounded-xl border border-slate-200/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:text-rose-400 hover:border-rose-200 hover:bg-rose-50/30 dark:bg-rose-900/30 transition-all cursor-pointer",
                                onclick: handle_logout,
                                "Log Out"
                            }
                        }
                        // Mobile Nav Header
                        div { class: "sm:hidden flex items-center gap-3",
                            button {
                                class: "p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer",
                                onclick: move |_| is_drawer_open.set(true),
                                span { class: "text-xl leading-none", "☰" }
                            }
                        }
                    } else {
                        div { class: "flex items-center gap-3 text-sm",
                            Link { to: Route::Login {}, class: "text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:text-teal-400 transition-colors font-bold", "Sign In" }
                            Link { to: Route::Register {}, class: "bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl transition-all font-black shadow-md shadow-teal-600/10", "Get Started" }
                        }
                    }
                }
            }
        }

        // Mobile Drawer Overlay
        if is_drawer_open() && user_opt.is_some() {
            div { class: "sm:hidden fixed inset-0 z-50 overflow-hidden",
                // Dark Backdrop
                div { 
                    class: "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity opacity-100",
                    onclick: move |_| is_drawer_open.set(false)
                }
                
                // Drawer Panel
                div { 
                    class: "absolute inset-y-0 right-0 w-72 bg-white dark:bg-slate-900 shadow-2xl flex flex-col transform transition-transform translate-x-0 duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800",
                    
                    // User Header in Drawer
                    div { class: "p-5 border-b border-slate-100 dark:border-slate-800",
                        div { class: "flex justify-between items-start mb-4",
                            if let Some(user) = user_opt.as_ref() {
                                div { class: "flex flex-col gap-1.5",
                                    span { class: "font-black text-lg text-slate-800 dark:text-slate-200 truncate", "{user.full_name}" }
                                    div { class: "inline-flex px-3 py-1 rounded-full border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/30 text-xs font-black text-amber-700 self-start shadow-sm items-center gap-1",
                                        span { "🔥" }
                                        span { "{user.score} pts" }
                                    }
                                }
                            }
                            button {
                                class: "p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer",
                                onclick: move |_| is_drawer_open.set(false),
                                span { class: "text-lg leading-none font-bold", "✕" }
                            }
                        }
                    }
                    
                    // Links
                    div { class: "flex-1 overflow-y-auto py-4 px-3 space-y-1",
                        Link {
                            to: Route::Dashboard {},
                            onclick: move |_| is_drawer_open.set(false),
                            class: drawer_link_class(is_home),
                            span { class: "text-xl w-6 text-center", "🏠" }
                            span { "Home" }
                        }
                        Link {
                            to: Route::Roadmap {},
                            onclick: move |_| is_drawer_open.set(false),
                            class: drawer_link_class(is_roadmap),
                            span { class: "text-xl w-6 text-center", "🗺️" }
                            span { "Belajar" }
                        }
                        Link {
                            to: Route::Leaderboard {},
                            onclick: move |_| is_drawer_open.set(false),
                            class: drawer_link_class(is_leaderboard),
                            span { class: "text-xl w-6 text-center", "🏆" }
                            span { "Peringkat" }
                        }
                        Link {
                            to: Route::WeaknessAnalytics {},
                            onclick: move |_| is_drawer_open.set(false),
                            class: drawer_link_class(is_analytics),
                            span { class: "text-xl w-6 text-center", "📊" }
                            span { "Analisis" }
                        }
                        Link {
                            to: Route::Guide {},
                            onclick: move |_| is_drawer_open.set(false),
                            class: drawer_link_class(is_guide),
                            span { class: "text-xl w-6 text-center", "📖" }
                            span { "Panduan" }
                        }
                        Link {
                            to: Route::Shop {},
                            onclick: move |_| is_drawer_open.set(false),
                            class: drawer_link_class(is_shop),
                            span { class: "text-xl w-6 text-center", "🛒" }
                            span { "Toko" }
                        }
                        
                        if let Some(user) = user_opt.as_ref() {
                            Link {
                                to: Route::Profile { email: user.email.clone() },
                                onclick: move |_| is_drawer_open.set(false),
                                class: drawer_link_class(false),
                                span { class: "text-xl w-6 text-center", "👤" }
                                span { "Profil" }
                            }
                        }
                    }
                    
                    // Footer Actions
                    div { class: "p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50",
                        button {
                            class: "w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm",
                            onclick: toggle_theme,
                            if is_dark_mode() { "☀️ Mode Terang" } else { "🌙 Mode Gelap" }
                        }
                        button {
                            class: "w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors",
                            onclick: handle_logout,
                            span { class: "text-lg", "🚪" }
                            "Log Out"
                        }
                    }
                }
            }
        }

        main { class: "pt-16 pb-6 min-h-screen bg-slate-50 dark:bg-slate-950",
            Outlet::<Route> {}
        }
    }
}
