use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::flashcard::{get_due_flashcards_server, review_flashcard_server};

#[component]
pub fn FlashcardReview() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, ready) = session_state();
    if !ready {
        return rsx! { div { class: "min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center font-sans", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    }

    let Some(user) = user_opt else {
        return rsx! { div { class: "p-6 text-slate-600 font-sans", "Silakan login dulu." } };
    };

    let email = user.email.clone();
    let mut selected_lang_for_resource = selected_language;
    let cards_resource = use_resource(move || {
        let u = email.clone();
        let l = selected_lang_for_resource();
        async move { get_due_flashcards_server(u, l, 20).await }
    });

    let mut index = use_signal(|| 0usize);
    let mut show_back = use_signal(|| false);
    let mut finished = use_signal(|| false);

    let Some(cards_result) = cards_resource.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center font-sans", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    };

    let cards = match cards_result {
        Ok(v) => v,
        Err(e) => return rsx! { div { class: "p-6 text-rose-600 font-sans", "Gagal memuat flashcard: {e}" } },
    };

    if cards.is_empty() {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 font-sans",
                div { class: "bg-white border border-slate-200 rounded-2xl p-8 max-w-lg w-full text-center shadow-lg",
                    h2 { class: "text-2xl font-extrabold text-slate-800 mb-2", "Tidak ada kartu due" }
                    p { class: "text-slate-500 text-sm mb-6 font-medium", "Kembali lagi nanti, atau buat kartu baru dari quiz." }
                    Link { to: Route::Dashboard {}, class: "inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-2.5 rounded-xl transition-colors", "Kembali" }
                }
            }
        };
    }

    if finished() {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 font-sans",
                div { class: "bg-white border border-slate-200 rounded-2xl p-8 max-w-lg w-full text-center shadow-lg",
                    div { class: "text-5xl mb-4", "🎉" }
                    h2 { class: "text-2xl font-extrabold text-slate-800 mb-2", "Review Selesai" }
                    p { class: "text-slate-500 text-sm mb-6 font-medium", "Semua kartu sesi ini sudah direview." }
                    Link { to: Route::Dashboard {}, class: "inline-block bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-colors", "Kembali ke Dashboard" }
                }
            }
        };
    }

    let total_cards = cards.len();
    let current = cards[index().min(total_cards - 1)].clone();
    let language = selected_language();

    rsx! {
        div { class: "min-h-screen bg-slate-50 text-slate-900 p-6 flex flex-col items-center justify-center font-sans",
            div { class: "max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-lg",
                div { class: "flex justify-between items-center mb-6 text-xs font-bold text-slate-500 uppercase tracking-wider",
                    span { "Review {language}" }
                    span { class: "bg-slate-100 px-3 py-1 rounded-full", "Kartu {index() + 1}/{total_cards}" }
                }

                div { class: "bg-slate-50 border border-slate-200 rounded-xl p-6 sm:p-8 mb-6 text-center shadow-inner min-h-[160px] flex flex-col justify-center",
                    p { class: "text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider", "Front" }
                    p { class: "text-2xl sm:text-3xl font-black text-slate-800 leading-tight", "{current.front_text}" }

                    if show_back() {
                        div { class: "mt-6 pt-6 border-t border-slate-200",
                            p { class: "text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider", "Back" }
                            p { class: "text-lg sm:text-xl font-bold text-teal-600", "{current.back_text}" }
                        }
                    }
                }

                if !show_back() {
                    button {
                        class: "w-full bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-4 rounded-xl shadow-md transition-colors text-sm sm:text-base",
                        onclick: move |_| show_back.set(true),
                        "Tampilkan Jawaban"
                    }
                } else {
                    div { class: "grid grid-cols-3 gap-3",
                        button {
                            class: "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-2 py-3 sm:py-4 rounded-xl font-bold transition-colors text-sm",
                            onclick: move |_| {
                                let id = current.id;
                                spawn(async move { let _ = review_flashcard_server(id, 2).await; });
                                show_back.set(false);
                                let next = index() + 1;
                                if next >= total_cards { finished.set(true); } else { index.set(next); }
                            },
                            "Again"
                        }
                        button {
                            class: "bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 px-2 py-3 sm:py-4 rounded-xl font-bold transition-colors text-sm",
                            onclick: move |_| {
                                let id = current.id;
                                spawn(async move { let _ = review_flashcard_server(id, 4).await; });
                                show_back.set(false);
                                let next = index() + 1;
                                if next >= total_cards { finished.set(true); } else { index.set(next); }
                            },
                            "Good"
                        }
                        button {
                            class: "bg-teal-50 hover:bg-teal-100 text-teal-600 border border-teal-200 px-2 py-3 sm:py-4 rounded-xl font-bold transition-colors text-sm",
                            onclick: move |_| {
                                let id = current.id;
                                spawn(async move { let _ = review_flashcard_server(id, 5).await; });
                                show_back.set(false);
                                let next = index() + 1;
                                if next >= total_cards { finished.set(true); } else { index.set(next); }
                            },
                            "Easy"
                        }
                    }
                }
            }
        }
    }
}
