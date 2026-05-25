use dioxus::prelude::*;
use crate::models::admin::UserAdminItem;
use crate::services::admin::{get_users_admin, update_user_role_admin, reset_user_progress_admin, update_user_stats_admin};

#[component]
pub fn UserPanel(email: String) -> Element {
    let mut users = use_signal(|| Vec::<UserAdminItem>::new());
    let mut is_loading = use_signal(|| true);
    let mut search_query = use_signal(|| String::new());
    
    let e1 = email.clone();
    use_effect(move || {
        let e = e1.clone();
        spawn(async move {
            is_loading.set(true);
            if let Ok(res) = get_users_admin(e).await {
                users.set(res);
            }
            is_loading.set(false);
        });
    });

    let sq = search_query().to_lowercase();
    let filtered_users = users().into_iter().filter(|u| {
        u.email.to_lowercase().contains(&sq) || u.full_name.to_lowercase().contains(&sq)
    }).collect::<Vec<_>>();

    rsx! {
        div { class: "bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200",
            div { class: "p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50",
                h3 { class: "text-lg font-bold text-slate-800 flex items-center gap-2",
                    i { class: "fa-solid fa-users text-blue-600" }
                    "Daftar Pengguna"
                }
                div { class: "relative w-64",
                    i { class: "fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" }
                    input {
                        class: "w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                        placeholder: "Cari email atau nama...",
                        value: "{search_query}",
                        oninput: move |e| search_query.set(e.value())
                    }
                }
            }
            div { class: "overflow-x-auto",
                table { class: "w-full text-left border-collapse",
                    thead {
                        tr { class: "bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200",
                            th { class: "px-6 py-4 font-semibold", "User" }
                            th { class: "px-6 py-4 font-semibold text-center", "Role" }
                            th { class: "px-6 py-4 font-semibold text-center", "Stats" }
                            th { class: "px-6 py-4 font-semibold text-center", "Status" }
                            th { class: "px-6 py-4 font-semibold text-right", "Aksi" }
                        }
                    }
                    tbody { class: "divide-y divide-slate-200 text-sm",
                        if is_loading() {
                            tr {
                                td { colspan: "5", class: "px-6 py-12 text-center text-slate-500",
                                    i { class: "fa-solid fa-spinner fa-spin text-3xl mb-4 block" }
                                    "Memuat Data Pengguna..."
                                }
                            }
                        } else if filtered_users.is_empty() {
                            tr {
                                td { colspan: "5", class: "px-6 py-12 text-center text-slate-500",
                                    i { class: "fa-solid fa-user-xmark text-4xl mb-4 block" }
                                    "Tidak ada pengguna yang cocok."
                                }
                            }
                        } else {
                            for user in filtered_users {
                                UserRow {
                                    admin_email: email.clone(),
                                    user: user.clone(),
                                    on_update: {
                                        let e_clone = email.clone();
                                        move |_| {
                                            let e = e_clone.clone();
                                            spawn(async move {
                                                is_loading.set(true);
                                                if let Ok(res) = get_users_admin(e).await {
                                                    users.set(res);
                                                }
                                                is_loading.set(false);
                                            });
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

#[component]
fn UserRow(admin_email: String, user: UserAdminItem, on_update: EventHandler<()>) -> Element {
    let mut is_updating = use_signal(|| false);
    let mut is_editing_stats = use_signal(|| false);
    let mut edit_coins = use_signal(|| user.coins.to_string());
    let mut edit_streak = use_signal(|| user.streak_days.to_string());
    
    let target = user.email.clone();
    let is_admin = user.role == "admin";
    let new_role = if is_admin { "user".to_string() } else { "admin".to_string() };
    
    let toggle_role_action = {
        let admin_email_toggle = admin_email.clone();
        let target_toggle = target.clone();
        let new_role_toggle = new_role.clone();
        move |_| {
            let e = admin_email_toggle.clone();
            let t = target_toggle.clone();
            let nr = new_role_toggle.clone();
            
            spawn(async move {
                is_updating.set(true);
                if let Ok(_) = update_user_role_admin(e, t, nr).await {
                    on_update.call(());
                }
                is_updating.set(false);
            });
        }
    };

    let reset_progress_action = {
        let admin_email_reset = admin_email.clone();
        let target_reset = target.clone();
        move |_| {
            let e = admin_email_reset.clone();
            let t = target_reset.clone();
            
            spawn(async move {
                is_updating.set(true);
                if let Ok(_) = reset_user_progress_admin(e, t).await {
                    on_update.call(());
                }
                is_updating.set(false);
            });
        }
    };

    let save_stats_action = {
        let admin_email_save = admin_email.clone();
        let target_save = target.clone();
        move |_| {
            let e = admin_email_save.clone();
            let t = target_save.clone();
            let coins_val = edit_coins().parse::<i32>().unwrap_or(0);
            let streak_val = edit_streak().parse::<i32>().unwrap_or(0);
            
            spawn(async move {
                is_updating.set(true);
                if let Ok(_) = update_user_stats_admin(e, t, coins_val, streak_val).await {
                    is_editing_stats.set(false);
                    on_update.call(());
                }
                is_updating.set(false);
            });
        }
    };

    let initial = user.full_name.chars().next().unwrap_or('?').to_uppercase();

    rsx! {
        tr { class: "hover:bg-slate-50 transition-colors",
            td { class: "px-6 py-4",
                div { class: "flex items-center gap-3",
                    div { class: "w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm",
                        "{initial}"
                    }
                    div {
                        div { class: "font-semibold text-slate-800", "{user.full_name}" }
                        div { class: "text-xs text-slate-500", "{user.email}" }
                    }
                }
            }
            td { class: "px-6 py-4 text-center",
                span {
                    class: if is_admin {
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200"
                    } else {
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"
                    },
                    i { class: if is_admin { "fa-solid fa-shield-halved" } else { "fa-solid fa-user" } }
                    "{user.role}"
                }
            }
            td { class: "px-6 py-4",
                div { class: "flex justify-center gap-4 text-xs",
                    div { class: "text-center",
                        div { class: "text-amber-500 font-bold", "{user.coins}" }
                        div { class: "text-slate-500", "Coins" }
                    }
                    div { class: "text-center",
                        div { class: "text-orange-500 font-bold", "{user.streak_days}" }
                        div { class: "text-slate-500", "Streak" }
                    }
                }
            }
            td { class: "px-6 py-4 text-center",
                if user.is_verified {
                    span { class: "text-emerald-600 font-medium text-xs flex items-center justify-center gap-1",
                        i { class: "fa-solid fa-check-circle" }
                        "Verified"
                    }
                } else {
                    span { class: "text-amber-500 font-medium text-xs flex items-center justify-center gap-1",
                        i { class: "fa-regular fa-clock" }
                        "Pending"
                    }
                }
            }
            td { class: "px-6 py-4 text-right",
                div { class: "flex justify-end gap-2",
                    button {
                        class: "px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors border border-blue-200 flex items-center gap-1.5",
                        onclick: move |_| is_editing_stats.set(true),
                        disabled: is_updating(),
                        i { class: "fa-solid fa-pen-to-square text-[10px]" }
                        "Edit Stats"
                    }
                    button {
                        class: "px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-600 rounded-lg text-xs font-bold transition-colors border border-orange-200 flex items-center gap-1.5",
                        onclick: reset_progress_action,
                        disabled: is_updating(),
                        if is_updating() {
                            i { class: "fa-solid fa-spinner fa-spin" }
                        } else {
                            i { class: "fa-solid fa-rotate-left text-[10px]" }
                            "Reset"
                        }
                    }
                    button {
                        class: if is_admin {
                            "px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                        } else {
                            "px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-xs font-bold transition-colors border border-red-200 flex items-center gap-1.5"
                        },
                        onclick: toggle_role_action,
                        disabled: is_updating(),
                        if is_updating() {
                            i { class: "fa-solid fa-spinner fa-spin" }
                        } else if is_admin {
                            i { class: "fa-solid fa-user-minus text-[10px]" }
                            "Cabut Admin"
                        } else {
                            i { class: "fa-solid fa-user-plus text-[10px]" }
                            "Jadikan Admin"
                        }
                    }
                }
            }
        }
        if is_editing_stats() {
            div { class: "fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm",
                div { class: "bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden",
                    div { class: "px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50",
                        h3 { class: "font-bold text-slate-800", "Edit Stats: {user.full_name}" }
                        button {
                            class: "text-slate-400 hover:text-slate-600 transition-colors",
                            onclick: move |_| {
                                is_editing_stats.set(false);
                                edit_coins.set(user.coins.to_string());
                                edit_streak.set(user.streak_days.to_string());
                            },
                            i { class: "fa-solid fa-xmark text-lg" }
                        }
                    }
                    div { class: "p-6 space-y-4",
                        div {
                            label { class: "block text-sm font-semibold text-slate-700 mb-1", "Coins" }
                            input {
                                class: "w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-800 font-medium",
                                r#type: "number",
                                value: "{edit_coins}",
                                oninput: move |e| edit_coins.set(e.value())
                            }
                        }
                        div {
                            label { class: "block text-sm font-semibold text-slate-700 mb-1", "Streak (Days)" }
                            input {
                                class: "w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-slate-800 font-medium",
                                r#type: "number",
                                value: "{edit_streak}",
                                oninput: move |e| edit_streak.set(e.value())
                            }
                        }
                    }
                    div { class: "px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3",
                        button {
                            class: "px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors",
                            onclick: move |_| {
                                is_editing_stats.set(false);
                                edit_coins.set(user.coins.to_string());
                                edit_streak.set(user.streak_days.to_string());
                            },
                            "Batal"
                        }
                        button {
                            class: "px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2",
                            onclick: save_stats_action,
                            disabled: is_updating(),
                            if is_updating() {
                                i { class: "fa-solid fa-spinner fa-spin" }
                            }
                            "Simpan"
                        }
                    }
                }
            }
        }
    }
}
