use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::weakness::get_weakness_analytics_server;

#[component]
pub fn WeaknessAnalytics() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, ready) = session_state();

    if !ready {
        return rsx! { div { class: "min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center font-sans", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    }
    let Some(user) = user_opt else {
        return rsx! { div { class: "p-6 text-slate-600 font-sans", "Silakan login dulu." } };
    };

    let u = user.email.clone();
    let mut selected_lang_for_analytics = selected_language;
    let analytics = use_resource(move || {
        let user_email = u.clone();
        let lang = selected_lang_for_analytics();
        async move { get_weakness_analytics_server(user_email, lang, 8).await }
    });

    let Some(data) = analytics.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center font-sans", div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" } } };
    };

    let items = match data {
        Ok(v) => v,
        Err(e) => return rsx! { div { class: "p-6 text-rose-600 font-sans", "Gagal memuat analytics: {e}" } },
    };

    let language = selected_language();

    rsx! {
        div { class: "min-h-screen bg-slate-50 text-slate-900 p-6 flex items-center justify-center font-sans",
            div { class: "max-w-3xl w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-lg",
                div { class: "flex items-center justify-between mb-6",
                    h2 { class: "text-2xl font-extrabold text-slate-800", "Weakness Analytics ", span { class: "text-teal-600", "({language})" } }
                    Link { to: Route::Dashboard {}, class: "text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-2 rounded-xl transition-colors", "Kembali" }
                }

                if items.is_empty() {
                    div { class: "bg-slate-50 border border-slate-100 rounded-xl p-8 text-center",
                        p { class: "text-slate-500 font-medium", "Belum ada data kelemahan untuk bahasa ini." }
                    }
                } else {
                    div { class: "space-y-4",
                        for item in items {
                            div { class: "bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow group",
                                p { class: "text-base text-slate-800 font-bold mb-3 group-hover:text-teal-600 transition-colors", "{item.topic}" }
                                div { class: "grid grid-cols-2 gap-4 text-sm",
                                    div { class: "bg-white rounded-lg p-3 border border-slate-100 shadow-inner", p { class: "text-slate-500 text-xs font-bold uppercase tracking-wider mb-1", "7 Hari Terakhir" } span { class: "text-amber-500 font-black text-lg", "{item.count_7d}" } }
                                    div { class: "bg-white rounded-lg p-3 border border-slate-100 shadow-inner", p { class: "text-slate-500 text-xs font-bold uppercase tracking-wider mb-1", "30 Hari Terakhir" } span { class: "text-teal-500 font-black text-lg", "{item.count_30d}" } }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
