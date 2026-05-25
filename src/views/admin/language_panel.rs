use dioxus::prelude::*;
use crate::models::admin::LanguageAdmin;
use crate::services::admin::{get_languages_admin, update_language_admin};

#[component]
pub fn LanguagePanel(email: String) -> Element {
    let email_clone = email.clone();

    let mut languages = use_resource(move || {
        let e = email_clone.clone();
        async move {
            get_languages_admin(e).await.unwrap_or_default()
        }
    });

    let mut editing_lang: Signal<Option<Option<LanguageAdmin>>> = use_signal(|| None);

    rsx! {
        div { class: "bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative",
            div { class: "flex justify-between items-center mb-6",
                h2 { class: "text-2xl font-bold text-slate-800 flex items-center gap-2",
                    i { class: "fa-solid fa-language text-purple-600" }
                    "Katalog Bahasa"
                }
                button { 
                    class: "bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-sm",
                    onclick: move |_| editing_lang.set(Some(None)),
                    i { class: "fa-solid fa-plus" }
                    "Tambah Bahasa"
                }
            }
            
            div { class: "overflow-x-auto",
                table { class: "w-full text-left text-sm text-slate-700",
                    thead { class: "text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200",
                        tr {
                            th { class: "px-4 py-3 rounded-tl-lg text-center w-20", "Bendera" }
                            th { class: "px-4 py-3", "Nama Bahasa" }
                            th { class: "px-4 py-3", "Kategori & TTS" }
                            th { class: "px-4 py-3", "Deskripsi" }
                            th { class: "px-4 py-3 rounded-tr-lg text-right", "Aksi" }
                        }
                    }
                    tbody { class: "divide-y divide-slate-200",
                        if let Some(langs) = languages() {
                            for lang in langs {
                                LanguageRow {
                                    lang: lang.clone(),
                                    on_edit: move |_| editing_lang.set(Some(Some(lang.clone())))
                                }
                            }
                        } else {
                            tr { td { colspan: "5", class: "px-4 py-8 text-center text-slate-500", "Memuat data..." } }
                        }
                    }
                }
            }

            // Modal
            if let Some(opt_lang) = editing_lang() {
                LanguageModal {
                    email: email.clone(),
                    lang: opt_lang,
                    on_close: move |_| editing_lang.set(None),
                    on_save: move |_| languages.restart()
                }
            }
        }
    }
}

#[component]
fn LanguageRow(lang: LanguageAdmin, on_edit: EventHandler<()>) -> Element {
    let flag = lang.flag.clone();
    let lang_name = lang.name.clone();
    let native_name = lang.native_name.clone();
    let tts_code = lang.tts_lang_code.clone();
    let cat = lang.category.clone();
    let desc = lang.description.clone();
    let id = lang.id.clone();

    rsx! {
        tr { class: "hover:bg-slate-50 transition-colors border-b border-slate-100",
            td { class: "px-4 py-4 text-3xl text-center w-20 filter drop-shadow-sm", "{flag}" }
            td { class: "px-4 py-4",
                div {
                    div { class: "font-bold text-slate-800 text-sm flex items-center gap-1.5", 
                        "{lang_name}"
                        span { class: "text-xxs font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold", "{id}" }
                    }
                    div { class: "text-xs text-slate-500 mt-0.5", "{native_name}" }
                }
            }
            td { class: "px-4 py-4",
                div {
                    div { class: "text-xs font-semibold text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-lg w-fit", "{cat}" }
                    div { class: "text-xxs font-mono text-slate-400 mt-1", "TTS: {tts_code}" }
                }
            }
            td { class: "px-4 py-4",
                div { class: "text-xs text-slate-500 max-w-sm truncate", title: "{desc}", "{desc}" }
            }
            td { class: "px-4 py-4 text-right",
                button {
                    class: "px-3 py-1.5 bg-purple-50 text-purple-600 border border-purple-100 rounded-lg text-xs font-bold hover:bg-purple-100 transition-colors flex items-center gap-1.5 shadow-sm ml-auto",
                    onclick: move |_| on_edit.call(()),
                    i { class: "fa-solid fa-pen" }
                    "Edit"
                }
            }
        }
    }
}

#[component]
fn LanguageModal(
    email: String,
    lang: Option<LanguageAdmin>,
    on_close: EventHandler<()>,
    on_save: EventHandler<()>,
) -> Element {
    let is_edit = lang.is_some();
    
    let mut id = use_signal(|| lang.as_ref().map(|l| l.id.clone()).unwrap_or_default());
    let mut name = use_signal(|| lang.as_ref().map(|l| l.name.clone()).unwrap_or_default());
    let mut native_name = use_signal(|| lang.as_ref().map(|l| l.native_name.clone()).unwrap_or_default());
    let mut flag = use_signal(|| lang.as_ref().map(|l| l.flag.clone()).unwrap_or_else(|| "🌐".to_string()));
    let mut tts_lang_code = use_signal(|| lang.as_ref().map(|l| l.tts_lang_code.clone()).unwrap_or_default());
    let mut description = use_signal(|| lang.as_ref().map(|l| l.description.clone()).unwrap_or_default());
    let mut theme_class = use_signal(|| lang.as_ref().map(|l| l.theme_class.clone()).unwrap_or_else(|| "bg-indigo-500".to_string()));
    let mut button_class = use_signal(|| lang.as_ref().map(|l| l.button_class.clone()).unwrap_or_else(|| "bg-indigo-600 hover:bg-indigo-700".to_string()));
    let mut category = use_signal(|| lang.as_ref().map(|l| l.category.clone()).unwrap_or_else(|| "Eropa".to_string()));
    
    let mut is_saving = use_signal(|| false);

    let save_action = move |_| {
        let e = email.clone();
        let new_lang = LanguageAdmin {
            id: id(),
            name: name(),
            native_name: native_name(),
            flag: flag(),
            description: description(),
            theme_class: theme_class(),
            button_class: button_class(),
            category: category(),
            tts_lang_code: tts_lang_code(),
        };
        
        spawn(async move {
            is_saving.set(true);
            if is_edit {
                if let Ok(_) = update_language_admin(e, new_lang).await {
                    on_save.call(());
                    on_close.call(());
                }
            } else {
                if let Ok(_) = crate::services::admin::create_language_admin(e, new_lang).await {
                    on_save.call(());
                    on_close.call(());
                }
            }
            is_saving.set(false);
        });
    };

    let title_text = if is_edit { "Edit Katalog Bahasa" } else { "Tambah Katalog Bahasa" };

    rsx! {
        div { class: "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200",
            div { class: "bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col",
                // Header
                div { class: "px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50",
                    div { class: "flex items-center gap-2",
                        i { class: "fa-solid fa-language text-purple-600" }
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
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400", "Bendera" }
                            input {
                                class: "w-full text-center text-xl bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all font-semibold",
                                value: "{flag}",
                                oninput: move |e| flag.set(e.value()),
                                placeholder: "🌐"
                            }
                        }
                        
                        div { class: "col-span-2 space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400", "Kode ID Bahasa" }
                            input {
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
                                value: "{id}",
                                oninput: move |e| id.set(e.value()),
                                placeholder: "e.g. ja, ko, fr",
                                disabled: is_edit
                            }
                        }
                    }

                    div { class: "grid grid-cols-2 gap-4",
                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400", "Nama Bahasa" }
                            input {
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all font-semibold",
                                value: "{name}",
                                oninput: move |e| name.set(e.value()),
                                placeholder: "e.g. Jepang"
                            }
                        }
                        
                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400", "Nama Asli" }
                            input {
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all font-semibold",
                                value: "{native_name}",
                                oninput: move |e| native_name.set(e.value()),
                                placeholder: "e.g. 日本語"
                            }
                        }
                    }

                    div { class: "grid grid-cols-2 gap-4",
                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400", "Kategori Wilayah" }
                            input {
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all",
                                value: "{category}",
                                oninput: move |e| category.set(e.value()),
                                placeholder: "e.g. Asia, Eropa"
                            }
                        }
                        
                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400", "Kode TTS Voice" }
                            input {
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all font-mono",
                                value: "{tts_lang_code}",
                                oninput: move |e| tts_lang_code.set(e.value()),
                                placeholder: "e.g. ja-JP, ko-KR"
                            }
                        }
                    }

                    div { class: "grid grid-cols-2 gap-4",
                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400", "CSS Kelas Tema" }
                            input {
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all font-mono",
                                value: "{theme_class}",
                                oninput: move |e| theme_class.set(e.value()),
                                placeholder: "e.g. bg-indigo-500"
                            }
                        }
                        
                        div { class: "space-y-1",
                            label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400", "CSS Kelas Tombol" }
                            input {
                                class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all font-mono",
                                value: "{button_class}",
                                oninput: move |e| button_class.set(e.value()),
                                placeholder: "e.g. bg-indigo-600"
                            }
                        }
                    }

                    div { class: "space-y-1",
                        label { class: "text-xs font-semibold uppercase tracking-wider text-slate-400", "Deskripsi Bahasa" }
                        textarea {
                            class: "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-600 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all min-h-[70px]",
                            value: "{description}",
                            oninput: move |e| description.set(e.value()),
                            placeholder: "Deskripsi singkat tentang pembelajaran bahasa ini..."
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
                        class: "px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50",
                        onclick: save_action,
                        disabled: is_saving() || id().trim().is_empty() || name().trim().is_empty(),
                        i { class: if is_saving() { "fa-solid fa-spinner fa-spin" } else { "fa-solid fa-floppy-disk" } }
                        if is_saving() { "Menyimpan..." } else { "Simpan" }
                    }
                }
            }
        }
    }
}
