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
        div { class: "min-h-screen bg-slate-50 flex font-sans text-slate-800",
            // Sidebar
            div { class: "w-64 bg-white text-slate-800 flex flex-col shadow-lg border-r border-slate-200",
                div { class: "p-6 border-b border-slate-200",
                    h1 { class: "text-xl font-bold flex items-center gap-2 text-blue-600", "🛠️ LingoAdmin" }
                    p { class: "text-slate-500 text-xs mt-1 font-medium", "Control Panel" }
                }
                div { class: "p-4 flex-1 space-y-2",
                    for (tab_name, icon, tab_path) in tabs {
                        button {
                            class: if tab == tab_path {
                                "w-full text-left px-4 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold transition-colors flex items-center gap-3 border border-blue-100 shadow-sm"
                            } else {
                                "w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl transition-colors flex items-center gap-3 font-medium"
                            },
                            onclick: move |_| { navigator.push(Route::AdminDashboard { tab: tab_path.to_string() }); },
                            i { class: "{icon} w-5 text-center" }
                            "{tab_name}"
                        }
                    }
                }
                div { class: "p-4 border-t border-slate-200 text-center",
                    p { class: "text-xs text-slate-400 font-medium", "LingoMind v1.0.0" }
                }
            }

            // Main Content
            div { class: "flex-1 overflow-y-auto",
                div { class: "bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm",
                    h2 { class: "text-xl font-bold text-slate-800", "{active_tab_name}" }
                    div { class: "relative",
                        button {
                            class: "flex items-center gap-3 hover:bg-slate-50 p-2 rounded-xl transition-colors focus:outline-none border border-slate-200 shadow-sm bg-white",
                            onclick: move |_| *is_dropdown_open.write() = !is_dropdown_open(),
                            div { class: "w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold",
                                "A"
                            }
                            span { class: "text-sm font-medium text-slate-600", "{email}" }
                            i { 
                                class: if is_dropdown_open() {
                                    "fa-solid fa-chevron-down text-slate-400 text-xs transition-transform duration-200 rotate-180"
                                } else {
                                    "fa-solid fa-chevron-down text-slate-400 text-xs transition-transform duration-200"
                                }
                            }
                        }
                        
                        if is_dropdown_open() {
                            div { class: "absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 origin-top-right",
                                // Dropdown Header
                                div { class: "px-4 py-2 border-b border-slate-100",
                                    p { class: "text-xs text-slate-400 font-semibold uppercase tracking-wider", "Administrator" }
                                    p { class: "text-sm font-medium text-slate-700 truncate", "{email}" }
                                }
                                // Dropdown Links
                                Link {
                                    to: Route::Dashboard {},
                                    class: "flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors",
                                    i { class: "fa-solid fa-house text-slate-400 w-5 text-center" }
                                    "Kembali ke App"
                                }
                                button {
                                    class: "w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors text-left",
                                    onclick: move |_| {
                                        user_state.set((None, true));
                                        navigator.push(Route::AdminLogin {});
                                    },
                                    i { class: "fa-solid fa-right-from-bracket text-red-400 w-5 text-center" }
                                    "Logout"
                                }
                            }
                        }
                    }
                }
                
                div { class: "p-8",
                    match tab.as_str() {
                        "konfigurasi" => rsx! { ConfigPanel { email: email.clone() } },
                        "toko" => rsx! { ShopPanel { email: email.clone() } },
                        "bahasa" => rsx! { LanguagePanel { email: email.clone() } },
                        "kurikulum" => rsx! { CurriculumPanel { email: email.clone() } },
                        "pengguna" => rsx! { UserPanel { email: email.clone() } },
                        _ => rsx! { div { "Tab tidak ditemukan." } }
                    }
                }
            }
        }
    }
}
