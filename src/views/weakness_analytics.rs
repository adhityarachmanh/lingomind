use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::routes::Route;
use crate::services::weakness::{get_weakness_analytics_server, get_skill_progress_7d_server};

#[component]
pub fn WeaknessAnalytics() -> Element {
    let session_state = use_context::<Signal<(Option<UserProfile>, bool)>>();
    let selected_language = use_context::<Signal<String>>();
    let (user_opt, ready) = session_state();

    let mut active_tab = use_signal(|| 0); // 0 = Peta Topik, 1 = Tren 7 Hari

    if !ready {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex items-center justify-center font-sans",
                div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" }
            }
        };
    }
    let Some(user) = user_opt else {
        return rsx! {
            div { class: "p-6 text-slate-600 dark:text-slate-400 font-sans", "Silakan login dulu." }
        };
    };

    let u = user.email.clone();
    let selected_lang_for_analytics = selected_language;
    let analytics_resource = use_resource(move || {
        let user_email = u.clone();
        let lang = selected_lang_for_analytics();
        async move { get_weakness_analytics_server(user_email, lang, 8).await }
    });

    let u2 = user.email.clone();
    let selected_lang_for_skill = selected_language;
    let skill_progress_resource = use_resource(move || {
        let user_email = u2.clone();
        let lang = selected_lang_for_skill();
        async move { get_skill_progress_7d_server(user_email, lang).await }
    });

    let Some(analytics_data) = analytics_resource.value()() else {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex items-center justify-center font-sans",
                div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" }
            }
        };
    };

    let Some(skill_data) = skill_progress_resource.value()() else {
        return rsx! {
            div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex items-center justify-center font-sans",
                div { class: "animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" }
            }
        };
    };

    let items = match analytics_data {
        Ok(v) => v,
        Err(e) => return rsx! {
            div { class: "p-6 text-rose-600 dark:text-rose-400 font-sans",
                "Gagal memuat analytics: {e}"
            }
        },
    };

    let skill_points = match skill_data {
        Ok(v) => v,
        Err(_) => Vec::new(),
    };

    let language = selected_language();

    // Perhitungan chart 7 Hari
    let mut grammar_path = String::new();
    let mut vocabulary_path = String::new();
    let mut listening_path = String::new();

    let mut grammar_area = String::new();
    let mut vocabulary_area = String::new();
    let mut listening_area = String::new();

    let mut x_coords = Vec::new();
    let mut g_coords = Vec::new();
    let mut v_coords = Vec::new();
    let mut l_coords = Vec::new();

    let n = skill_points.len();
    let width = 480.0;
    let height = 160.0;
    let pad_x = 50.0;
    let pad_y = 20.0;

    let max_val = skill_points.iter()
        .map(|p| p.grammar.max(p.vocabulary).max(p.listening))
        .max()
        .unwrap_or(0)
        .max(5) as f64;

    for (i, p) in skill_points.iter().enumerate() {
        let pct_x = if n > 1 { i as f64 / (n - 1) as f64 } else { 0.5 };
        let x = pad_x + pct_x * width;
        x_coords.push(x);

        let gy = pad_y + height - (p.grammar as f64 / max_val) * height;
        let vy = pad_y + height - (p.vocabulary as f64 / max_val) * height;
        let ly = pad_y + height - (p.listening as f64 / max_val) * height;

        g_coords.push(gy);
        v_coords.push(vy);
        l_coords.push(ly);

        if i == 0 {
            grammar_path.push_str(&format!("M {:.1} {:.1}", x, gy));
            vocabulary_path.push_str(&format!("M {:.1} {:.1}", x, vy));
            listening_path.push_str(&format!("M {:.1} {:.1}", x, ly));

            grammar_area.push_str(&format!("M {:.1} {:.1} L {:.1} {:.1}", x, pad_y + height, x, gy));
            vocabulary_area.push_str(&format!("M {:.1} {:.1} L {:.1} {:.1}", x, pad_y + height, x, vy));
            listening_area.push_str(&format!("M {:.1} {:.1} L {:.1} {:.1}", x, pad_y + height, x, ly));
        } else {
            grammar_path.push_str(&format!(" L {:.1} {:.1}", x, gy));
            vocabulary_path.push_str(&format!(" L {:.1} {:.1}", x, vy));
            listening_path.push_str(&format!(" L {:.1} {:.1}", x, ly));

            grammar_area.push_str(&format!(" L {:.1} {:.1}", x, gy));
            vocabulary_area.push_str(&format!(" L {:.1} {:.1}", x, vy));
            listening_area.push_str(&format!(" L {:.1} {:.1}", x, ly));
        }
    }

    if !skill_points.is_empty() {
        let last_x = x_coords.last().cloned().unwrap_or(pad_x + width);
        let bottom_y = pad_y + height;
        grammar_area.push_str(&format!(" L {:.1} {:.1} Z", last_x, bottom_y));
        vocabulary_area.push_str(&format!(" L {:.1} {:.1} Z", last_x, bottom_y));
        listening_area.push_str(&format!(" L {:.1} {:.1} Z", last_x, bottom_y));
    }

    let max_30d = items.iter().map(|item| item.count_30d).max().unwrap_or(1).max(1) as f64;

    rsx! {
        div { class: "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-4 sm:p-8 flex items-center justify-center font-sans",
            div { class: "max-w-4xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-xl",

                // Header
                div { class: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8",
                    div {
                        h2 { class: "text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight",
                            "Analisis Kelemahan"
                        }
                        p { class: "text-slate-500 dark:text-slate-400 text-sm font-semibold mt-1",
                            "Pantau topik & keterampilan aktif yang memerlukan latihan ekstra untuk bahasa "
                            span { class: "text-teal-600 dark:text-teal-400 font-extrabold",
                                "{language}"
                            }
                        }
                    }
                    Link {
                        to: Route::Dashboard {},
                        class: "text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold px-5 py-2.5 rounded-2xl transition-all shadow-sm text-center",
                        "Kembali ke Dashboard"
                    }
                }

                // Interactive Premium Tabs
                div { class: "flex bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl mb-8 border border-slate-200/50 dark:border-slate-700/50 max-w-md",
                    button {
                        class: format!(
                            "flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 {}",
                            if active_tab() == 0 {
                                "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-md"
                            } else {
                                "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200"
                            },
                        ),
                        onclick: move |_| active_tab.set(0),
                        "📋 Peta Topik Kelemahan"
                    }
                    button {
                        class: format!(
                            "flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 {}",
                            if active_tab() == 1 {
                                "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-md"
                            } else {
                                "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200"
                            },
                        ),
                        onclick: move |_| active_tab.set(1),
                        "📊 Tren 7 Hari Terakhir"
                    }
                }

                // Content View
                if active_tab() == 0 {
                    // TAB 1: Peta Topik Kelemahan (Comparative Dual-Track Progress Cards)
                    if items.is_empty() {
                        div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 border-dashed rounded-2xl p-12 text-center",
                            span { class: "text-4xl block mb-3", "🌱" }
                            p { class: "text-slate-500 dark:text-slate-400 font-bold text-base",
                                "Belum ada data kelemahan untuk bahasa ini."
                            }
                            p { class: "text-slate-400 text-xs mt-1",
                                "Lakukan kuis atau latihan agar AI dapat memetakan fokus kelemahan Anda."
                            }
                        }
                    } else {
                        div { class: "grid grid-cols-1 md:grid-cols-2 gap-6",
                            for item in items {
                                {
                                    let pct_7d = (item.count_7d as f64 / max_30d) * 100.0;
                                    let pct_30d = (item.count_30d as f64 / max_30d) * 100.0;
                                    rsx! {
                                        div { class: "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between hover:border-teal-100/50 dark:border-teal-900/50",
                                            div { class: "mb-4",
                                                p { class: "text-base text-slate-800 dark:text-slate-200 font-black mb-2 group-hover:text-teal-600 dark:text-teal-400 transition-colors",
                                                    "{item.topic}"
                                                } // Track 7 Hari
                                                p { class: "text-xs text-slate-400 font-semibold",
                                                    "Akurasi kesalahan terdistribusi secara berkala."
                                                }
                                            }
                                            div { class: "space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800",
                                                // Track 7 Hari
                                                div { class: "space-y-1.5",
                                                    div { class: "flex items-center justify-between text-xs font-black text-slate-500/30 dark:text-slate-400",
                                                        span { "7 Hari Terakhir" }
                                                        span { class: "text-amber-600 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/30 px-2 py-0.5 rounded-lg border border-amber-100",
                                                            "{item.count_7d}x salah"
                                                        }
                                                    }
                                                    div { class: "w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden",
                                                        div {
                                                            class: "bg-amber-500 h-full rounded-full transition-all duration-500",
                                                            style: "width: {pct_7d}%",
                                                        }
                                                    }
                                                }
                                                // Track 30 Hari
                                                div { class: "space-y-1.5",
                                                    div { class: "flex items-center justify-between text-xs font-black text-slate-500/30 dark:text-slate-400",
                                                        span { "30 Hari Terakhir" }
                                                        span { class: "text-teal-600 dark:text-teal-400 bg-teal-50/30 dark:bg-teal-900/30 px-2 py-0.5 rounded-lg border border-teal-100/50 dark:border-teal-900/50",
                                                            "{item.count_30d}x salah"
                                                        }
                                                    }
                                                    div { class: "w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden",
                                                        div {
                                                            class: "bg-teal-500 h-full rounded-full transition-all duration-500",
                                                            style: "width: {pct_30d}%",
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // TAB 2: Tren Penguasaan Keterampilan 7 Hari (SVG Area & Line Chart)
                    if skill_points.is_empty() {
                        div { class: "bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 border-dashed rounded-2xl p-12 text-center",
                            span { class: "text-4xl block mb-3", "📈" }
                            p { class: "text-slate-500 dark:text-slate-400 font-bold text-base",
                                "Belum ada data tren keterampilan."
                            }
                            p { class: "text-slate-400 text-xs mt-1",
                                "Selesaikan materi pelajaran & kuis harian untuk melihat grafik tren keterampilan Anda."
                            }
                        }
                    } else {
                        div { class: "space-y-6",
                            // Chart Wrapper
                            div { class: "border border-slate-200/50 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 rounded-2xl shadow-inner",
                                svg {
                                    view_box: "0 0 560 220",
                                    class: "w-full h-auto",
                                    defs {
                                        linearGradient {
                                            id: "grad-grammar",
                                            x1: "0",
                                            y1: "0",
                                            x2: "0",
                                            y2: "1",
                                            stop {
                                                offset: "0%",
                                                stop_color: "#6366f1",
                                                stop_opacity: "0.2",
                                            }
                                            stop {
                                                offset: "100%",
                                                stop_color: "#6366f1",
                                                stop_opacity: "0",
                                            }
                                        }
                                        linearGradient {
                                            id: "grad-vocab",
                                            x1: "0",
                                            y1: "0",
                                            x2: "0",
                                            y2: "1",
                                            stop {
                                                offset: "0%",
                                                stop_color: "#ec4899",
                                                stop_opacity: "0.2",
                                            }
                                            stop {
                                                offset: "100%",
                                                stop_color: "#ec4899",
                                                stop_opacity: "0",
                                            }
                                        }
                                        linearGradient {
                                            id: "grad-listening",
                                            x1: "0",
                                            y1: "0",
                                            x2: "0",
                                            y2: "1",
                                            stop {
                                                offset: "0%",
                                                stop_color: "#f59e0b",
                                                stop_opacity: "0.2",
                                            }
                                            stop {
                                                offset: "100%",
                                                stop_color: "#f59e0b",
                                                stop_opacity: "0",
                                            }
                                        }
                                    }

                                    // Horizontal Gridlines
                                    for f in [0.0, 0.25, 0.5, 0.75, 1.0] {
                                        {
                                            let y = pad_y + height - f * height;
                                            rsx! {
                                                g {
                                                    line {
                                                        x1: "{pad_x}",
                                                        y1: "{y}",
                                                        x2: "{pad_x + width}",
                                                        y2: "{y}",
                                                        stroke: "#e2e8f0",
                                                        stroke_width: "1",
                                                    }
                                                    text {
                                                        x: "{pad_x - 12.0}",
                                                        y: "{y + 3.5}",
                                                        text_anchor: "end",
                                                        font_size: "10",
                                                        class: "fill-slate-400 font-black",
                                                        "{(f * max_val) as i64}"
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // Areas
                                    path {
                                        d: "{grammar_area}",
                                        fill: "url(#grad-grammar)",
                                        stroke: "none",
                                    }
                                    path {
                                        d: "{vocabulary_area}",
                                        fill: "url(#grad-vocab)",
                                        stroke: "none",
                                    }
                                    path {
                                        d: "{listening_area}",
                                        fill: "url(#grad-listening)",
                                        stroke: "none",
                                    }

                                    // Lines
                                    path {
                                        d: "{grammar_path}",
                                        fill: "none",
                                        stroke: "#6366f1",
                                        stroke_width: "3",
                                        stroke_linecap: "round",
                                    }
                                    path {
                                        d: "{vocabulary_path}",
                                        fill: "none",
                                        stroke: "#ec4899",
                                        stroke_width: "3",
                                        stroke_linecap: "round",
                                    }
                                    path {
                                        d: "{listening_path}",
                                        fill: "none",
                                        stroke: "#f59e0b",
                                        stroke_width: "3",
                                        stroke_linecap: "round",
                                    }

                                    // Data Circles & Date Labels
                                    for (i, p) in skill_points.iter().enumerate() {
                                        {
                                            let x = x_coords[i];
                                            let gy = g_coords[i];
                                            let vy = v_coords[i];
                                            let ly = l_coords[i];
                                            let display_day = if p.day.len() >= 10 {
                                                p.day[5..10].to_string()
                                            } else {
                                                p.day.clone()
                                            };
                                            rsx! {
                                                g {
                                                    // Vertical grid lines
                                                    line {
                                                        x1: "{x}",
                                                        y1: "{pad_y}",
                                                        x2: "{x}",
                                                        y2: "{pad_y + height}",
                                                        stroke: "#f1f5f9",
                                                        stroke_width: "1",
                                                    }

                                                    // Data circles
                                                    circle {
                                                        cx: "{x}",
                                                        cy: "{gy}",
                                                        r: "4",
                                                        fill: "#ffffff",
                                                        stroke: "#6366f1",
                                                        stroke_width: "2.5",
                                                    }
                                                    circle {
                                                        cx: "{x}",
                                                        cy: "{vy}",
                                                        r: "4",
                                                        fill: "#ffffff",
                                                        stroke: "#ec4899",
                                                        stroke_width: "2.5",
                                                    }
                                                    circle {
                                                        cx: "{x}",
                                                        cy: "{ly}",
                                                        r: "4",
                                                        fill: "#ffffff",
                                                        stroke: "#f59e0b",
                                                        stroke_width: "2.5",
                                                    }

                                                    // Date labels
                                                    text {
                                                        x: "{x}",
                                                        y: "{pad_y + height + 18.0}",
                                                        text_anchor: "middle",
                                                        font_size: "10",
                                                        class: "fill-slate-400 font-bold",
                                                        "{display_day}"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // Chart Legends
                            div { class: "flex flex-wrap items-center justify-center gap-6 pt-2",
                                div { class: "flex items-center gap-2 text-xs font-extrabold text-slate-600 dark:text-slate-400",
                                    span { class: "w-3 h-3 rounded-full bg-[#6366f1] inline-block" }
                                    span { "Tata Bahasa (Grammar)" }
                                }
                                div { class: "flex items-center gap-2 text-xs font-extrabold text-slate-600 dark:text-slate-400",
                                    span { class: "w-3 h-3 rounded-full bg-[#ec4899] inline-block" }
                                    span { "Kosakata (Vocabulary)" }
                                }
                                div { class: "flex items-center gap-2 text-xs font-extrabold text-slate-600 dark:text-slate-400",
                                    span { class: "w-3 h-3 rounded-full bg-[#f59e0b] inline-block" }
                                    span { "Pendengaran (Listening)" }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

