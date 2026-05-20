use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::routes::Route;

#[component]
pub fn Navbar() -> Element {
    let mut session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let navigator = use_navigator();
    let (user_opt, _is_ready) = session_state();
    let mut mobile_menu_open = use_signal(|| false);

    let handle_logout = move |_| {
        session_state.set((None, true));
        mobile_menu_open.set(false);
        navigator.push(Route::Login {});
    };

    rsx! {
        header { class: "fixed top-0 inset-x-0 z-50 border-b border-slate-800/90 bg-slate-900/95 backdrop-blur",
            div { class: "max-w-6xl mx-auto px-4 sm:px-6",
                div { class: "h-16 flex items-center justify-between gap-3",
                    Link {
                        to: Route::Dashboard {},
                        class: "text-lg sm:text-xl font-black tracking-wide text-teal-400 hover:text-teal-300 transition-colors",
                        "LingoMind"
                    }

                    if let Some(user) = user_opt.as_ref() {
                        div { class: "hidden sm:flex items-center gap-3",
                            div { class: "px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs font-mono text-amber-300", "{user.score} pts" }
                            div { class: "max-w-[180px] truncate text-sm font-semibold text-slate-200", "{user.username}" }
                            button {
                                r#type: "button",
                                class: "px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-slate-300 hover:text-rose-300 hover:border-rose-500/40 hover:bg-rose-500/10 transition-colors",
                                onclick: handle_logout,
                                "Log Out"
                            }
                        }
                    } else {
                        div { class: "hidden sm:flex items-center gap-3 text-sm",
                            Link { to: Route::Login {}, class: "text-slate-400 hover:text-white transition-colors font-semibold", "Sign In" }
                            Link { to: Route::Register {}, class: "bg-teal-500 hover:bg-teal-600 text-slate-950 px-3 py-1.5 rounded-lg transition-colors font-bold", "Get Started" }
                        }
                    }

                    button {
                        r#type: "button",
                        class: "sm:hidden px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200",
                        onclick: move |_| mobile_menu_open.set(!mobile_menu_open()),
                        if mobile_menu_open() { "Close" } else { "Menu" }
                    }
                }

                if mobile_menu_open() {
                    div { class: "sm:hidden pb-3",
                        if let Some(user) = user_opt.as_ref() {
                            div { class: "rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3",
                                div { class: "flex items-center justify-between gap-2",
                                    div { class: "min-w-0",
                                        p { class: "text-sm font-semibold text-slate-200 truncate", "{user.username}" }
                                        p { class: "text-xs text-amber-300 font-mono", "{user.score} pts" }
                                    }
                                }
                                button {
                                    r#type: "button",
                                    class: "w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-sm font-bold text-slate-200 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/40 transition-colors",
                                    onclick: handle_logout,
                                    "Log Out"
                                }
                            }
                        } else {
                            div { class: "rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2",
                                Link {
                                    to: Route::Login {},
                                    class: "block w-full text-center px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-200",
                                    onclick: move |_| mobile_menu_open.set(false),
                                    "Sign In"
                                }
                                Link {
                                    to: Route::Register {},
                                    class: "block w-full text-center px-3 py-2 rounded-lg bg-teal-500 text-slate-950 text-sm font-bold",
                                    onclick: move |_| mobile_menu_open.set(false),
                                    "Get Started"
                                }
                            }
                        }
                    }
                }
            }
        }

        main { class: "pt-16 min-h-screen bg-slate-950",
            Outlet::<Route> {}
        }
    }
}
