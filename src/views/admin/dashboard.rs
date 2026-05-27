use dioxus::prelude::*;
use crate::routes::Route;
use crate::models::user::UserProfile;
use crate::views::admin::config_panel::ConfigPanel;
use crate::views::admin::shop_panel::ShopPanel;
use crate::views::admin::language_panel::LanguagePanel;
use crate::views::admin::curriculum_panel::CurriculumPanel;
use crate::views::admin::user_panel::UserPanel;

#[component]
pub fn AdminDashboard(tab: String) -> Element {
    let mut user_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let navigator = use_navigator();
    let mut is_dropdown_open = use_signal(|| false);

    // Proteksi rute admin
    use_effect(move || {
        let (user_opt, is_initialized) = user_state();
        if is_initialized {
            if let Some(user) = user_opt {
                if user.role != "admin" {
                    // Bukan admin, kembalikan ke app utama
                    navigator.push(Route::Dashboard {});
                }
            } else {
                // Belum login, arahkan ke halaman login admin
                navigator.push(Route::AdminLogin {});
            }
        }
    });

    let (user_opt, _) = user_state();
    let email = user_opt.map(|u| u.email).unwrap_or_default();


    let tabs = vec![
        ("Konfigurasi", "fa-solid fa-sliders", "konfigurasi"),
        ("Toko", "fa-solid fa-store", "toko"),
        ("Bahasa", "fa-solid fa-language", "bahasa"),
        ("Kurikulum", "fa-solid fa-book", "kurikulum"),
        ("Pengguna", "fa-solid fa-users", "pengguna"),
    ];
    
    let active_tab_name = tabs.iter()
        .find(|&&(_, _, t)| t == tab)
        .map(|&(n, _, _)| n)
        .unwrap_or("Konfigurasi");

    rsx! {
        div { class: "h-screen bg-slate-50 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 overflow-hidden transition-colors duration-300",
            // Enterprise Light Sidebar
            div { class: "w-64 flex-shrink-0 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex flex-col border-r border-slate-200 dark:border-slate-800 shadow-lg z-20 transition-colors duration-300",
                div { class: "p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50",
                    div { class: "flex items-center gap-3",
                        img {
                            src: asset!("/assets/logo.png"),
                            alt: "LingoMind Logo",
                            class: "w-8 h-8 rounded-lg object-cover shadow-sm border border-slate-200 dark:border-slate-700",
                        }
                        div {
                            h1 { class: "text-lg font-extrabold text-indigo-700 dark:text-white tracking-tight",
                                "LingoAdmin"
                            }
                            p { class: "text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest",
                                "Enterprise"
                            }
                        }
                    }
                }
                div { class: "p-4 flex-1 space-y-1.5 overflow-y-auto",
                    for (tab_name, icon, tab_path) in tabs {
                        button {
                            class: if tab == tab_path { "w-full text-left px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold transition-colors flex items-center gap-3 border border-indigo-100 dark:border-indigo-500/20 shadow-sm" } else { "w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-slate-200 rounded-xl transition-colors flex items-center gap-3 font-medium" },
                            onclick: move |_| {
                                navigator
                                    .push(Route::AdminDashboard {
                                        tab: tab_path.to_string(),
                                    });
                            },
                            i { class: "{icon} w-5 text-center text-lg" }
                            "{tab_name}"
                        }
                    }
                }
                div { class: "p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 text-center",
                    p { class: "text-xs text-slate-400 dark:text-slate-500 font-medium",
                        "LingoMind v1.0.0"
                    }
                }
            }

            // Main Content Wrapper
            div { class: "flex-1 flex flex-col h-full overflow-hidden relative",
                // Fixed Navbar
                div { class: "bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-4 flex justify-between items-center flex-shrink-0 z-10 shadow-sm transition-colors duration-300",
                    div { class: "flex items-center gap-4",
                        h2 { class: "text-xl font-extrabold text-slate-800 dark:text-slate-100",
                            "{active_tab_name}"
                        }
                    }
                    div { class: "relative",
                        button {
                            class: "flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 pr-3 rounded-xl transition-all focus:outline-none border border-transparent hover:border-slate-200 dark:hover:border-slate-700 bg-transparent group",
                            onclick: move |_| *is_dropdown_open.write() = !is_dropdown_open(),
                            div { class: "w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-700 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold shadow-inner",
                                "A"
                            }
                            span { class: "text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors",
                                "{email}"
                            }
                            i { class: if is_dropdown_open() { "fa-solid fa-chevron-down text-slate-400 text-xs transition-transform duration-200 rotate-180" } else { "fa-solid fa-chevron-down text-slate-400 text-xs transition-transform duration-200" } }
                        }

                        if is_dropdown_open() {
                            div { class: "absolute right-0 mt-3 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-50 origin-top-right transition-colors duration-300",
                                // Dropdown Header
                                div { class: "px-4 py-3 border-b border-slate-100 dark:border-slate-800",
                                    p { class: "text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1",
                                        "Administrator"
                                    }
                                    p { class: "text-sm font-semibold text-slate-700 dark:text-slate-200 truncate",
                                        "{email}"
                                    }
                                }
                                // Dropdown Links
                                div { class: "p-2",
                                    Link {
                                        to: Route::Dashboard {},
                                        class: "flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors",
                                        i { class: "fa-solid fa-house w-5 text-center" }
                                        "Aplikasi Utama"
                                    }
                                    button {
                                        class: "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors text-left mt-1",
                                        onclick: move |_| {
                                            user_state.set((None, true));
                                            navigator.push(Route::AdminLogin {});
                                        },
                                        i { class: "fa-solid fa-right-from-bracket w-5 text-center" }
                                        "Logout"
                                    }
                                }
                            }
                        }
                    }
                }

                // Scrollable Content Area
                div { class: "flex-1 overflow-y-auto p-6 lg:p-10",
                    div { class: "max-w-7xl mx-auto",
                        match tab.as_str() {
                            "konfigurasi" => rsx! {
                                ConfigPanel { email: email.clone() }
                            },
                            "toko" => rsx! {
                                ShopPanel { email: email.clone() }
                            },
                            "bahasa" => rsx! {
                                LanguagePanel { email: email.clone() }
                            },
                            "kurikulum" => rsx! {
                                CurriculumPanel { email: email.clone() }
                            },
                            "pengguna" => rsx! {
                                UserPanel { email: email.clone() }
                            },
                            _ => rsx! {
                                div { "Tab tidak ditemukan." }
                            },
                        }
                    }
                }
            }
        }
    }
}
