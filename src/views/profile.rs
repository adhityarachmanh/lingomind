use dioxus::prelude::*;
use crate::services::profile::get_public_profile_server;

#[component]
pub fn Profile(email: String) -> Element {
    let email_clone = email.clone();
    
    let profile_resource = use_resource(move || {
        let e = email_clone.clone();
        async move { get_public_profile_server(e).await }
    });

    let content = match profile_resource.value()() {
        Some(Ok(profile)) => {
            let initial = profile.full_name.chars().next().unwrap_or('?').to_uppercase();
            
            // Check if gold frame is active
            let is_gold = profile.active_frame.as_deref() == Some("gold") || profile.active_frame.as_deref() == Some("profile_frame_gold");
            
            let frame_class = if is_gold {
                "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-yellow-500 text-slate-900 border-4 border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]"
            } else {
                "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-indigo-600 text-white"
            };

            rsx! {
                div { class: "max-w-4xl mx-auto space-y-8",
                    // Header Card
                    div { class: "bg-white dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row items-center md:items-start gap-6",
                        div { class: "relative",
                            div { class: "{frame_class}",
                                "{initial}"
                            }
                            if is_gold {
                                div { class: "absolute -bottom-2 -right-2 bg-yellow-500 text-slate-900 text-xs font-bold px-2 py-1 rounded-full",
                                    "VIP"
                                }
                            }
                        }
                        
                        div { class: "text-center md:text-left flex-1",
                            h1 { class: "text-3xl font-bold text-slate-800 dark:text-white mb-2", "{profile.full_name}" }
                            p { class: "text-slate-500 dark:text-slate-400 mb-4", "{profile.email}" }
                            
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
