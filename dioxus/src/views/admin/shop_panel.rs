use dioxus::prelude::*;
use crate::models::admin::ShopItemAdmin;
use crate::services::admin::{get_shop_items_admin, update_shop_item_admin};

#[component]
pub fn ShopPanel(email: String) -> Element {
    let email_clone = email.clone();

    let mut shop_items = use_resource(move || {
        let e = email_clone.clone();
        async move {
            get_shop_items_admin(e).await.unwrap_or_default()
        }
    });

    let mut editing_item: Signal<Option<Option<ShopItemAdmin>>> = use_signal(|| None);

    rsx! {
        div { class: "bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative",
            div { class: "flex justify-between items-center mb-6",
                h2 { class: "text-2xl font-bold text-slate-800 flex items-center gap-2",
                    i { class: "fa-solid fa-store text-emerald-600" }
                    "Katalog Toko"
                }
                button {
                    class: "bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-sm",
                    onclick: move |_| editing_item.set(Some(None)),
                    i { class: "fa-solid fa-plus" }
                    "Tambah Item"
                }
            }

            div { class: "overflow-x-auto",
                table { class: "w-full text-left text-sm text-slate-700",
                    thead { class: "text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200",
                        tr {
                            th { class: "px-4 py-3 rounded-tl-lg text-center w-20",
                                "Ikon"
                            }
                            th { class: "px-4 py-3", "Nama & Deskripsi" }
                            th { class: "px-4 py-3", "Efek" }
                            th { class: "px-4 py-3", "Harga" }
                            th { class: "px-4 py-3 rounded-tr-lg text-right", "Aksi" }
                        }
                    }
                    tbody { class: "divide-y divide-slate-200",
                        if let Some(items) = shop_items() {
                            for item in items {
                                ShopItemRow {
                                    item: item.clone(),
                                    on_edit: move |_| editing_item.set(Some(Some(item.clone()))),
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

            // Modal
            if let Some(opt_item) = editing_item() {
                ShopItemModal {
                    email: email.clone(),
                    item: opt_item,
                    on_close: move |_| editing_item.set(None),
                    on_save: move |_| shop_items.restart(),
                }
            }
        }
    }
}

#[component]
fn ShopItemRow(item: ShopItemAdmin, on_edit: EventHandler<()>) -> Element {
    let item_icon = item.icon_name.clone().unwrap_or_default();
    let item_name = item.name.clone();
    let item_desc = item.description.clone().unwrap_or_default();
    let effect_type = item.effect_type.clone();
    let item_price = item.cost;

    rsx! {
        tr { class: "hover:bg-slate-50 transition-colors border-b border-slate-100",
            td { class: "px-4 py-4 text-center",
                span { class: "text-3xl filter drop-shadow-sm", "{item_icon}" }
            }
            td { class: "px-4 py-4",
                div {
                    div { class: "font-bold text-slate-800 text-sm", "{item_name}" }
                    div { class: "text-xs text-slate-500 mt-0.5", "{item_desc}" }
                }
            }
            td { class: "px-4 py-4",
                span { class: "px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-mono font-semibold",
                    "{effect_type}"
                }
            }
            td { class: "px-4 py-4",
                span { class: "text-amber-500 font-bold flex items-center gap-1 text-sm bg-amber-50 border border-amber-100/50 px-2.5 py-1 rounded-lg w-fit",
                    "{item_price} "
                    i { class: "fa-solid fa-coins text-xs" }
                }
            }
            td { class: "px-4 py-4 text-right",
                button {
                    class: "px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-sm ml-auto",
                    onclick: move |_| on_edit.call(()),
                    i { class: "fa-solid fa-pen" }
                    "Edit"
                }
            }
        }
    }
}

#[component]
fn ShopItemModal(
    email: String,
    item: Option<ShopItemAdmin>,
    on_close: EventHandler<()>,
    on_save: EventHandler<()>,
) -> Element {
    let is_edit = item.is_some();
    let id = item.as_ref().map(|i| i.id).unwrap_or(0);
    
    let mut name = use_signal(|| item.as_ref().map(|i| i.name.clone()).unwrap_or_default());
    let mut description = use_signal(|| item.as_ref().map(|i| i.description.clone().unwrap_or_default()).unwrap_or_default());
    let mut cost = use_signal(|| item.as_ref().map(|i| i.cost.to_string()).unwrap_or_else(|| "10".to_string()));
    let mut effect_type = use_signal(|| item.as_ref().map(|i| i.effect_type.clone()).unwrap_or_else(|| "xp_booster".to_string()));
    let mut icon_name = use_signal(|| item.as_ref().map(|i| i.icon_name.clone().unwrap_or_default()).unwrap_or_else(|| "🎁".to_string()));
    
    let mut is_saving = use_signal(|| false);

    let save_action = move |_| {
        let e = email.clone();
        let cost_parsed = cost().parse().unwrap_or(10);
        let desc_opt = {
            let d = description();
            if d.trim().is_empty() { None } else { Some(d) }
        };
        let icon_opt = {
            let i = icon_name();
            if i.trim().is_empty() { None } else { Some(i) }
        };
        
        let n = name();
        let eff = effect_type();
        
        spawn(async move {
            is_saving.set(true);
            if is_edit {
                let updated_item = ShopItemAdmin {
                    id,
                    name: n,
                    description: desc_opt,
                    cost: cost_parsed,
                    effect_type: eff,
                    icon_name: icon_opt,
                };
                if let Ok(_) = update_shop_item_admin(e, updated_item).await {
                    on_save.call(());
                    on_close.call(());
                }
            } else {
                if let Ok(_) = crate::services::admin::create_shop_item_admin(e, n, desc_opt, cost_parsed, eff, icon_opt).await {
                    on_save.call(());
                    on_close.call(());
                }
            }
            is_saving.set(false);
        });
    };

    let title_text = if is_edit { "Edit Item Toko" } else { "Tambah Item Toko" };

    rsx! {
        div { class: "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200",
            div { class: "bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col",
                // Header
                div { class: "px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50",
                    div { class: "flex items-center gap-2",
                        i { class: "fa-solid fa-store text-emerald-600" }
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
                                "Ikon / Emoji"
                            }
                            input {
                                class: "w-full text-center text-xl bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all font-semibold",
                                value: "{icon_name}",
                                oninput: move |e| icon_name.set(e.value()),
                                placeholder: "🎁",
                            }
                        }

                        div { class: "col-span-2 space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                                "Harga (Koin)"
                            }
                            input {
                                r#type: "number",
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-amber-600 font-bold focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all text-sm",
                                value: "{cost}",
                                oninput: move |e| cost.set(e.value()),
                            }
                        }
                    }

                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                            "Nama Item"
                        }
                        input {
                            class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all font-semibold",
                            value: "{name}",
                            oninput: move |e| name.set(e.value()),
                            placeholder: "Nama Item Baru",
                        }
                    }

                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                            "Tipe Efek (Effect Key)"
                        }
                        input {
                            class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all font-mono",
                            value: "{effect_type}",
                            oninput: move |e| effect_type.set(e.value()),
                            placeholder: "e.g. shield, streak_freeze, double_xp",
                        }
                    }

                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400",
                            "Deskripsi"
                        }
                        textarea {
                            class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all min-h-[80px]",
                            value: "{description}",
                            oninput: move |e| description.set(e.value()),
                            placeholder: "Tulis penjelasan efek atau kegunaan item di sini...",
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
                        class: "px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50",
                        onclick: save_action,
                        disabled: is_saving() || name().trim().is_empty(),
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
