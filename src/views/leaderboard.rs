// src/views/leaderboard.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::models::social::SocialUser;
use crate::services::leaderboard::get_leaderboard_server;
use crate::services::social::{get_following_leaderboard_server, search_users_server, toggle_follow_server};
use crate::services::battle::create_battle_server;
use crate::routes::Route;

#[component]
pub fn Leaderboard() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let (user_opt, is_ready) = session_state();

    let mut active_tab = use_signal(|| "global".to_string()); // "global", "teman", "cari"
    let mut search_query = use_signal(String::new);
    let mut challenge_modal_open = use_signal(|| false);
    let mut target_email = use_signal(String::new);
    let mut challenge_goal = use_signal(String::new);
    let mut challenge_status = use_signal(String::new);

    if !is_ready {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 flex justify-center items-center",
                div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" }
            }
        };
    }

    let current_email = user_opt.as_ref().map(|u| u.email.clone()).unwrap_or_default();
    let current_user_name = user_opt.as_ref().map(|u| u.full_name.clone()).unwrap_or_default();

    let global_resource = use_resource(move || async move {
        get_leaderboard_server(10).await
    });

    let current_email1 = current_email.clone();
    let mut following_resource = use_resource(move || {
        let e = current_email1.clone();
        async move { get_following_leaderboard_server(e).await }
    });

    let current_email2 = current_email.clone();
    let mut search_resource = use_resource(move || {
        let q = search_query();
        let e = current_email2.clone();
        async move {
            if q.len() >= 3 {
                search_users_server(q, e).await
            } else {
                Ok(vec![])
            }
        }
    });


    let handle_challenge = move |e: String| {
        target_email.set(e);
        challenge_goal.set(String::new());
        challenge_status.set(String::new());
        challenge_modal_open.set(true);
    };

    let current_email_for_challenge = current_email.clone();
    let submit_challenge = move |_| {
        let ch_email = current_email_for_challenge.clone();
        let target = target_email();
        let lang = user_opt.as_ref().map(|u| u.preferred_language.clone()).unwrap_or_else(|| "English".to_string());
        let goal = challenge_goal();
        
        if goal.is_empty() {
            challenge_status.set("Topik kuis tidak boleh kosong!".to_string());
            return;
        }
        
        challenge_status.set("Mengirim tantangan...".to_string());
        spawn(async move {
            match create_battle_server(ch_email, target, lang, goal).await {
                Ok(_) => {
                    challenge_status.set("Tantangan berhasil dikirim! Tutup jendela ini.".to_string());
                },
                Err(e) => {
                    challenge_status.set(format!("Gagal: {}", e));
                }
            }
        });
    };

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-4 sm:p-8 font-sans pb-20",
            div { class: "max-w-3xl mx-auto space-y-6",

                // Header
                div { class: "relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-6 sm:p-10 shadow-xl shadow-orange-500/20 text-white text-center",
                    div { class: "relative z-10",
                        h1 { class: "text-3xl sm:text-4xl font-extrabold mb-2", "🏆 Papan Peringkat" }
                        p { class: "text-amber-50 text-sm sm:text-base opacity-90 font-medium", "Pantau progresmu dan tantang temanmu!" }
                    }
                }

                // Tabs
                div { class: "flex bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-1",
                    button {
                        class: format!("flex-1 py-3 text-sm font-bold rounded-xl transition-all {}", if active_tab() == "global" { "bg-amber-100 text-amber-700 shadow-sm" } else { "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-950" }),
                        onclick: move |_| active_tab.set("global".to_string()),
                        "🌍 Global"
                    }
                    button {
                        class: format!("flex-1 py-3 text-sm font-bold rounded-xl transition-all {}", if active_tab() == "teman" { "bg-amber-100 text-amber-700 shadow-sm" } else { "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-950" }),
                        onclick: move |_| active_tab.set("teman".to_string()),
                        "👥 Teman"
                    }
                    button {
                        class: format!("flex-1 py-3 text-sm font-bold rounded-xl transition-all {}", if active_tab() == "cari" { "bg-amber-100 text-amber-700 shadow-sm" } else { "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-950" }),
                        onclick: move |_| active_tab.set("cari".to_string()),
                        "🔍 Cari"
                    }
                }

                // Content
                if active_tab() == "global" {
                    match global_resource.value()() {
                        None => rsx! { div { class: "text-center py-10", "Memuat global leaderboard..." } },
                        Some(Err(e)) => rsx! { div { class: "text-red-500 text-center py-10", "{e}" } },
                        Some(Ok(entries)) => {
                            let mapped: Vec<SocialUser> = entries.into_iter().map(|e| SocialUser {
                                email: e.email,
                                full_name: e.full_name,
                                is_following: false,
                                score: e.score,
                                rank: e.rank,
                                current_streak: e.current_streak,
                                total_quiz_completed: e.total_quiz_completed,
                                active_frame: e.active_frame.clone(),
                                active_title: e.active_title.clone(),
                                active_name_color: e.active_name_color.clone(),
                            }).collect();
                            rsx! { LeaderboardList { entries: mapped, current_name: current_user_name.clone(), is_global: true, on_challenge: handle_challenge } }
                        }
                    }
                } else if active_tab() == "teman" {
                    match following_resource.value()() {
                        None => rsx! { div { class: "text-center py-10", "Memuat teman..." } },
                        Some(Err(e)) => rsx! { div { class: "text-red-500 text-center py-10", "{e}" } },
                        Some(Ok(entries)) => rsx! {
                            if entries.len() <= 1 {
                                div { class: "text-center py-10 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700",
                                    p { class: "text-4xl mb-4", "🕵️" }
                                    p { class: "text-slate-500 dark:text-slate-400 font-medium", "Anda belum mengikuti siapa pun." }
                                    button {
                                        class: "mt-4 bg-teal-500 text-white font-bold py-2 px-6 rounded-xl",
                                        onclick: move |_| active_tab.set("cari".to_string()),
                                        "Cari Teman"
                                    }
                                }
                            } else {
                                LeaderboardList { entries: entries, current_name: current_user_name.clone(), is_global: false, on_challenge: handle_challenge }
                            }
                        }
                    }
                } else if active_tab() == "cari" {
                    div { class: "bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700",
                        input {
                            r#type: "text",
                            class: "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-teal-500 transition-colors",
                            placeholder: "Cari nama atau email teman...",
                            value: "{search_query}",
                            oninput: move |e| search_query.set(e.value())
                        }

                        div { class: "mt-6 space-y-3",
                            match search_resource.value()() {
                                None => rsx! { div { class: "text-center text-sm text-slate-500 dark:text-slate-400", "Ketik minimal 3 huruf..." } },
                                Some(Err(e)) => rsx! { div { class: "text-red-500", "{e}" } },
                                Some(Ok(results)) => {
                                    if results.is_empty() && search_query().len() >= 3 {
                                        rsx! { div { class: "text-center text-sm text-slate-500 dark:text-slate-400", "Tidak ditemukan." } }
                                    } else {
                                        rsx! {
                                            for user in results {
                                                div { class: "flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800",
                                                    div {
                                                        p { class: "font-bold text-slate-800 dark:text-slate-200", "{user.full_name}" }
                                                        p { class: "text-xs text-slate-500 dark:text-slate-400", "{user.score} pts" }
                                                    }
                                                    button {
                                                        class: format!("px-4 py-2 text-xs font-bold rounded-lg transition-colors {}", 
                                                            if user.is_following { "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300" } 
                                                            else { "bg-teal-500 text-white hover:bg-teal-600" }),
                                                        onclick: {
                                                            let u_email = user.email.clone();
                                                            let is_f = user.is_following;
                                                            let me_email = current_email.clone();
                                                            let mut s_res = search_resource;
                                                            let mut f_res = following_resource;
                                                            move |_| {
                                                                let target = u_email.clone();
                                                                let me = me_email.clone();
                                                                spawn(async move {
                                                                    if let Ok(_) = toggle_follow_server(me, target, !is_f).await {
                                                                        f_res.restart();
                                                                        s_res.restart();
                                                                    }
                                                                });
                                                            }
                                                        },
                                                        if user.is_following { "Unfollow" } else { "Follow" }
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

                // Back to Dashboard
                div { class: "text-center pt-2",
                    Link {
                        to: Route::Dashboard {},
                        class: "inline-block bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-6 py-3 rounded-xl transition-colors text-sm",
                        "← Kembali ke Dashboard"
                    }
                }

                // Modal Tantangan
                if challenge_modal_open() {
                    div { class: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4",
                        div { class: "bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl",
                            h3 { class: "text-lg font-black text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2", span { class: "text-xl", "⚔️" } "Tantang Teman" }
                            p { class: "text-sm text-slate-500 dark:text-slate-400 mb-4", "Pilih topik kuis yang ingin Anda ujikan. Siapa yang paling tinggi skornya, dia yang dapat Koin!" }
                            
                            input {
                                r#type: "text",
                                class: "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-indigo-500 transition-colors",
                                placeholder: "Contoh: Past Tense, Passive Voice...",
                                value: "{challenge_goal}",
                                oninput: move |e| challenge_goal.set(e.value())
                            }
                            
                            if !challenge_status().is_empty() {
                                p { class: "text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-4 text-center", "{challenge_status}" }
                            }
                            
                            div { class: "flex gap-3",
                                button {
                                    class: "flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors cursor-pointer",
                                    onclick: move |_| challenge_modal_open.set(false),
                                    "Tutup"
                                }
                                button {
                                    class: "flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors cursor-pointer",
                                    onclick: submit_challenge,
                                    "Kirim Tantangan"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

fn get_frame_class(active_frame: Option<&str>, base_classes: &str, is_me: bool, default_bg: &str, me_bg: &str) -> String {
    let is_gold = active_frame == Some("gold") || active_frame == Some("profile_frame_gold");
    let is_diamond = active_frame == Some("diamond") || active_frame == Some("profile_frame_diamond");
    let is_mythic = active_frame == Some("mythic") || active_frame == Some("profile_frame_mythic");

    if is_mythic {
        format!("{} bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 text-white border-2 border-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.7)] animate-pulse", base_classes)
    } else if is_diamond {
        format!("{} bg-cyan-100 text-cyan-800 border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]", base_classes)
    } else if is_gold {
        format!("{} bg-yellow-500 text-slate-900 border-2 border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)]", base_classes)
    } else {
        format!("{} {}", base_classes, if is_me { me_bg } else { default_bg })
    }
}
pub fn get_name_color_class(color: Option<&str>) -> &'static str {
    match color {
        Some("gold") => "bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] font-black",
        Some("crimson") => "text-rose-600 drop-shadow-[0_0_8px_rgba(225,29,72,0.8)] font-black",
        Some("neon_blue") => "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] font-black",
        _ => "text-slate-700 dark:text-slate-300",
    }
}

pub fn render_title_badge(title: Option<&str>) -> Element {
    match title {
        Some("polyglot") => rsx! { span { class: "inline-block ml-1 px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full", "🎓 Polyglot" } },
        Some("sultan") => rsx! { span { class: "inline-block ml-1 px-2 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-700 rounded-full", "👑 Sultan" } },
        Some("legend") => rsx! { span { class: "inline-block ml-1 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full", "🌟 Legend" } },
        _ => rsx! { span {} }
    }
}

// Komponen Pembantu untuk menampilkan list leaderboard (Global / Teman)
#[component]
fn LeaderboardList(entries: Vec<SocialUser>, current_name: String, is_global: bool, on_challenge: EventHandler<String>) -> Element {
    let top3: Vec<_> = entries.iter().take(3).cloned().collect();
    let rest: Vec<_> = entries.iter().skip(3).cloned().collect();

    rsx! {
        div { class: "space-y-6",
            // Podium Top 3 (hanya tampilkan jika di tab Global, atau jika di tab teman dan jumlah > 0)
            if !top3.is_empty() {
                div { class: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm",
                    div { class: "flex items-end justify-center gap-3 sm:gap-5 pt-4 pb-2",
                        if top3.len() >= 2 {
                            {
                                let entry = &top3[1];
                                let is_me = entry.full_name == current_name;
                                rsx! {
                                    div { class: "flex flex-col items-center",
                                        div { class: get_frame_class(entry.active_frame.as_deref(), "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-black shadow-lg", is_me, "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700", "bg-gradient-to-br from-amber-100 to-amber-200 ring-2 ring-amber-400"), "🥈" }
                                        Link {
                                            to: Route::Profile { email: entry.email.clone() },
                                            class: "hover:underline flex items-center justify-center flex-wrap max-w-[110px]",
                                            p { class: "text-xs sm:text-sm font-bold mt-2 text-center line-clamp-2 leading-tight {get_name_color_class(entry.active_name_color.as_deref())}", "{entry.full_name}" }
                                            {render_title_badge(entry.active_title.as_deref())}
                                        }
                                        p { class: "text-xs font-black text-amber-600 dark:text-amber-400", "{entry.score} pts" }
                                        div { class: "w-16 sm:w-20 h-16 bg-gradient-to-t from-slate-200 to-slate-100 rounded-t-xl mt-2 flex items-center justify-center", span { class: "text-2xl font-black text-slate-400", "2" } }
                                    }
                                }
                            }
                        }
                        if !top3.is_empty() {
                            {
                                let entry = &top3[0];
                                let is_me = entry.full_name == current_name;
                                rsx! {
                                    div { class: "flex flex-col items-center -mt-4",
                                        div { class: get_frame_class(entry.active_frame.as_deref(), "w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-3xl sm:text-4xl font-black shadow-xl", is_me, "bg-gradient-to-br from-amber-100 to-yellow-200 text-amber-800", "bg-gradient-to-br from-amber-200 to-yellow-300 ring-4 ring-amber-400"), "🥇" }
                                        Link {
                                            to: Route::Profile { email: entry.email.clone() },
                                            class: "hover:underline flex items-center justify-center flex-wrap max-w-[130px]",
                                            p { class: "text-sm sm:text-base mt-2 text-center font-black line-clamp-2 leading-tight {get_name_color_class(entry.active_name_color.as_deref())}", "{entry.full_name}" }
                                            {render_title_badge(entry.active_title.as_deref())}
                                        }
                                        p { class: "text-sm font-black text-amber-600 dark:text-amber-400", "{entry.score} pts" }
                                        div { class: "w-20 sm:w-24 h-24 bg-gradient-to-t from-amber-300 to-amber-100 rounded-t-xl mt-2 flex items-center justify-center", span { class: "text-3xl font-black text-amber-600 dark:text-amber-400", "1" } }
                                    }
                                }
                            }
                        }
                        if top3.len() >= 3 {
                            {
                                let entry = &top3[2];
                                let is_me = entry.full_name == current_name;
                                rsx! {
                                    div { class: "flex flex-col items-center",
                                        div { class: get_frame_class(entry.active_frame.as_deref(), "w-14 h-14 sm:w-18 sm:h-18 rounded-full flex items-center justify-center text-xl sm:text-2xl font-black shadow-lg", is_me, "bg-gradient-to-br from-orange-50 to-orange-100 text-orange-800", "bg-gradient-to-br from-orange-100 to-orange-200 ring-2 ring-orange-400"), "🥉" }
                                        Link {
                                            to: Route::Profile { email: entry.email.clone() },
                                            class: "hover:underline flex items-center justify-center flex-wrap max-w-[100px]",
                                            p { class: "text-xs sm:text-sm font-bold mt-2 text-center line-clamp-2 leading-tight {get_name_color_class(entry.active_name_color.as_deref())}", "{entry.full_name}" }
                                            {render_title_badge(entry.active_title.as_deref())}
                                        }
                                        p { class: "text-xs font-black text-amber-600 dark:text-amber-400", "{entry.score} pts" }
                                        div { class: "w-14 sm:w-18 h-12 bg-gradient-to-t from-orange-200 to-orange-100 rounded-t-xl mt-2 flex items-center justify-center", span { class: "text-xl font-black text-orange-400", "3" } }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // List Lainnya
            if !rest.is_empty() {
                div { class: "bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden",
                    div { class: "divide-y divide-slate-100",
                        for entry in rest {
                            {
                                let is_me = entry.full_name == current_name;
                                rsx! {
                                    div { class: format!("flex items-center gap-4 px-6 py-3.5 transition-colors {}", if is_me { "bg-amber-50/30 dark:bg-amber-900/30 border-l-4 border-amber-400" } else { "hover:bg-slate-50 dark:bg-slate-950" }),
                                        div { class: get_frame_class(entry.active_frame.as_deref(), "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0", is_me, "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400", "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"), "{entry.rank}" }
                                        div { class: "flex-1 min-w-0 flex items-center flex-wrap",
                                            Link {
                                                to: Route::Profile { email: entry.email.clone() },
                                                class: "hover:underline",
                                                p { class: format!("text-sm font-bold truncate {} {}", if is_me { "text-amber-700" } else { "text-slate-800 dark:text-slate-200" }, get_name_color_class(entry.active_name_color.as_deref())), "{entry.full_name}" }
                                            }
                                            {render_title_badge(entry.active_title.as_deref())}
                                            if is_me { span { class: "ml-2 text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold uppercase", "Anda" } }
                                        }
                                        div { class: "flex items-center gap-2 shrink-0",
                                            if !is_me && is_global == false {
                                                button {
                                                    class: "px-3 py-1.5 text-xs font-bold rounded-lg transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-pointer",
                                                    onclick: {
                                                        let opponent_email = entry.email.clone();
                                                        move |_| {
                                                            on_challenge(opponent_email.clone());
                                                        }
                                                    },
                                                    "⚔️ Tantang"
                                                }
                                            }
                                            div { class: "flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-semibold shrink-0",
                                                span { class: "hidden sm:inline", "🔥 {entry.current_streak}" }
                                                span { class: "text-sm font-black text-amber-600 dark:text-amber-400 min-w-[50px] text-right", "{entry.score} pts" }
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
