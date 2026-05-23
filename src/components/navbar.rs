use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::routes::Route;

#[component]
pub fn Navbar() -> Element {
    let mut session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let navigator = use_navigator();
    let (user_opt, _is_ready) = session_state();
    let current_route = use_route::<Route>();

    let handle_logout = move |_| {
        session_state.set((None, true));
        navigator.push(Route::Login {});
    };

    let is_home = matches!(current_route, Route::Dashboard {});
    let is_roadmap = matches!(current_route, Route::Roadmap {});
    let is_leaderboard = matches!(current_route, Route::Leaderboard {});
    let is_analytics = matches!(current_route, Route::WeaknessAnalytics {});

    let tab_class = |active: bool| -> &'static str {
        if active {
            "flex flex-col items-center gap-0.5 text-teal-600 bg-teal-50/60 px-4 py-1.5 rounded-2xl transition-all duration-200 font-black text-xs scale-105 flex-1"
        } else {
            "flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-all py-1.5 rounded-2xl flex-1 text-xs font-semibold"
        }
    };

    rsx! {
        header { class: "fixed top-0 inset-x-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur shadow-sm",
            div { class: "max-w-6xl mx-auto px-4 sm:px-6",
                div { class: "h-16 flex items-center justify-between gap-3",
                    Link {
                        to: Route::Dashboard {},
                        class: "flex items-center gap-2 hover:opacity-90 transition-opacity",
                        img {
                            src: asset!("/assets/logo.png"),
                            alt: "LingoMind Logo",
                            class: "w-8 h-8 rounded-xl shadow-sm object-cover border border-slate-100",
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
                                class: format_args!("text-sm font-bold transition-colors {}", if is_roadmap { "text-teal-600" } else { "text-slate-600 hover:text-teal-600" }),
                                "Kurikulum" 
                            }
                            Link { 
                                to: Route::Leaderboard {}, 
                                class: format_args!("text-sm font-bold transition-colors {}", if is_leaderboard { "text-teal-600" } else { "text-slate-600 hover:text-teal-600" }),
                                "Leaderboard" 
                            }
                            Link { 
                                to: Route::WeaknessAnalytics {}, 
                                class: format_args!("text-sm font-bold transition-colors {}", if is_analytics { "text-teal-600" } else { "text-slate-600 hover:text-teal-600" }),
                                "Analisis" 
                            }
                            div { class: "px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-xs font-black text-amber-700 shadow-sm flex items-center gap-1", 
                                span { "🔥" }
                                span { "{user.score} pts" }
                            }
                            div { class: "max-w-[180px] truncate text-sm font-bold text-slate-700", "{user.full_name}" }
                            button {
                                r#type: "button",
                                class: "px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all cursor-pointer",
                                onclick: handle_logout,
                                "Log Out"
                            }
                        }
                        // Mobile score display
                        div { class: "sm:hidden flex items-center gap-2",
                            div { class: "px-3 py-1 rounded-full border border-amber-200 bg-amber-50 text-xs font-black text-amber-700 flex items-center gap-1 shadow-sm",
                                span { "🔥" }
                                span { "{user.score} pts" }
                            }
                        }
                    } else {
                        div { class: "flex items-center gap-3 text-sm",
                            Link { to: Route::Login {}, class: "text-slate-600 hover:text-teal-600 transition-colors font-bold", "Sign In" }
                            Link { to: Route::Register {}, class: "bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl transition-all font-black shadow-md shadow-teal-600/10", "Get Started" }
                        }
                    }
                }
            }
        }

        // Mobile Bottom Tab Navigation
        if user_opt.is_some() {
            nav { class: "sm:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200/80 z-50 px-4 py-2 shadow-2xl flex justify-between items-center safe-bottom",
                Link {
                    to: Route::Dashboard {},
                    class: tab_class(is_home),
                    span { class: "text-xl", "🏠" }
                    span { "Home" }
                }
                Link {
                    to: Route::Roadmap {},
                    class: tab_class(is_roadmap),
                    span { class: "text-xl", "🗺️" }
                    span { "Belajar" }
                }
                Link {
                    to: Route::Leaderboard {},
                    class: tab_class(is_leaderboard),
                    span { class: "text-xl", "🏆" }
                    span { "Peringkat" }
                }
                Link {
                    to: Route::WeaknessAnalytics {},
                    class: tab_class(is_analytics),
                    span { class: "text-xl", "📊" }
                    span { "Analisis" }
                }
                button {
                    class: "flex flex-col items-center gap-0.5 text-slate-400 hover:text-rose-600 transition-all py-1.5 rounded-2xl flex-1 text-xs font-semibold cursor-pointer",
                    onclick: handle_logout,
                    span { class: "text-xl", "🚪" }
                    span { "Keluar" }
                }
            }
        }

        main { class: "pt-16 pb-20 sm:pb-0 min-h-screen bg-slate-50",
            Outlet::<Route> {}
        }
    }
}
