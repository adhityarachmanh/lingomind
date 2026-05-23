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
        header { class: "fixed top-0 inset-x-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur",
            div { class: "max-w-6xl mx-auto px-4 sm:px-6",
                div { class: "h-16 flex items-center justify-between gap-3",
                    Link {
                        to: Route::Dashboard {},
                        class: "text-lg sm:text-xl font-black tracking-wide text-teal-600 hover:text-teal-700 transition-colors",
                        "LingoMind"
                    }

                    if let Some(user) = user_opt.as_ref() {
                        div { class: "hidden sm:flex items-center gap-4",
                            Link { to: Route::Roadmap {}, class: "text-sm font-bold text-slate-600 hover:text-teal-600 transition-colors", "Kurikulum" }
                            div { class: "px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-xs font-mono text-amber-700", "{user.score} pts" }
                            div { class: "max-w-[220px] truncate text-sm font-semibold text-slate-800", "{user.full_name}" }
                            button {
                                r#type: "button",
                                class: "px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors",
                                onclick: handle_logout,
                                "Log Out"
                            }
                        }
                    } else {
                        div { class: "hidden sm:flex items-center gap-3 text-sm",
                            Link { to: Route::Login {}, class: "text-slate-600 hover:text-teal-600 transition-colors font-semibold", "Sign In" }
                            Link { to: Route::Register {}, class: "bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg transition-colors font-bold", "Get Started" }
                        }
                    }

                    button {
                        r#type: "button",
                        class: "sm:hidden px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors",
                        onclick: move |_| mobile_menu_open.set(!mobile_menu_open()),
                        if mobile_menu_open() { "Close" } else { "Menu" }
                    }
                }

                if mobile_menu_open() {
                    div { class: "sm:hidden pb-3",
                        if let Some(user) = user_opt.as_ref() {
                            div { class: "rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3",
                                div { class: "flex items-center justify-between gap-2",
                                    div { class: "min-w-0",
                                        p { class: "text-sm font-semibold text-slate-800 truncate", "{user.full_name}" }
                                        p { class: "text-xs text-amber-700 font-mono", "{user.score} pts" }
                                    }
                                }
                                Link {
                                    to: Route::Roadmap {},
                                    class: "w-full block text-center px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-600 transition-colors",
                                    onclick: move |_| mobile_menu_open.set(false),
                                    "Kurikulum"
                                }
                                button {
                                    r#type: "button",
                                    class: "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors",
                                    onclick: handle_logout,
                                    "Log Out"
                                }
                            }
                        } else {
                            div { class: "rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2",
                                Link {
                                    to: Route::Login {},
                                    class: "block w-full text-center px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50",
                                    onclick: move |_| mobile_menu_open.set(false),
                                    "Sign In"
                                }
                                Link {
                                    to: Route::Register {},
                                    class: "block w-full text-center px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors",
                                    onclick: move |_| mobile_menu_open.set(false),
                                    "Get Started"
                                }
                            }
                        }
                    }
                }
            }
        }

        main { class: "pt-16 min-h-screen bg-slate-50",
            Outlet::<Route> {}
        }
    }
}
