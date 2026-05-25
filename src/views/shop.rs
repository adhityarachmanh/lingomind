use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::services::shop::{get_shop_items_server, buy_shop_item_server};
use crate::services::engagement::get_engagement_stats_server;

#[component]
pub fn Shop() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let mut buy_status = use_signal(String::new);
    let mut is_loading = use_signal(|| false);

    let (user_opt, is_session_ready) = session_state();

    if !is_session_ready {
        return rsx! { div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 flex justify-center items-center", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    }
    if user_opt.is_none() {
        return rsx! { div { class: "min-h-screen bg-slate-50 flex justify-center items-center p-8", "Harap login." } };
    }

    let user = user_opt.unwrap();
    let email = user.email.clone();
    
    let mut shop_items_resource = use_resource(move || {
        async move { get_shop_items_server().await }
    });
    
    let mut engagement_resource = use_resource(move || {
        let u = email.clone();
        async move { get_engagement_stats_server(u).await }
    });

    let items = shop_items_resource.value()().and_then(|r| r.ok()).unwrap_or_default();
    let engagement = engagement_resource.value()().and_then(|r| r.ok());

    let coins = engagement.as_ref().map(|e| e.coins).unwrap_or(0);
    
    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-4 sm:p-8 font-sans pb-24",
            div { class: "max-w-4xl mx-auto space-y-6",
                
                // Header
                div { class: "relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl p-6 sm:p-10 shadow-xl text-white",
                    div { class: "relative z-10 flex flex-col sm:flex-row justify-between items-center gap-4",
                        div {
                            h1 { class: "text-3xl sm:text-4xl font-extrabold mb-2", "Toko LingoMind 🏪" }
                            p { class: "text-amber-50 opacity-90 font-medium", "Gunakan koinmu untuk membeli item eksklusif!" }
                        }
                        div { class: "bg-white/20 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center flex flex-col items-center min-w-[120px]",
                            p { class: "text-xs font-bold uppercase tracking-wider text-amber-100", "Saldo Koin" }
                            p { class: "text-3xl font-black text-white flex items-center gap-2", "🪙 {coins}" }
                        }
                    }
                    div { class: "absolute -bottom-10 -right-10 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl pointer-events-none" }
                }

                if !buy_status().is_empty() {
                    div { class: "bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 p-4 rounded-xl flex items-center gap-3 animate-fade-in shadow-sm",
                        span { class: "text-2xl", "✨" }
                        p { class: "font-bold text-sm", "{buy_status()}" }
                        button { class: "ml-auto text-teal-500 hover:text-teal-700", onclick: move |_| buy_status.set(String::new()), "✕" }
                    }
                }

                // Grid Items
                div { class: "grid grid-cols-1 sm:grid-cols-2 gap-4",
                    for item in items {
                        div { class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col",
                            div { class: "flex items-start gap-4 mb-4",
                                div { class: "w-16 h-16 rounded-2xl bg-amber-50 dark:bg-slate-800 border border-amber-100 dark:border-slate-700 flex items-center justify-center text-3xl shadow-inner shrink-0 group-hover:scale-110 transition-transform",
                                    "{item.icon_name.clone().unwrap_or_else(|| \"📦\".to_string())}"
                                }
                                div { class: "flex-1",
                                    h3 { class: "font-bold text-lg text-slate-800 dark:text-slate-100", "{item.name}" }
                                    p { class: "text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2", "{item.description.clone().unwrap_or_default()}" }
                                }
                            }
                            div { class: "mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between",
                                div { class: "flex items-center gap-1.5",
                                    span { class: "text-lg", "🪙" }
                                    span { class: "font-black text-lg text-amber-600 dark:text-amber-500", "{item.cost}" }
                                }
                                {
                                    let email_for_buy = user.email.clone();
                                    let item_id = item.id;
                                    let can_afford = coins >= item.cost;
                                    
                                    rsx! {
                                        button {
                                            class: if can_afford {
                                                "px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm shadow-indigo-500/30 disabled:opacity-50"
                                            } else {
                                                "px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold rounded-xl text-sm cursor-not-allowed"
                                            },
                                            disabled: !can_afford || is_loading(),
                                            onclick: move |_| {
                                                let u = email_for_buy.clone();
                                                buy_status.set(String::new());
                                                is_loading.set(true);
                                                spawn(async move {
                                                    match buy_shop_item_server(u, item_id).await {
                                                        Ok(msg) => buy_status.set(msg),
                                                        Err(e) => {
                                                            let err = e.to_string().replace("error running server function: ", "");
                                                            buy_status.set(err);
                                                        }
                                                    }
                                                    engagement_resource.restart();
                                                    is_loading.set(false);
                                                });
                                            },
                                            if is_loading() { "Memproses..." } else if can_afford { "Beli" } else { "Koin Kurang" }
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
