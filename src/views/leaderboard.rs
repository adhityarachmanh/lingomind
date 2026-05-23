// src/views/leaderboard.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::services::leaderboard::get_leaderboard_server;
use crate::routes::Route;

#[component]
pub fn Leaderboard() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let (user_opt, is_ready) = session_state();

    let leaderboard_resource = use_resource(move || async move {
        get_leaderboard_server(50).await
    });

    if !is_ready {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 flex justify-center items-center",
                div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" }
            }
        };
    }

    let current_user_name = user_opt.as_ref().map(|u| u.full_name.clone()).unwrap_or_default();

    let leaderboard_value = leaderboard_resource.value()();

    rsx! {
        div { class: "min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 font-sans pb-20",
            div { class: "max-w-3xl mx-auto space-y-6",

                // Header
                div { class: "relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-6 sm:p-10 shadow-xl shadow-orange-500/20 text-white text-center",
                    div { class: "relative z-10",
                        h1 { class: "text-3xl sm:text-4xl font-extrabold mb-2", "🏆 Papan Peringkat" }
                        p { class: "text-amber-50 text-sm sm:text-base opacity-90 font-medium", "Siapa yang paling rajin belajar? Lihat posisimu!" }
                    }
                    div { class: "absolute -bottom-10 -right-10 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl pointer-events-none" }
                    div { class: "absolute top-10 right-20 w-24 h-24 bg-amber-300 opacity-20 rounded-full blur-xl pointer-events-none" }
                }

                match leaderboard_value {
                    None => rsx! {
                        div { class: "flex flex-col items-center gap-4 py-16",
                            div { class: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500" }
                            p { class: "text-slate-500 animate-pulse text-sm font-medium", "Memuat data peringkat..." }
                        }
                    },
                    Some(Err(e)) => rsx! {
                        div { class: "bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center",
                            p { class: "text-rose-600 font-bold", "Gagal memuat leaderboard: {e}" }
                        }
                    },
                    Some(Ok(entries)) => {
                        let top3: Vec<_> = entries.iter().take(3).cloned().collect();
                        let rest: Vec<_> = entries.iter().skip(3).cloned().collect();
                        let current_name = current_user_name.clone();

                        rsx! {
                            // Podium Top 3
                            if !top3.is_empty() {
                                div { class: "bg-white border border-slate-200 rounded-2xl p-6 shadow-sm",
                                    div { class: "flex items-end justify-center gap-3 sm:gap-5 pt-4 pb-2",
                                        // 2nd place (left)
                                        if top3.len() >= 2 {
                                            {
                                                let entry = &top3[1];
                                                let is_me = entry.full_name == current_name;
                                                rsx! {
                                                    div { class: "flex flex-col items-center",
                                                        div {
                                                            class: format!(
                                                                "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-black shadow-lg {}",
                                                                if is_me { "bg-gradient-to-br from-amber-100 to-amber-200 ring-2 ring-amber-400" } else { "bg-gradient-to-br from-slate-100 to-slate-200" }
                                                            ),
                                                            "🥈"
                                                        }
                                                        p { class: "text-xs sm:text-sm font-bold text-slate-700 mt-2 text-center max-w-[80px] truncate", "{entry.full_name}" }
                                                        p { class: "text-xs font-black text-amber-600", "{entry.score} pts" }
                                                        div { class: "w-16 sm:w-20 h-16 bg-gradient-to-t from-slate-200 to-slate-100 rounded-t-xl mt-2 flex items-center justify-center",
                                                            span { class: "text-2xl font-black text-slate-400", "2" }
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // 1st place (center, tallest)
                                        if !top3.is_empty() {
                                            {
                                                let entry = &top3[0];
                                                let is_me = entry.full_name == current_name;
                                                rsx! {
                                                    div { class: "flex flex-col items-center -mt-4",
                                                        div {
                                                            class: format!(
                                                                "w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-3xl sm:text-4xl font-black shadow-xl {}",
                                                                if is_me { "bg-gradient-to-br from-amber-200 to-yellow-300 ring-4 ring-amber-400" } else { "bg-gradient-to-br from-amber-100 to-yellow-200" }
                                                            ),
                                                            "🥇"
                                                        }
                                                        p { class: "text-sm sm:text-base font-black text-slate-800 mt-2 text-center max-w-[100px] truncate", "{entry.full_name}" }
                                                        p { class: "text-sm font-black text-amber-600", "{entry.score} pts" }
                                                        div { class: "w-20 sm:w-24 h-24 bg-gradient-to-t from-amber-300 to-amber-100 rounded-t-xl mt-2 flex items-center justify-center",
                                                            span { class: "text-3xl font-black text-amber-600", "1" }
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // 3rd place (right)
                                        if top3.len() >= 3 {
                                            {
                                                let entry = &top3[2];
                                                let is_me = entry.full_name == current_name;
                                                rsx! {
                                                    div { class: "flex flex-col items-center",
                                                        div {
                                                            class: format!(
                                                                "w-14 h-14 sm:w-18 sm:h-18 rounded-full flex items-center justify-center text-xl sm:text-2xl font-black shadow-lg {}",
                                                                if is_me { "bg-gradient-to-br from-orange-100 to-orange-200 ring-2 ring-orange-400" } else { "bg-gradient-to-br from-orange-50 to-orange-100" }
                                                            ),
                                                            "🥉"
                                                        }
                                                        p { class: "text-xs sm:text-sm font-bold text-slate-700 mt-2 text-center max-w-[80px] truncate", "{entry.full_name}" }
                                                        p { class: "text-xs font-black text-amber-600", "{entry.score} pts" }
                                                        div { class: "w-14 sm:w-18 h-12 bg-gradient-to-t from-orange-200 to-orange-100 rounded-t-xl mt-2 flex items-center justify-center",
                                                            span { class: "text-xl font-black text-orange-400", "3" }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // Rest of leaderboard table
                            if !rest.is_empty() {
                                div { class: "bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden",
                                    div { class: "px-6 py-4 border-b border-slate-100",
                                        p { class: "text-sm font-bold text-slate-700", "Peringkat Lainnya" }
                                    }
                                    div { class: "divide-y divide-slate-100",
                                        for entry in rest {
                                            {
                                                let is_me = entry.full_name == current_name;
                                                rsx! {
                                                    div {
                                                        class: format!(
                                                            "flex items-center gap-4 px-6 py-3.5 transition-colors {}",
                                                            if is_me { "bg-amber-50 border-l-4 border-amber-400" } else { "hover:bg-slate-50" }
                                                        ),
                                                        // Rank badge
                                                        div { class: "w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500 shrink-0",
                                                            "{entry.rank}"
                                                        }
                                                        // Name
                                                        div { class: "flex-1 min-w-0",
                                                            p {
                                                                class: format!(
                                                                    "text-sm font-bold truncate {}",
                                                                    if is_me { "text-amber-700" } else { "text-slate-800" }
                                                                ),
                                                                "{entry.full_name}"
                                                                if is_me {
                                                                    span { class: "ml-2 text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold uppercase", "Anda" }
                                                                }
                                                            }
                                                        }
                                                        // Stats
                                                        div { class: "flex items-center gap-3 text-xs text-slate-500 font-semibold shrink-0",
                                                            span { class: "hidden sm:inline", "🔥 {entry.current_streak}" }
                                                            span { class: "hidden sm:inline", "📝 {entry.total_quiz_completed}" }
                                                            span { class: "text-sm font-black text-amber-600 min-w-[50px] text-right", "{entry.score} pts" }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            if entries.is_empty() {
                                div { class: "bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm",
                                    p { class: "text-4xl mb-3", "🏜️" }
                                    p { class: "text-slate-500 font-medium text-sm", "Belum ada pengguna yang terdaftar. Jadilah yang pertama!" }
                                }
                            }
                        }
                    }
                }

                // Back to Dashboard
                div { class: "text-center pt-2",
                    Link {
                        to: Route::Dashboard {},
                        class: "inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3 rounded-xl transition-colors text-sm",
                        "← Kembali ke Dashboard"
                    }
                }
            }
        }
    }
}
