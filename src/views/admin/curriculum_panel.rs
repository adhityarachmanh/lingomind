use dioxus::prelude::*;
use crate::models::admin::{LevelAdminItem, TopicAdminItem};
use crate::services::admin::{get_levels_admin, update_level_admin, get_topics_admin, update_topic_admin, create_level_admin, create_topic_admin};

#[component]
pub fn CurriculumPanel(email: String) -> Element {
    let email_clone = email.clone();
    
    let mut levels = use_resource(move || {
        let e = email_clone.clone();
        async move {
            get_levels_admin(e).await.unwrap_or_default()
        }
    });

    let mut selected_level_id = use_signal(|| Option::<String>::None);
    let mut editing_level: Signal<Option<Option<LevelAdminItem>>> = use_signal(|| None);

    rsx! {
        div { class: "flex flex-col gap-6 relative h-[calc(100vh-120px)]",
            div { class: "bg-white rounded-xl shadow-sm border border-slate-200 flex flex-1 overflow-hidden",
                // Left Panel: Levels
                div { class: "w-1/3 border-r border-slate-200 flex flex-col h-full",
                    div { class: "p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center",
                        h3 { class: "text-lg font-bold text-slate-800", "Levels (CEFR)" }
                        button {
                            class: "bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm",
                            onclick: move |_| editing_level.set(Some(None)),
                            i { class: "fa-solid fa-plus text-xxs" }
                            "Tambah"
                        }
                    }

                    div { class: "flex-1 overflow-y-auto p-4 space-y-2 bg-white",
                        match levels() {
                            Some(lvl_list) => {
                                if lvl_list.is_empty() {
                                    rsx! {
                                        div { class: "text-center text-slate-400 py-8 text-xs", "Belum ada level." } // Automatically select first level if none selected
                                    }
                                } else {
                                    if selected_level_id().is_none() {
                                        if let Some(first) = lvl_list.first() {
                                            selected_level_id.set(Some(first.id.clone()));
                                        }
                                    }
                                    rsx! {
                                        for level in lvl_list {
                                            LevelRow {
                                                level: level.clone(),
                                                is_selected: selected_level_id() == Some(level.id.clone()),
                                                on_select: move |id| selected_level_id.set(Some(id)),
                                                on_edit: move |_| editing_level.set(Some(Some(level.clone()))),
                                            }
                                        }
                                    }
                                }
                            }
                            None => rsx! {
                                div { class: "text-center text-slate-500 py-8 text-xs",
                                    i { class: "fa-solid fa-spinner fa-spin mr-2" }
                                    "Memuat Levels..."
                                }
                            },
                        }
                    }
                }

                // Right Panel: Topics in selected level
                div { class: "flex-1 flex flex-col bg-slate-50/50 h-full",
                    if let Some(lvl_id) = selected_level_id() {
                        TopicListPanel { email: email.clone(), level_id: lvl_id }
                    } else {
                        div { class: "flex-1 flex flex-col items-center justify-center text-slate-400 p-8",
                            i { class: "fa-solid fa-layer-group text-4xl mb-4" }
                            p { class: "text-sm",
                                "Pilih salah satu Level di sebelah kiri untuk melihat dan mengelola Topik."
                            }
                        }
                    }
                }
            }

            // Level Modal
            if let Some(opt_level) = editing_level() {
                LevelModal {
                    email: email.clone(),
                    level: opt_level,
                    on_close: move |_| editing_level.set(None),
                    on_save: move |_| levels.restart(),
                }
            }
        }
    }
}

#[component]
fn LevelRow(level: LevelAdminItem, is_selected: bool, on_select: EventHandler<String>, on_edit: EventHandler<()>) -> Element {
    let id = level.id.clone();
    let title = level.title.clone();
    let desc = level.description.clone();
    let reward = level.base_reward_points;

    rsx! {
        div {
            class: if is_selected { "p-4 rounded-xl border border-blue-500 bg-blue-50/70 cursor-pointer shadow-sm relative group transition-all" } else { "p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-all relative group" },
            onclick: move |_| {
                on_select.call(id.clone());
            },

            div { class: "flex justify-between items-start pr-8",
                div { class: "space-y-1",
                    div { class: "flex items-center gap-2",
                        span { class: "font-mono font-bold text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded",
                            "{level.id}"
                        }
                        span { class: "font-bold text-slate-800 text-sm", "{title}" }
                    }
                    p { class: "text-xs text-slate-500 line-clamp-2 leading-relaxed",
                        "{desc}"
                    }
                }

                button {
                    class: "absolute right-3 top-3 text-slate-400 hover:text-blue-600 p-1.5 hover:bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                    onclick: move |e| {
                        e.stop_propagation();
                        on_edit.call(());
                    },
                    i { class: "fa-solid fa-pen text-xs" }
                }
            }

            div { class: "mt-3 flex items-center gap-3 text-xxs font-bold",
                span { class: "text-amber-500 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg flex items-center gap-1",
                    i { class: "fa-solid fa-coins text-[10px]" }
                    "{reward} pts"
                }
                span { class: "text-slate-400 font-mono", "Index: {level.order_index}" }
            }
        }
    }
}

#[component]
fn TopicListPanel(email: ReadOnlySignal<String>, level_id: ReadOnlySignal<String>) -> Element {
    // use_resource automatically restarts when level_id or email prop changes
    let mut topics = use_resource(move || {
        let e = email();
        let l = level_id();
        async move {
            get_topics_admin(e, l).await.unwrap_or_default()
        }
    });

    let mut editing_topic: Signal<Option<Option<TopicAdminItem>>> = use_signal(|| None);

    rsx! {
        div { class: "p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10",
            h3 { class: "text-lg font-bold text-slate-800 flex items-center gap-2",
                i { class: "fa-solid fa-list-ul text-blue-600" }
                "Daftar Topik: "
                span { class: "font-mono text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded",
                    "{level_id()}"
                }
            }
            button {
                class: "bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm",
                onclick: move |_| editing_topic.set(Some(None)),
                i { class: "fa-solid fa-plus text-[10px]" }
                "Tambah Topik"
            }
        }

        div { class: "flex-1 overflow-y-auto p-6 bg-slate-50/50",
            match topics() {
                Some(top_list) => {
                    if top_list.is_empty() {
                        rsx! {
                            div { class: "text-center text-slate-400 py-12",
                                i { class: "fa-solid fa-folder-open text-4xl mb-4 block" }
                                "Tidak ada topik ditemukan di level ini."
                            }
                        }
                    } else {
                        rsx! {
                            div { class: "space-y-3",
                                for topic in top_list {
                                    TopicRow {
                                        topic: topic.clone(),
                                        on_edit: move |_| editing_topic.set(Some(Some(topic.clone()))),
                                    }
                                }
                            }
                        }
                    }
                }
                None => rsx! {
                    div { class: "text-center text-slate-500 py-12",
                        i { class: "fa-solid fa-spinner fa-spin text-3xl mb-4 block text-blue-500" }
                        "Memuat Topik..."
                    }
                },
            }
        }

        // Topic Modal
        if let Some(opt_topic) = editing_topic() {
            TopicModal {
                email: email(),
                level_id: level_id(),
                topic: opt_topic,
                on_close: move |_| editing_topic.set(None),
                on_save: move |_| topics.restart(),
            }
        }
    }
}

#[component]
fn TopicRow(topic: TopicAdminItem, on_edit: EventHandler<()>) -> Element {
    let title = topic.title.clone();
    let order = topic.order_index;
    let id = topic.id;

    rsx! {
        div { class: "bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition-all group",
            div { class: "w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 font-bold font-mono text-sm border border-slate-200/80 shadow-sm",
                "{order}"
            }
            div { class: "flex-1 space-y-0.5",
                div { class: "font-bold text-slate-800 text-sm", "{title}" }
                div { class: "text-xxs font-mono text-slate-400", "Topic ID: {id}" }
            }
            button {
                class: "text-slate-400 hover:text-blue-600 p-2 hover:bg-slate-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-transparent hover:border-slate-100 bg-white",
                onclick: move |_| on_edit.call(()),
                i { class: "fa-solid fa-pen" }
            }
        }
    }
}

#[component]
fn LevelModal(
    email: String,
    level: Option<LevelAdminItem>,
    on_close: EventHandler<()>,
    on_save: EventHandler<()>,
) -> Element {
    let is_edit = level.is_some();
    
    let mut id = use_signal(|| level.as_ref().map(|l| l.id.clone()).unwrap_or_default());
    let mut title = use_signal(|| level.as_ref().map(|l| l.title.clone()).unwrap_or_default());
    let mut description = use_signal(|| level.as_ref().map(|l| l.description.clone()).unwrap_or_default());
    let mut base_reward_points = use_signal(|| level.as_ref().map(|l| l.base_reward_points.to_string()).unwrap_or_else(|| "100".to_string()));
    let mut order_index = use_signal(|| level.as_ref().map(|l| l.order_index.to_string()).unwrap_or_else(|| "1".to_string()));
    
    let mut is_saving = use_signal(|| false);

    let save_action = move |_| {
        let e = email.clone();
        let reward_parsed = base_reward_points().parse().unwrap_or(100);
        let order_parsed = order_index().parse().unwrap_or(1);
        
        let new_level = LevelAdminItem {
            id: id(),
            title: title(),
            description: description(),
            base_reward_points: reward_parsed,
            order_index: order_parsed,
        };
        
        spawn(async move {
            is_saving.set(true);
            if is_edit {
                if let Ok(_) = update_level_admin(e, new_level).await {
                    on_save.call(());
                    on_close.call(());
                }
            } else {
                if let Ok(_) = create_level_admin(e, new_level).await {
                    on_save.call(());
                    on_close.call(());
                }
            }
            is_saving.set(false);
        });
    };

    let title_text = if is_edit { "Edit Level Pembelajaran" } else { "Tambah Level Pembelajaran" };

    rsx! {
        div { class: "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200",
            div { class: "bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col",
                // Header
                div { class: "px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50",
                    div { class: "flex items-center gap-2",
                        i { class: "fa-solid fa-layer-group text-blue-600" }
                        h3 { class: "text-lg font-bold text-slate-800", "{title_text}" }
                    }
                    button {
                        class: "text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100",
                        onclick: move |_| on_close.call(()),
                        i { class: "fa-solid fa-xmark text-lg" }
                    }
                }

                // Body
                div { class: "p-6 space-y-4 flex-1 overflow-y-auto max-h-[70vh]",
                    div { class: "grid grid-cols-3 gap-4",
                        div { class: "col-span-1 space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                                "Kode Level"
                            }
                            input {
                                class: "w-full text-center bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed text-sm",
                                value: "{id}",
                                oninput: move |e| id.set(e.value()),
                                placeholder: "e.g. A1",
                                disabled: is_edit,
                            }
                        }

                        div { class: "col-span-2 space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                                "Nama Level"
                            }
                            input {
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-semibold",
                                value: "{title}",
                                oninput: move |e| title.set(e.value()),
                                placeholder: "e.g. Beginner",
                            }
                        }
                    }

                    div { class: "grid grid-cols-2 gap-4",
                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                                "Base Reward (Pts)"
                            }
                            input {
                                r#type: "number",
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-amber-600 font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm",
                                value: "{base_reward_points}",
                                oninput: move |e| base_reward_points.set(e.value()),
                            }
                        }

                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                                "Order Index"
                            }
                            input {
                                r#type: "number",
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono text-sm",
                                value: "{order_index}",
                                oninput: move |e| order_index.set(e.value()),
                            }
                        }
                    }

                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                            "Deskripsi Level"
                        }
                        textarea {
                            class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all min-h-[80px]",
                            value: "{description}",
                            oninput: move |e| description.set(e.value()),
                            placeholder: "Deskripsi target keterampilan level pembelajaran...",
                        }
                    }
                }

                // Footer
                div { class: "px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3",
                    button {
                        class: "px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm",
                        onclick: move |_| on_close.call(()),
                        "Batal"
                    }
                    button {
                        class: "px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50",
                        onclick: save_action,
                        disabled: is_saving() || id().trim().is_empty() || title().trim().is_empty(),
                        i { class: if is_saving() { "fa-solid fa-spinner fa-spin" } else { "fa-solid fa-floppy-disk" } }
                        if is_saving() {
                            "Menyimpan..."
                        } else {
                            "Simpan"
                        }
                    }
                }
            }
        }
    }
}

#[component]
fn TopicModal(
    email: String,
    level_id: String,
    topic: Option<TopicAdminItem>,
    on_close: EventHandler<()>,
    on_save: EventHandler<()>,
) -> Element {
    let is_edit = topic.is_some();
    let id = topic.as_ref().map(|t| t.id).unwrap_or(0);
    
    let mut title = use_signal(|| topic.as_ref().map(|t| t.title.clone()).unwrap_or_default());
    let mut order_index = use_signal(|| topic.as_ref().map(|t| t.order_index.to_string()).unwrap_or_else(|| "1".to_string()));
    
    let mut is_saving = use_signal(|| false);

    let level_id_for_save = level_id.clone();
    let save_action = move |_| {
        let e = email.clone();
        let l = level_id_for_save.clone();
        let order_parsed = order_index().parse().unwrap_or(1);
        let t_name = title();
        
        spawn(async move {
            is_saving.set(true);
            if is_edit {
                let updated_topic = TopicAdminItem {
                    id,
                    level_id: l,
                    title: t_name,
                    order_index: order_parsed,
                };
                if let Ok(_) = update_topic_admin(e, updated_topic).await {
                    on_save.call(());
                    on_close.call(());
                }
            } else {
                if let Ok(_) = create_topic_admin(e, l, t_name, order_parsed).await {
                    on_save.call(());
                    on_close.call(());
                }
            }
            is_saving.set(false);
        });
    };

    let title_text = if is_edit { "Edit Topik Pembelajaran" } else { "Tambah Topik Pembelajaran" };

    rsx! {
        div { class: "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200",
            div { class: "bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col",
                // Header
                div { class: "px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50",
                    div { class: "flex items-center gap-2",
                        i { class: "fa-solid fa-list-ul text-blue-600" }
                        h3 { class: "text-lg font-bold text-slate-800", "{title_text}" }
                    }
                    button {
                        class: "text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100",
                        onclick: move |_| on_close.call(()),
                        i { class: "fa-solid fa-xmark text-lg" }
                    }
                }

                // Body
                div { class: "p-6 space-y-4 flex-1 overflow-y-auto max-h-[70vh]",
                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                            "Level Pembelajaran"
                        }
                        input {
                            class: "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-mono font-bold text-sm focus:outline-none cursor-not-allowed",
                            value: "{level_id}",
                            disabled: true,
                        }
                    }

                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                            "Nama Topik"
                        }
                        input {
                            class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-semibold",
                            value: "{title}",
                            oninput: move |e| title.set(e.value()),
                            placeholder: "e.g. Greetings & Introductions",
                        }
                    }

                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                            "Order Index"
                        }
                        input {
                            r#type: "number",
                            class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono text-sm",
                            value: "{order_index}",
                            oninput: move |e| order_index.set(e.value()),
                        }
                    }
                }

                // Footer
                div { class: "px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3",
                    button {
                        class: "px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm",
                        onclick: move |_| on_close.call(()),
                        "Batal"
                    }
                    button {
                        class: "px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50",
                        onclick: save_action,
                        disabled: is_saving() || title().trim().is_empty(),
                        i { class: if is_saving() { "fa-solid fa-spinner fa-spin" } else { "fa-solid fa-floppy-disk" } }
                        if is_saving() {
                            "Menyimpan..."
                        } else {
                            "Simpan"
                        }
                    }
                }
            }
        }
    }
}
