use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::routes::Route;

#[derive(Clone, PartialEq)]
struct CurriculumLevel {
    level: &'static str,
    title: &'static str,
    description: &'static str,
    topics: Vec<&'static str>,
}

fn get_curriculum() -> Vec<CurriculumLevel> {
    vec![
        CurriculumLevel {
            level: "A1",
            title: "Beginner",
            description: "Memahami dan menggunakan ekspresi sehari-hari yang sangat dasar.",
            topics: vec![
                "Greetings & Introductions",
                "Basic Numbers & Time",
                "Everyday Vocabulary",
                "Simple Sentences",
            ],
        },
        CurriculumLevel {
            level: "A2",
            title: "Elementary",
            description: "Dapat berkomunikasi dalam tugas-tugas sederhana dan rutin.",
            topics: vec![
                "Daily Routines",
                "Past Experiences",
                "Making Plans",
                "Giving Directions",
            ],
        },
        CurriculumLevel {
            level: "B1",
            title: "Intermediate",
            description: "Dapat memahami poin utama dari input standar yang jelas.",
            topics: vec![
                "Travel & Hobbies",
                "Expressing Opinions",
                "Modals & Conditionals",
                "Understanding Short Texts",
            ],
        },
        CurriculumLevel {
            level: "B2",
            title: "Upper Intermediate",
            description: "Dapat memahami gagasan utama dari teks kompleks.",
            topics: vec![
                "Complex Conversations",
                "Advanced Grammar",
                "Expressing Emotions",
                "Debating & Persuasion",
            ],
        },
        CurriculumLevel {
            level: "C1",
            title: "Advanced",
            description: "Dapat mengekspresikan ide dengan lancar dan spontan.",
            topics: vec![
                "Idioms & Nuances",
                "Professional Writing",
                "Understanding Slang",
                "Societal Discussions",
            ],
        },
        CurriculumLevel {
            level: "C2",
            title: "Mastery",
            description: "Dapat memahami dengan mudah hampir semua yang didengar atau dibaca.",
            topics: vec![
                "Native-Level Fluency",
                "Literature & Humor",
                "Deep Cultural Integration",
                "Advanced Storytelling",
            ],
        },
    ]
}

#[component]
pub fn Roadmap() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let navigator = use_navigator();
    
    let (user_opt, _) = session_state();
    let language = selected_language();
    
    let active_level = user_opt
        .as_ref()
        .and_then(|u| u.current_level.get(&language).cloned())
        .unwrap_or_else(|| "A1".to_string());

    let curriculum = get_curriculum();
    
    // State untuk modal popover saat topik diklik
    let mut selected_topic = use_signal(|| None::<String>);

    let levels_order = vec!["A1", "A2", "B1", "B2", "C1", "C2"];
    let active_index = levels_order.iter().position(|&l| l == active_level.as_str()).unwrap_or(0);

    let mapped_curriculum = curriculum.into_iter().enumerate().map(|(i, level_data)| {
        let is_unlocked = i <= active_index;
        let is_current = i == active_index;
        (level_data, is_unlocked, is_current)
    }).collect::<Vec<_>>();

    rsx! {
        div { class: "min-h-screen bg-slate-50 text-slate-900 pb-20 pt-8 px-4 md:px-8 font-sans",
            div { class: "max-w-4xl mx-auto",
                // Header
                div { class: "mb-10 text-center",
                    h1 { class: "text-3xl md:text-4xl font-black text-slate-800 tracking-tight mb-3",
                        "Peta Kurikulum " span { class: "text-teal-600", "{language}" }
                    }
                    p { class: "text-slate-500 font-medium max-w-xl mx-auto",
                        "Pilih topik pelajaran yang ingin Anda kuasai. Level Anda saat ini adalah "
                        span { class: "font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md", "{active_level}" }
                    }
                }

                // Garis Waktu / Roadmap
                div { class: "relative border-l-4 border-slate-200 ml-4 md:ml-10 space-y-12 pb-8",
                    for (level_data, is_unlocked, is_current) in mapped_curriculum {
                        div { class: "relative pl-8 md:pl-12",
                            // Indikator Node (Titik Timeline)
                            div {
                                class: format!(
                                    "absolute -left-[22px] top-1 h-10 w-10 rounded-full border-4 flex items-center justify-center font-black text-sm transition-all {}",
                                    if is_current {
                                        "bg-white border-teal-500 text-teal-600 shadow-[0_0_15px_rgba(20,184,166,0.4)] scale-110"
                                    } else if is_unlocked {
                                        "bg-teal-500 border-white text-white shadow-md"
                                    } else {
                                        "bg-slate-200 border-white text-slate-400"
                                    }
                                ),
                                "{level_data.level}"
                            }

                            // Kartu Level
                            div {
                                class: format!(
                                    "bg-white rounded-3xl p-6 border transition-all {}",
                                    if is_current {
                                        "border-teal-300 shadow-xl shadow-teal-500/10 ring-1 ring-teal-500/20"
                                    } else if is_unlocked {
                                        "border-slate-200 shadow-md hover:shadow-lg hover:border-teal-200"
                                    } else {
                                        "border-slate-100 shadow-sm opacity-70 grayscale-[30%]"
                                    }
                                ),
                                div { class: "flex items-center justify-between mb-4",
                                    div {
                                        h3 { class: "text-xl font-bold text-slate-800", "{level_data.title}" }
                                        p { class: "text-sm text-slate-500 mt-1", "{level_data.description}" }
                                    }
                                    if is_current {
                                        span { class: "hidden sm:inline-block px-3 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-full uppercase tracking-wider", "Posisi Anda" }
                                    } else if !is_unlocked {
                                        span { class: "text-slate-400 text-xl", "🔒" }
                                    } else {
                                        span { class: "text-teal-500 text-xl", "✓" }
                                    }
                                }

                                // Grid Topik
                                div { class: "grid grid-cols-1 sm:grid-cols-2 gap-3",
                                    for topic in level_data.topics {
                                        button {
                                            r#type: "button",
                                            disabled: !is_unlocked,
                                            class: format!(
                                                "text-left p-4 rounded-xl border text-sm font-semibold transition-all flex items-center justify-between group {}",
                                                if is_unlocked {
                                                    "bg-slate-50 border-slate-200 text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-800 hover:shadow-sm"
                                                } else {
                                                    "bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed"
                                                }
                                            ),
                                            onclick: {
                                                let t = topic.to_string();
                                                move |_| {
                                                    if is_unlocked {
                                                        selected_topic.set(Some(t.clone()));
                                                    }
                                                }
                                            },
                                            span { "{topic}" }
                                            if is_unlocked {
                                                span { class: "text-slate-300 group-hover:text-teal-500 transition-colors text-lg", "→" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Modal Pemilihan Aksi Topik
            if let Some(topic) = selected_topic() {
                div { class: "fixed inset-0 z-50 flex items-center justify-center px-4",
                    div { class: "absolute inset-0 bg-slate-900/40 backdrop-blur-sm", onclick: move |_| selected_topic.set(None) }
                    
                    div { class: "relative bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200",
                        button {
                            class: "absolute top-4 right-4 h-8 w-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full flex items-center justify-center transition-colors font-bold",
                            onclick: move |_| selected_topic.set(None),
                            "✕"
                        }

                        div { class: "mb-6",
                            div { class: "w-12 h-12 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-sm", "🎯" }
                            h2 { class: "text-2xl font-black text-slate-800 mb-1", "Mulai Topik" }
                            p { class: "text-slate-500 font-medium text-sm", "Pilih metode pembelajaran untuk topik: " span { class: "text-teal-700 font-bold", "\"{topic}\"" } }
                        }

                        div { class: "space-y-3",
                            button {
                                class: "w-full p-4 rounded-2xl border border-slate-200 hover:border-teal-400 bg-white hover:bg-teal-50 flex items-center gap-4 transition-all group shadow-sm hover:shadow-md",
                                onclick: {
                                    let t = topic.clone();
                                    move |_| { navigator.push(Route::Lesson { goal: t.clone() }); }
                                },
                                div { class: "text-2xl", "📚" }
                                div { class: "text-left",
                                    h4 { class: "font-bold text-slate-800 group-hover:text-teal-800", "Pelajari Materi" }
                                    p { class: "text-xs text-slate-500 font-medium", "Baca penjelasan teori & contoh" }
                                }
                            }
                            
                            button {
                                class: "w-full p-4 rounded-2xl border border-slate-200 hover:border-teal-400 bg-white hover:bg-teal-50 flex items-center gap-4 transition-all group shadow-sm hover:shadow-md",
                                onclick: {
                                    let t = topic.clone();
                                    move |_| { navigator.push(Route::Quiz { goal: t.clone(), battle_id: None }); }
                                },
                                div { class: "text-2xl", "📝" }
                                div { class: "text-left",
                                    h4 { class: "font-bold text-slate-800 group-hover:text-teal-800", "Latihan Kuis" }
                                    p { class: "text-xs text-slate-500 font-medium", "Uji pengetahuan dengan soal interaktif" }
                                }
                            }

                             button {
                                class: "w-full p-4 rounded-2xl border border-slate-200 hover:border-teal-400 bg-white hover:bg-teal-50 flex items-center gap-4 transition-all group shadow-sm hover:shadow-md",
                                onclick: {
                                    let t = topic.clone();
                                    move |_| { navigator.push(Route::ChatRoleplay { goal: t.clone() }); }
                                },
                                div { class: "text-2xl", "💬" }
                                div { class: "text-left",
                                    h4 { class: "font-bold text-slate-800 group-hover:text-teal-800", "Chat Percakapan" }
                                    p { class: "text-xs text-slate-500 font-medium", "Simulasi chat interaktif berbasis teks dengan AI" }
                                }
                            }

                            button {
                                class: "w-full p-4 rounded-2xl border border-slate-200 hover:border-teal-400 bg-white hover:bg-teal-50 flex items-center gap-4 transition-all group shadow-sm hover:shadow-md",
                                onclick: {
                                    let t = topic.clone();
                                    move |_| { navigator.push(Route::VoiceChat { goal: t.clone() }); }
                                },
                                div { class: "text-2xl", "🎙️" }
                                div { class: "text-left",
                                    h4 { class: "font-bold text-slate-800 group-hover:text-teal-800", "Roleplay Suara" }
                                    p { class: "text-xs text-slate-500 font-medium", "Praktik berbicara langsung dengan AI" }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
