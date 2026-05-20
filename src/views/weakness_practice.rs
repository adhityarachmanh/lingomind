use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::services::gemini::generate_weakness_practice_quiz_server;
use crate::services::weakness::{get_priority_weakness_server, log_weakness_server};

#[component]
pub fn WeaknessPractice(language: String, level: String, goal: String) -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let (user_opt, ready) = session_state();
    if !ready { return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Loading..." } }; }
    let Some(user) = user_opt else { return rsx! { div { class: "p-6 text-slate-300", "Silakan login dulu." } }; };

    let uname = user.username.clone();
    let lang_for_weakness = language.clone();
    let weakness_res = use_resource(move || {
        let u = uname.clone();
        let l = lang_for_weakness.clone();
        async move { get_priority_weakness_server(u, l).await }
    });

    let Some(weakness_data) = weakness_res.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Mengambil data kelemahan..." } };
    };

    let weakness_topic = weakness_data.ok().flatten().unwrap_or(goal);

    let l2 = language.clone();
    let lv2 = level.clone();
    let topic2 = weakness_topic.clone();
    let quiz_res = use_resource(move || {
        let l = l2.clone();
        let lv = lv2.clone();
        let t = topic2.clone();
        async move { generate_weakness_practice_quiz_server(l, lv, t).await }
    });

    let mut idx = use_signal(|| 0usize);
    let mut selected = use_signal(|| None::<String>);
    let mut show_expl = use_signal(|| false);

    let Some(quiz_data) = quiz_res.value()() else {
        return rsx! { div { class: "min-h-screen bg-slate-950 text-white flex items-center justify-center", "Menyusun practice quiz..." } };
    };
    let quiz = match quiz_data { Ok(q) => q, Err(e) => return rsx! { div { class: "p-6 text-rose-400", "Gagal generate practice quiz: {e}" } }, };
    let current = quiz.questions[idx()].clone();

    rsx! { div { class: "min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center", div { class: "max-w-xl w-full bg-slate-900 border border-slate-800 rounded-xl p-6", p { class: "text-xs text-amber-300 mb-2", "Weakness focus: {weakness_topic}" } p { class: "text-xs text-slate-500 mb-4", "Soal {idx() + 1}/{quiz.questions.len()}" } h2 { class: "text-lg font-semibold mb-4", "{current.question}" } div { class: "flex flex-col gap-2 mb-4", for opt in current.options.clone() { button { class: format!("text-left px-4 py-3 rounded border {}", if selected() == Some(opt.clone()) { "bg-teal-500/10 border-teal-500" } else { "bg-slate-950 border-slate-800" }), disabled: show_expl(), onclick: move |_| selected.set(Some(opt.clone())), "{opt}" } } } if show_expl() { div { class: "bg-slate-950 border border-slate-800 rounded p-3 text-sm mb-4", p { class: "text-slate-300", "Kunci: {current.correct_answer}" } p { class: "text-slate-400 mt-1", "{current.explanation}" } } } div { class: "flex justify-end", if !show_expl() { button { class: "bg-teal-500 text-slate-950 px-5 py-2 rounded font-bold disabled:opacity-40", disabled: selected().is_none(), onclick: move |_| { if selected() != Some(current.correct_answer.clone()) { let username = user.username.clone(); let lang = language.clone(); let topic = weakness_topic.clone(); let note = format!("Practice Q: {} | Selected: {} | Correct: {}", current.question, selected().unwrap_or_default(), current.correct_answer); spawn(async move { let _ = log_weakness_server(username, lang, topic, note).await; }); } show_expl.set(true) }, "Cek" } } else if idx() + 1 < quiz.questions.len() { button { class: "bg-slate-800 hover:bg-slate-700 px-5 py-2 rounded font-bold", onclick: move |_| { idx.set(idx() + 1); selected.set(None); show_expl.set(false); }, "Next" } } else { a { class: "bg-emerald-500 text-slate-950 px-5 py-2 rounded font-bold", href: "/dashboard", "Selesai" } } } } } }
}
