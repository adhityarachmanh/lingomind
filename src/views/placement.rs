use dioxus::prelude::*;
use crate::routes::Route;

#[component]
pub fn PlacementTest() -> Element {
    let navigator = use_navigator();
    let mut level = use_signal(|| "A1".to_string());
    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center",
            div { class: "max-w-lg w-full bg-slate-900 border border-slate-800 rounded-xl p-6",
                h2 { class: "text-xl font-bold mb-2", "Placement Test Singkat" }
                p { class: "text-sm text-slate-400 mb-4", "Pilih level awal agar rekomendasi materi lebih personal." }
                div { class: "grid grid-cols-3 gap-2 mb-5",
                    for lv in ["A1","A2","B1"] {
                        button {
                            class: format!("py-2 rounded border text-sm {}", if level() == lv { "bg-teal-500/20 border-teal-500 text-teal-300" } else { "bg-slate-950 border-slate-700 text-slate-300" }),
                            onclick: move |_| level.set(lv.to_string()),
                            "{lv}"
                        }
                    }
                }
                button {
                    class: "w-full bg-teal-500 text-slate-950 font-bold py-2.5 rounded",
                    onclick: move |_| { navigator.push(Route::Dashboard {}); },
                    "Simpan & Lanjut"
                }
            }
        }
    }
}
