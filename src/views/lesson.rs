// src/views/lesson.rs
use dioxus::prelude::*;
use crate::services::gemini::generate_lesson_server;
use crate::routes::Route;

#[component]
pub fn Lesson(language: String, level: String, goal: String) -> Element {
    let selected_language = use_context::<Signal<String>>();
    let lang_clone = language.clone();
    let lvl_clone = level.clone();
    let goal_clone = goal.clone();

    let lesson_resource = use_resource(move || {
        let lang = lang_clone.clone();
        let lvl = lvl_clone.clone();
        let goal_value = goal_clone.clone();
        async move { generate_lesson_server(lang, lvl, goal_value).await }
    });

    let Some(lesson_result) = lesson_resource.value()() else {
        return rsx! {
            div { class: "min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center gap-4",
                div { class: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-400" }
                p { class: "text-slate-400 animate-pulse text-sm", "Menyusun materi belajar khusus untuk Anda..." }
            }
        };
    };

    let lesson_data = match lesson_result {
        Ok(data) => data,
        Err(e) => return rsx! { div { class: "p-8 text-rose-400 text-center mt-20", "Gagal memuat materi: {e}" } }
    };

    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white p-6 pb-24",
            div { class: "max-w-3xl mx-auto mt-8 animate-fadeIn",
                
                // Header
                div { class: "mb-8 text-center",
                    span { class: "text-xs font-extrabold bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full uppercase tracking-wider mb-4 inline-block", "Materi {language} • {level}" }
                    p { class: "text-[11px] text-slate-400 mb-3", "Global language: " span { class: "text-orange-300 font-semibold", "{selected_language}" } }
                    h1 { class: "text-3xl md:text-4xl font-black text-slate-100", "{lesson_data.title}" }
                }

                // Penjelasan Materi Utama
                div { class: "bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 mb-8 shadow-xl",
                    h2 { class: "text-xl font-bold text-teal-400 mb-4 flex items-center gap-2", "📚 Penjelasan Materi" }
                    p { class: "text-slate-300 leading-relaxed text-sm md:text-base whitespace-pre-wrap", "{lesson_data.content}" }
                }

                // Grid 2 Kolom untuk Vocabulary & Contoh Kalimat
                div { class: "grid md:grid-cols-2 gap-6 mb-8",
                    // Kosa Kata
                    div { class: "bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl",
                        h2 { class: "text-lg font-bold text-rose-400 mb-4 flex items-center gap-2", "🧠 Kosa Kata Baru" }
                        ul { class: "space-y-3",
                            for vocab in lesson_data.vocabulary {
                                li { class: "flex justify-between items-center bg-slate-950 px-4 py-3 rounded-xl border border-slate-800/50",
                                    span { class: "font-bold text-slate-200", "{vocab.word}" }
                                    span { class: "text-sm text-slate-400 text-right", "{vocab.meaning}" }
                                }
                            }
                        }
                    }

                    // Contoh Kalimat
                    div { class: "bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl",
                        h2 { class: "text-lg font-bold text-amber-400 mb-4 flex items-center gap-2", "💬 Contoh Penggunaan" }
                        ul { class: "space-y-3",
                            for sentence in lesson_data.example_sentences {
                                li { class: "bg-slate-950 p-4 rounded-xl border border-slate-800/50 text-sm text-slate-300 leading-relaxed italic",
                                    "\"{sentence}\""
                                }
                            }
                        }
                    }
                }

                // Call to action: Lanjut ke Kuis
                div { class: "text-center",
                    Link {
                        to: Route::Quiz { language: language.clone(), level: level.clone(), goal: goal.clone() },
                        class: "inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-black px-8 py-4 rounded-xl transition-all shadow-lg shadow-teal-500/20 hover:-translate-y-1",
                        "Sudah Paham? Mulai Kuis Sekarang 🚀"
                    }
                }
            }
        }
    }
}




