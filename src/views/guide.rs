use dioxus::prelude::*;

#[component]
pub fn Guide() -> Element {
    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 pb-20 sm:pb-8 font-sans",
            div { class: "max-w-5xl mx-auto px-4 sm:px-6 pt-8",
                div { class: "mb-10 text-center",
                    h1 { class: "text-3xl sm:text-4xl font-black text-slate-800 dark:text-slate-200 mb-4 tracking-tight",
                        "Panduan Lengkap LingoMind 🚀"
                    }
                    p { class: "text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto font-medium",
                        "Pelajari cara memaksimalkan semua fitur cerdas di LingoMind untuk menguasai bahasa baru."
                    }
                }

                div { class: "grid grid-cols-1 md:grid-cols-2 gap-6",
                    
                    // Card 1: Kurikulum & Pembelajaran Adaptif
                    div { class: "bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "🗺️" }
                            h2 { class: "text-xl font-bold text-slate-800 dark:text-slate-200 mb-3", "1. Pembelajaran Adaptif" }
                            p { class: "text-slate-600 dark:text-slate-400 text-sm leading-relaxed",
                                "Sistem AI akan menilai tingkat kemampuan Anda melalui Tes Penempatan awal. Ikuti Kurikulum Terstruktur, dan tingkat kesulitan akan otomatis disesuaikan dengan kemampuan Anda. Selesaikan kuis dengan sempurna untuk naik level!"
                            }
                        }
                    }

                    // Card 2: AI Voice Chat & Roleplay
                    div { class: "bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "🎙️" }
                            h2 { class: "text-xl font-bold text-slate-800 dark:text-slate-200 mb-3", "2. Voice Chat & Speech Scoring" }
                            p { class: "text-slate-600 dark:text-slate-400 text-sm leading-relaxed",
                                "Berlatih bicara langsung dengan AI! Gunakan simulasi Roleplay (seperti di Cafe atau Bandara) untuk melatih kemampuan percakapan dunia nyata. Selain itu, fitur Speech Scoring akan menilai akurasi pengucapan Anda kata per kata dan mewarnainya sesuai kualitas pelafalan."
                            }
                        }
                    }

                    // Card 3: Analisis Kelemahan
                    div { class: "bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200/30 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-amber-50/30 dark:bg-amber-900/30 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-amber-100 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "📈" }
                            h2 { class: "text-xl font-bold text-slate-800 dark:text-slate-200 mb-3", "3. Analisis Kelemahan Cerdas" }
                            p { class: "text-slate-600 dark:text-slate-400 text-sm leading-relaxed",
                                "AI LingoMind mendeteksi jenis kesalahan Anda (contoh: Grammar atau Vocabulary) lalu membuat laporan tren mingguan. Anda juga bisa langsung berlatih soal-soal khusus untuk mengatasi kelemahan tersebut."
                            }
                        }
                    }

                    // Card 4: Flashcard & Spaced Repetition
                    div { class: "bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200/30 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-rose-50/30 dark:bg-rose-900/30 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-rose-100 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "🃏" }
                            h2 { class: "text-xl font-bold text-slate-800 dark:text-slate-200 mb-3", "4. Flashcard & Algoritma SM-2" }
                            p { class: "text-slate-600 dark:text-slate-400 text-sm leading-relaxed",
                                "Kosakata yang sulit akan masuk otomatis ke Flashcard Anda. Dengan algoritma Spaced Repetition (SM-2), kartu-kartu tersebut akan dijadwalkan ulang sesuai tingkat ingatan Anda untuk memastikan memori jangka panjang."
                            }
                        }
                    }

                    // Card 5: Gamifikasi & Badge
                    div { class: "bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "🏅" }
                            h2 { class: "text-xl font-bold text-slate-800 dark:text-slate-200 mb-3", "5. Gamifikasi: Koin & Badges" }
                            p { class: "text-slate-600 dark:text-slate-400 text-sm leading-relaxed",
                                "Dapatkan koin setiap kali menyelesaikan kuis! Tukarkan koin di Toko untuk membeli Streak Freeze ❄️. Buka juga berbagai pencapaian (Badge) unik seiring berkembangnya kemampuan Anda."
                            }
                        }
                    }

                    // Card 6: Teman & Pertarungan
                    div { class: "bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-fuchsia-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-fuchsia-100 text-fuchsia-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "⚔️" }
                            h2 { class: "text-xl font-bold text-slate-800 dark:text-slate-200 mb-3", "6. Mode Sosial & Beranda Feed" }
                            p { class: "text-slate-600 dark:text-slate-400 text-sm leading-relaxed",
                                "Follow teman Anda dan pantau pencapaian mereka melalui Beranda Sosial! Berikan Like/Kudos, dan jika Anda merasa percaya diri, tantang mereka dalam duel kuis (Quiz Battles) untuk mendapatkan hadiah tambahan."
                            }
                        }
                    }
                    
                    // Card 7: Sistem Nyawa (Hearts)
                    div { class: "bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "❤️" }
                            h2 { class: "text-xl font-bold text-slate-800 dark:text-slate-200 mb-3", "7. Sistem Nyawa (Hearts)" }
                            p { class: "text-slate-600 dark:text-slate-400 text-sm leading-relaxed",
                                "Berhati-hatilah saat menjawab Kuis atau Ujian! Anda dibekali 5 Nyawa. Jika salah menjawab, Nyawa akan berkurang. Jika habis, Anda harus istirahat sampai nyawa pulih, atau menggunakan Koin untuk membelinya kembali."
                            }
                        }
                    }

                    // Card 8: Peliharaan Virtual (Pets)
                    div { class: "bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10",
                            div { class: "w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm", "🐾" }
                            h2 { class: "text-xl font-bold text-slate-800 dark:text-slate-200 mb-3", "8. Peliharaan Virtual (Pets)" }
                            p { class: "text-slate-600 dark:text-slate-400 text-sm leading-relaxed",
                                "Adopsi Peliharaan Virtual dan rawat mereka dengan terus belajar! Beri makan mereka agar naik level. Hewan peliharaan yang levelnya tinggi dapat dipamerkan di profil dan leaderboards."
                            }
                        }
                    }

                    // Card 9: Mode Offline
                    div { class: "md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 p-6 sm:p-10 rounded-3xl shadow-lg relative overflow-hidden group",
                        div { class: "absolute top-0 right-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl -mr-20 -mt-20 transition-transform group-hover:scale-110" }
                        div { class: "relative z-10 flex flex-col sm:flex-row gap-6 items-center",
                            div { class: "w-16 h-16 shrink-0 bg-white/10 dark:bg-slate-900/10 backdrop-blur text-teal-400 rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-white/10", "📱" }
                            div { class: "text-center sm:text-left",
                                h2 { class: "text-2xl font-bold text-white mb-2", "9. PWA & Mode Offline" }
                                p { class: "text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl",
                                    "Instal aplikasi LingoMind langsung ke Homescreen. Anda juga dapat mengunduh materi (Lesson & Flashcard) dari Dashboard agar bisa tetap belajar tanpa koneksi internet!"
                                }
                            }
                        }
                    }
                }
                
                div { class: "mt-12 text-center",
                    p { class: "text-slate-500 dark:text-slate-400 font-medium text-sm", "Teruslah berlatih, pertahankan Streak Anda, dan jadilah Master Bahasa! 🔥" }
                }
            }
        }
    }
}
