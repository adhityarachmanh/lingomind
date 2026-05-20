use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::services::flashcard::{get_due_flashcards_server, review_flashcard_server};
use crate::routes::Route;

#[component]
pub fn FlashcardReview(language: String) -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let (user_opt, ready) = session_state();

    if !ready {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Loading..." } };
    }

    let Some(user) = user_opt else {
        return rsx! { div { class: "p-6 text-slate-300", "Silakan login dulu." } };
    };

    let email = user.email.clone();
    let lang_clone = language.clone();

    let cards_resource = use_resource(move || {
        let u = email.clone();
        let l = lang_clone.clone();
        async move { get_due_flashcards_server(u, l, 20).await }
    });

    let mut index = use_signal(|| 0usize);
    let mut show_back = use_signal(|| false);

    let Some(cards_result) = cards_resource.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Menyiapkan review..." } };
    };

    let cards = match cards_result {
        Ok(v) => v,
        Err(e) => return rsx! { div { class: "p-6 text-rose-400", "Gagal memuat flashcard: {e}" } },
    };

    if cards.is_empty() {
        return rsx! {
            div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center p-6",
                div { class: "bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full text-center",
                    h2 { class: "text-xl font-bold mb-2", "Tidak ada kartu due" }
                    p { class: "text-slate-400 text-sm mb-4", "Kembali lagi nanti, atau buat kartu baru dari quiz." }
                    Link { to: Route::Dashboard {}, class: "inline-block bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded", "Kembali" }
                }
            }
        };
    }

    let total_cards = cards.len();
    let current = cards[index().min(total_cards - 1)].clone();

    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center",
            div { class: "max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl p-6",
                div { class: "flex justify-between mb-4 text-xs text-slate-400",
                    span { "Review {language}" }
                    span { "Kartu {index() + 1}/{total_cards}" }
                }

                div { class: "bg-slate-950 border border-slate-800 rounded-lg p-5 mb-4",
                    p { class: "text-sm text-slate-400 mb-2", "Front" }
                    p { class: "text-lg text-slate-100", "{current.front_text}" }

                    if show_back() {
                        div { class: "mt-4 pt-4 border-t border-slate-800",
                            p { class: "text-sm text-slate-400 mb-2", "Back" }
                            p { class: "text-slate-200", "{current.back_text}" }
                        }
                    }
                }

                if !show_back() {
                    button {
                        class: "bg-teal-500 text-slate-950 font-bold px-4 py-2 rounded",
                        onclick: move |_| show_back.set(true),
                        "Tampilkan Jawaban"
                    }
                } else {
                    div { class: "flex gap-2",
                        button {
                            class: "bg-rose-500/90 hover:bg-rose-500 px-4 py-2 rounded font-semibold",
                            onclick: move |_| {
                                let id = current.id;
                                spawn(async move { let _ = review_flashcard_server(id, 2).await; });
                                show_back.set(false);
                                index.set((index() + 1).min(total_cards));
                            },
                            "Again"
                        }
                        button {
                            class: "bg-amber-500/90 hover:bg-amber-500 px-4 py-2 rounded font-semibold text-slate-900",
                            onclick: move |_| {
                                let id = current.id;
                                spawn(async move { let _ = review_flashcard_server(id, 4).await; });
                                show_back.set(false);
                                index.set((index() + 1).min(total_cards));
                            },
                            "Good"
                        }
                        button {
                            class: "bg-emerald-500/90 hover:bg-emerald-500 px-4 py-2 rounded font-semibold text-slate-900",
                            onclick: move |_| {
                                let id = current.id;
                                spawn(async move { let _ = review_flashcard_server(id, 5).await; });
                                show_back.set(false);
                                index.set((index() + 1).min(total_cards));
                            },
                            "Easy"
                        }
                    }
                }
            }
        }
    }
}
