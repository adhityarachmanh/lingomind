use dioxus::prelude::*;

#[component]
pub fn Guide() -> Element {
    rsx! {
        div { class: "min-h-screen bg-slate-50 text-slate-800 pb-20 sm:pb-8",
            div { class: "max-w-4xl mx-auto px-4 sm:px-6 pt-8",
                div { class: "mb-10 text-center",
                    h1 { class: "text-3xl sm:text-4xl font-black text-slate-800 mb-4 tracking-tight",
                        "Selamat Datang di LingoMind 🚀"
                    }
                    p { class: "text-slate-600 text-lg max-w-2xl mx-auto font-medium",
                        "Panduan ringkas untuk memaksimalkan perjalanan belajar bahasa Anda."
                    }
                }

                div { class: "grid grid-cols-1 md:grid-cols-2 gap-6",
                    
                    // Card 1: Dashboard & Bahasa
                    div { class: "bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "🏠" }
                            h2 { class: "text-xl font-bold text-slate-800 mb-3", "1. Pilih Bahasa Anda" }
                            p { class: "text-slate-600 text-sm leading-relaxed",
                                "Di halaman utama (Dashboard), Anda dapat memilih bahasa yang ingin dipelajari. Sistem AI kami mendukung aksen dan pelafalan (TTS) khusus untuk setiap bahasa."
                            }
                        }
                    }

                    // Card 2: Kurikulum & Kuis (Mastery Flow)
                    div { class: "bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "🗺️" }
                            h2 { class: "text-xl font-bold text-slate-800 mb-3", "2. Kurikulum & Kuis" }
                            p { class: "text-slate-600 text-sm leading-relaxed",
                                "Ikuti peta jalan (Roadmap) sesuai level Anda. "
                                span { class: "font-bold text-emerald-600", "Penting: " }
                                "Untuk naik ke level berikutnya (misal A1 ke A2), Anda harus meraih nilai sempurna (100 poin) pada kuis di level saat ini. Ini memastikan penguasaan (Mastery) Anda."
                            }
                        }
                    }

                    // Card 3: Chat AI & Roleplay
                    div { class: "bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "🎙️" }
                            h2 { class: "text-xl font-bold text-slate-800 mb-3", "3. Praktik Bicara (Voice Chat)" }
                            p { class: "text-slate-600 text-sm leading-relaxed",
                                "Jangan hanya membaca. Gunakan fitur Roleplay untuk berlatih mengobrol langsung menggunakan suara (Voice AI) di lingkungan yang disimulasikan seperti Cafe, Bandara, atau Wawancara Kerja."
                            }
                        }
                    }

                    // Card 4: Flashcards (Spaced Repetition)
                    div { class: "bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "🃏" }
                            h2 { class: "text-xl font-bold text-slate-800 mb-3", "4. Flashcard Review" }
                            p { class: "text-slate-600 text-sm leading-relaxed",
                                "Setiap kata yang Anda pelajari akan masuk ke Flashcard otomatis. "
                                "Buka tab Flashcard setiap hari untuk mengulang kosakata agar berpindah ke memori jangka panjang."
                            }
                        }
                    }

                    // Card 5: Analisis Kelemahan
                    div { class: "md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 p-6 sm:p-10 rounded-3xl shadow-lg relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl -mr-20 -mt-20 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10 flex flex-col sm:flex-row gap-6 items-center",
                            div { class: "w-16 h-16 shrink-0 bg-white/10 backdrop-blur text-teal-400 rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-white/10", "📊" }
                            div { class: "text-center sm:text-left",
                                h2 { class: "text-2xl font-bold text-white mb-2", "5. Analisis Kelemahan & AI Tutor" }
                                p { class: "text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl",
                                    "Jika Anda sering salah di topik Grammar atau Listening, buka halaman "
                                    span { class: "font-bold text-teal-300", "Analisis" }
                                    ". AI LingoMind secara otomatis membuat latihan khusus untuk memperbaiki topik terlemah Anda (Weakness Practice)."
                                }
                            }
                        }
                    }
                }
                
                div { class: "mt-12 text-center",
                    p { class: "text-slate-500 font-medium text-sm", "Sistem Poin (XP) & Leaderboard memotivasi Anda bersaing dengan sehat. Kumpulkan api 🔥 setiap hari!" }
                }
            }
        }
    }
}
