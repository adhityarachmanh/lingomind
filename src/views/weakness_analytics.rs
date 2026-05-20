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
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Loading analytics..." } };
    }
    let Some(user) = user_opt else {
        return rsx! { div { class: "p-6 text-slate-300", "Silakan login dulu." } };
    };

    let u = user.email.clone();
    let mut selected_lang_for_analytics = selected_language;
    let analytics = use_resource(move || {
        let user_email = u.clone();
        let lang = selected_lang_for_analytics();
        async move { get_weakness_analytics_server(user_email, lang, 8).await }
    });

    let Some(data) = analytics.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Menyiapkan data..." } };
    };

    let items = match data {
        Ok(v) => v,
        Err(e) => return rsx! { div { class: "p-6 text-rose-400", "Gagal memuat analytics: {e}" } },
    };

    let language = selected_language();

    rsx! {
        div { class: "min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center",
            div { class: "max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-xl p-6",
                div { class: "flex items-center justify-between mb-4",
                    h2 { class: "text-xl font-bold", "Weakness Analytics ({language})" }
                    Link { to: Route::Dashboard {}, class: "text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded", "Kembali" }
                }

                if items.is_empty() {
                    p { class: "text-slate-400 text-sm", "Belum ada data kelemahan untuk bahasa ini." }
                } else {
                    div { class: "space-y-3",
                        for item in items {
                            div { class: "bg-slate-950 border border-slate-800 rounded p-3",
                                p { class: "text-sm text-slate-100 font-semibold mb-2", "{item.topic}" }
                                div { class: "grid grid-cols-2 gap-3 text-xs",
                                    div { class: "bg-slate-900 rounded p-2 border border-slate-800", "7 hari: " span { class: "text-amber-300 font-bold", "{item.count_7d}" } }
                                    div { class: "bg-slate-900 rounded p-2 border border-slate-800", "30 hari: " span { class: "text-teal-300 font-bold", "{item.count_30d}" } }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
