use dioxus::prelude::*;
use crate::models::admin::{AppConfigItem, MissionConfigItem};
use crate::services::admin::{get_app_configs_admin, update_app_config_admin, get_mission_configs_admin, update_mission_config_admin};

#[component]
pub fn ConfigPanel(email: String) -> Element {
    let email_clone1 = email.clone();
    let email_clone2 = email.clone();

    let mut app_configs = use_resource(move || {
        let e = email_clone1.clone();
        async move {
            get_app_configs_admin(e).await.unwrap_or_default()
        }
    });

    let mut mission_configs = use_resource(move || {
        let e = email_clone2.clone();
        async move {
            get_mission_configs_admin(e).await.unwrap_or_default()
        }
    });

    let mut editing_app_config: Signal<Option<AppConfigItem>> = use_signal(|| None);
    let mut editing_mission_config: Signal<Option<MissionConfigItem>> = use_signal(|| None);

    rsx! {
        div { class: "space-y-8 relative",
            // App Config Section
            div { class: "bg-white rounded-xl p-6 border border-slate-200 shadow-sm",
                h2 { class: "text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2",
                    i { class: "fa-solid fa-sliders text-blue-600" }
                    "Sistem Konfigurasi Utama"
                }

                div { class: "overflow-x-auto",
                    table { class: "w-full text-left text-sm text-slate-700",
                        thead { class: "text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200",
                            tr {
                                th { class: "px-4 py-3 rounded-tl-lg", "Kunci (Key)" }
                                th { class: "px-4 py-3", "Nilai (Value)" }
                                th { class: "px-4 py-3", "Deskripsi" }
                                th { class: "px-4 py-3 rounded-tr-lg text-right", "Aksi" }
                            }
                        }
                        tbody { class: "divide-y divide-slate-200",
                            if let Some(configs) = app_configs() {
                                for config in configs {
                                    AppConfigRow {
                                        config: config.clone(),
                                        on_edit: move |_| editing_app_config.set(Some(config.clone())),
                                    }
                                }
                            } else {
                                tr {
                                    td {
                                        colspan: "4",
                                        class: "px-4 py-8 text-center text-slate-500",
                                        "Memuat data..."
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Mission Config Section
            div { class: "bg-white rounded-xl p-6 border border-slate-200 shadow-sm",
                h2 { class: "text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2",
                    i { class: "fa-solid fa-bullseye text-orange-500" }
                    "Konfigurasi Misi Harian"
                }

                div { class: "overflow-x-auto",
                    table { class: "w-full text-left text-sm text-slate-700",
                        thead { class: "text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200",
                            tr {
                                th { class: "px-4 py-3 rounded-tl-lg", "Tipe Misi" }
                                th { class: "px-4 py-3", "Target Lesson" }
                                th { class: "px-4 py-3", "Target Quiz" }
                                th { class: "px-4 py-3", "Detail Parameter" }
                                th { class: "px-4 py-3 rounded-tr-lg text-right", "Aksi" }
                            }
                        }
                        tbody { class: "divide-y divide-slate-200",
                            if let Some(missions) = mission_configs() {
                                for mission in missions {
                                    MissionConfigRow {
                                        config: mission.clone(),
                                        on_edit: move |_| editing_mission_config.set(Some(mission.clone())),
                                    }
                                }
                            } else {
                                tr {
                                    td {
                                        colspan: "5",
                                        class: "px-4 py-8 text-center text-slate-500",
                                        "Memuat data..."
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Modals
            if let Some(config) = editing_app_config() {
                AppConfigModal {
                    email: email.clone(),
                    config,
                    on_close: move |_| editing_app_config.set(None),
                    on_save: move |_| app_configs.restart(),
                }
            }

            if let Some(mission) = editing_mission_config() {
                MissionConfigModal {
                    email: email.clone(),
                    config: mission,
                    on_close: move |_| editing_mission_config.set(None),
                    on_save: move |_| mission_configs.restart(),
                }
            }
        }
    }
}

#[component]
fn AppConfigRow(config: AppConfigItem, on_edit: EventHandler<()>) -> Element {
    let config_key = config.key.clone();
    let config_val = config.value.clone();
    let config_desc = config.description.clone().unwrap_or_default();

    rsx! {
        tr { class: "hover:bg-slate-50 transition-colors border-b border-slate-100",
            td { class: "px-4 py-4 font-mono text-blue-600 font-bold", "{config_key}" }
            td { class: "px-4 py-4",
                span { class: "font-semibold text-slate-800 bg-slate-100/80 px-2.5 py-1 rounded-lg text-xs font-mono",
                    "{config_val}"
                }
            }
            td { class: "px-4 py-4 text-slate-500 text-xs", "{config_desc}" }
            td { class: "px-4 py-4 text-right",
                button {
                    class: "px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1.5 shadow-sm ml-auto",
                    onclick: move |_| on_edit.call(()),
                    i { class: "fa-solid fa-pen" }
                    "Edit"
                }
            }
        }
    }
}

#[component]
fn MissionConfigRow(config: MissionConfigItem, on_edit: EventHandler<()>) -> Element {
    let mission_name = config.name.clone();
    let les_tgt = config.lesson_target;
    let quiz_tgt = config.quiz_target;
    let weak_tgt = config.weakness_target;
    let fcm_tgt = config.flashcard_target_min;
    let fcx_tgt = config.flashcard_target_max;

    rsx! {
        tr { class: "hover:bg-slate-50 transition-colors border-b border-slate-100",
            td { class: "px-4 py-4 font-semibold text-orange-600", "{mission_name}" }
            td { class: "px-4 py-4",
                span { class: "text-slate-800 font-medium", "Lesson: {les_tgt}" }
            }
            td { class: "px-4 py-4",
                span { class: "text-slate-800 font-medium", "Quiz: {quiz_tgt}" }
            }
            td { class: "px-4 py-4",
                span { class: "text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg",
                    "Weakness: {weak_tgt} | FC: {fcm_tgt}-{fcx_tgt}"
                }
            }
            td { class: "px-4 py-4 text-right",
                button {
                    class: "px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors flex items-center gap-1.5 shadow-sm ml-auto",
                    onclick: move |_| on_edit.call(()),
                    i { class: "fa-solid fa-pen" }
                    "Edit"
                }
            }
        }
    }
}

#[component]
fn AppConfigModal(
    email: String,
    config: AppConfigItem,
    on_close: EventHandler<()>,
    on_save: EventHandler<()>,
) -> Element {
    let mut edit_value = use_signal(|| config.value.clone());
    let mut is_saving = use_signal(|| false);

    let key = config.key.clone();
    let key_for_save = key.clone();
    let description = config.description.clone().unwrap_or_default();

    let save_action = move |_| {
        let e = email.clone();
        let k = key_for_save.clone();
        let v = edit_value();
        
        spawn(async move {
            is_saving.set(true);
            if let Ok(_) = update_app_config_admin(e, k, v).await {
                on_save.call(());
                on_close.call(());
            }
            is_saving.set(false);
        });
    };

    rsx! {
        div { class: "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200",
            div { class: "bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col",
                // Header
                div { class: "px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50",
                    div { class: "flex items-center gap-2",
                        i { class: "fa-solid fa-sliders text-blue-600" }
                        h3 { class: "text-lg font-bold text-slate-800", "Edit Konfigurasi" }
                    }
                    button {
                        class: "text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100",
                        onclick: move |_| on_close.call(()),
                        i { class: "fa-solid fa-xmark text-lg" }
                    }
                }

                // Body
                div { class: "p-6 space-y-4 flex-1",
                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                            "Kunci Konfigurasi (Key)"
                        }
                        input {
                            class: "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-500 font-mono text-sm focus:outline-none cursor-not-allowed",
                            value: "{key}",
                            disabled: true,
                        }
                    }

                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                            "Nilai Baru (Value)"
                        }
                        input {
                            class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-semibold",
                            value: "{edit_value}",
                            oninput: move |e| edit_value.set(e.value()),
                            autofocus: true,
                        }
                    }

                    if !description.is_empty() {
                        div { class: "bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700/80 leading-relaxed",
                            i { class: "fa-solid fa-info-circle mr-1.5" }
                            "{description}"
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
                        disabled: is_saving(),
                        i { class: if is_saving() { "fa-solid fa-spinner fa-spin" } else { "fa-solid fa-floppy-disk" } }
                        if is_saving() {
                            "Menyimpan..."
                        } else {
                            "Simpan Perubahan"
                        }
                    }
                }
            }
        }
    }
}

#[component]
fn MissionConfigModal(
    email: String,
    config: MissionConfigItem,
    on_close: EventHandler<()>,
    on_save: EventHandler<()>,
) -> Element {
    let mut edit_lesson = use_signal(|| config.lesson_target.to_string());
    let mut edit_quiz = use_signal(|| config.quiz_target.to_string());
    let mut edit_weakness = use_signal(|| config.weakness_target.to_string());
    let mut edit_fc_min = use_signal(|| config.flashcard_target_min.to_string());
    let mut edit_fc_max = use_signal(|| config.flashcard_target_max.to_string());
    let mut is_saving = use_signal(|| false);

    let mission_name = config.name.clone();
    let orig = config.clone();

    let save_action = move |_| {
        let e = email.clone();
        let mut new_config = orig.clone();
        new_config.lesson_target = edit_lesson().parse().unwrap_or(orig.lesson_target);
        new_config.quiz_target = edit_quiz().parse().unwrap_or(orig.quiz_target);
        new_config.weakness_target = edit_weakness().parse().unwrap_or(orig.weakness_target);
        new_config.flashcard_target_min = edit_fc_min().parse().unwrap_or(orig.flashcard_target_min);
        new_config.flashcard_target_max = edit_fc_max().parse().unwrap_or(orig.flashcard_target_max);
        
        spawn(async move {
            is_saving.set(true);
            if let Ok(_) = update_mission_config_admin(e, new_config).await {
                on_save.call(());
                on_close.call(());
            }
            is_saving.set(false);
        });
    };

    rsx! {
        div { class: "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200",
            div { class: "bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col",
                // Header
                div { class: "px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50",
                    div { class: "flex items-center gap-2",
                        i { class: "fa-solid fa-bullseye text-orange-500" }
                        h3 { class: "text-lg font-bold text-slate-800", "Edit Misi Harian" }
                    }
                    button {
                        class: "text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100",
                        onclick: move |_| on_close.call(()),
                        i { class: "fa-solid fa-xmark text-lg" }
                    }
                }

                // Body
                div { class: "p-6 space-y-4 flex-1",
                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                            "Tipe Misi (Mission Name)"
                        }
                        input {
                            class: "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-orange-600 font-semibold text-sm focus:outline-none cursor-not-allowed",
                            value: "{mission_name}",
                            disabled: true,
                        }
                    }

                    div { class: "grid grid-cols-2 gap-4",
                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                                "Target Lesson"
                            }
                            input {
                                r#type: "number",
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all font-semibold",
                                value: "{edit_lesson}",
                                oninput: move |e| edit_lesson.set(e.value()),
                            }
                        }

                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                                "Target Quiz"
                            }
                            input {
                                r#type: "number",
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all font-semibold",
                                value: "{edit_quiz}",
                                oninput: move |e| edit_quiz.set(e.value()),
                            }
                        }
                    }

                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                            "Target Weakness"
                        }
                        input {
                            r#type: "number",
                            class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all font-semibold",
                            value: "{edit_weakness}",
                            oninput: move |e| edit_weakness.set(e.value()),
                        }
                    }

                    div { class: "grid grid-cols-2 gap-4",
                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                                "Flashcard Target Min"
                            }
                            input {
                                r#type: "number",
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all font-semibold",
                                value: "{edit_fc_min}",
                                oninput: move |e| edit_fc_min.set(e.value()),
                            }
                        }

                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                                "Flashcard Target Max"
                            }
                            input {
                                r#type: "number",
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all font-semibold",
                                value: "{edit_fc_max}",
                                oninput: move |e| edit_fc_max.set(e.value()),
                            }
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
                        class: "px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50",
                        onclick: save_action,
                        disabled: is_saving(),
                        i { class: if is_saving() { "fa-solid fa-spinner fa-spin" } else { "fa-solid fa-floppy-disk" } }
                        if is_saving() {
                            "Menyimpan..."
                        } else {
                            "Simpan Perubahan"
                        }
                    }
                }
            }
        }
    }
}
