// src/components/app.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::models::constants::{LanguageCourse, CurriculumLevel};
use crate::services::curriculum::{get_all_languages, get_all_curriculum};
use crate::routes::Route;

const FAVICON: Asset = asset!("/assets/logo.png");
const TAILWIND_CSS: Asset = asset!("/assets/tailwind.css");
#[allow(dead_code)]
const LOCAL_STORAGE_KEY: &str = "lingomind_user_session";
#[allow(dead_code)]
const LEGACY_LANGUAGE_STORAGE_KEY: &str = "lingomind_selected_language";

fn canonical_language_id(input: &str, languages: &[LanguageCourse]) -> String {
    let trimmed = input.trim();
    languages
        .iter()
        .find(|c| c.id.eq_ignore_ascii_case(trimmed))
        .map(|c| c.id.to_string())
        .unwrap_or_else(|| "English".to_string())
}

#[component]
pub fn App() -> Element {
    let languages = use_resource(move || async move {
        get_all_languages().await.unwrap_or_default()
    });
    let curriculum = use_resource(move || async move {
        get_all_curriculum().await.unwrap_or_default()
    });

    use_context_provider(|| languages);
    use_context_provider(|| curriculum);

    #[allow(unused_mut)]
    let mut session_state = use_context_provider(|| {
        let initial_user: Option<UserProfile> = None;
        Signal::new((initial_user, false))
    });
    let mut selected_language = use_context_provider(|| Signal::new("English".to_string()));
    let mut is_dark_mode = use_context_provider(|| Signal::new(false));

    use_effect(move || {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(window) = web_sys::window() {
                if let Ok(Some(local_storage)) = window.local_storage() {
                    if let Ok(Some(stored_theme)) = local_storage.get_item("lingomind_theme") {
                        if stored_theme == "dark" {
                            is_dark_mode.set(true);
                        } else if stored_theme == "light" {
                            is_dark_mode.set(false);
                        }
                    }
                }
            }
        }
    });

    use_effect(move || {
        let dark_mode = is_dark_mode();
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(window) = web_sys::window() {
                if let Some(document) = window.document() {
                    if let Some(doc_element) = document.document_element() {
                        if dark_mode {
                            let _ = doc_element.class_list().add_1("dark");
                        } else {
                            let _ = doc_element.class_list().remove_1("dark");
                        }
                    }
                }
                if let Ok(Some(local_storage)) = window.local_storage() {
                    let _ = local_storage.set_item("lingomind_theme", if dark_mode { "dark" } else { "light" });
                }
            }
        }
    });

    use_effect(move || {
        let Some(langs) = languages() else { return; };
        #[cfg(target_arch = "wasm32")]
        {
            #[derive(serde::Deserialize)]
            struct LegacyUserProfile {
                email: String,
                full_name: String,
                score: i32,
                current_level: std::collections::HashMap<String, String>,
            }

            if let Some(window) = web_sys::window() {
                if let Ok(Some(local_storage)) = window.local_storage() {
                    let storage: web_sys::Storage = local_storage;
                    if let Ok(Some(stored_json)) = storage.get_item(LOCAL_STORAGE_KEY) {
                        if let Ok(mut profile) = serde_json::from_str::<UserProfile>(&stored_json) {
                            let preferred_lang = canonical_language_id(&profile.preferred_language, &langs);
                            profile.preferred_language = preferred_lang.clone();
                            selected_language.set(preferred_lang);
                            session_state.set((Some(profile), true));
                            return;
                        }

                        if let Ok(legacy_profile) = serde_json::from_str::<LegacyUserProfile>(&stored_json) {
                            let fallback_lang = match storage.get_item(LEGACY_LANGUAGE_STORAGE_KEY) {
                                Ok(Some(lang)) => canonical_language_id(&lang, &langs),
                                _ => "English".to_string(),
                            };
                            let migrated = UserProfile {
                                email: legacy_profile.email,
                                full_name: legacy_profile.full_name,
                                preferred_language: fallback_lang.clone(),
                                score: legacy_profile.score,
                                current_level: legacy_profile.current_level,
                                role: "user".to_string(),
                            };
                            selected_language.set(fallback_lang);
                            session_state.set((Some(migrated), true));
                            return;
                        }
                    }
                }
            }
            session_state.set((None, true));
        }
    });

    use_effect(move || {
        let Some(langs) = languages() else { return; };
        let (current_profile, is_ready) = session_state();
        if is_ready {
            if let Some(profile) = current_profile.clone() {
                let preferred_lang = canonical_language_id(&profile.preferred_language, &langs);
                if selected_language() != preferred_lang {
                    selected_language.set(preferred_lang);
                    return;
                }
            }

            #[cfg(target_arch = "wasm32")]
            {
                if let Some(window) = web_sys::window() {
                    if let Ok(Some(local_storage)) = window.local_storage() {
                        let storage: web_sys::Storage = local_storage;
                        if let Some(profile) = current_profile {
                            if let Ok(json_string) = serde_json::to_string(&profile) {
                                let _ = storage.set_item(LOCAL_STORAGE_KEY, &json_string);
                            }
                            let _ = storage.remove_item(LEGACY_LANGUAGE_STORAGE_KEY);
                        } else {
                            let _ = storage.remove_item(LOCAL_STORAGE_KEY);
                            let _ = storage.remove_item(LEGACY_LANGUAGE_STORAGE_KEY);
                        }
                    }
                }
            }
        }
    });

    rsx! {
        document::Meta { name: "theme-color", content: "#14b8a6" }
        document::Meta { name: "apple-mobile-web-app-capable", content: "yes" }
        document::Meta { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" }
        document::Link { rel: "manifest", href: "/manifest.json" }
        document::Link { rel: "apple-touch-icon", href: "/assets/icon.svg" }
        document::Link { rel: "icon", href: FAVICON }
        document::Link { rel: "stylesheet", href: TAILWIND_CSS }
        document::Script {
            "if (localStorage.getItem('lingomind_theme') === 'dark' || (!('lingomind_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {{
                document.documentElement.classList.add('dark');
            }} else {{
                document.documentElement.classList.remove('dark');
            }}"
        }
        document::Script { src: "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js" }
        document::Script {
            "if ('serviceWorker' in navigator) {{
                window.addEventListener('load', () => {{
                    navigator.serviceWorker.register('/sw.js')
                        .then(registration => {{
                            console.log('SW registered with root scope:', registration.scope);
                        }})
                        .catch(error => {{
                            console.log('SW registration failed:', error);
                        }});
                }});
            }}"
        }
        if languages().is_none() || curriculum().is_none() {
            div { class: "flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300",
                div { class: "relative flex items-center justify-center mb-6",
                    div { class: "absolute inset-0 bg-teal-500/20 dark:bg-teal-400/20 rounded-full blur-2xl animate-pulse" }
                    img {
                        src: FAVICON,
                        alt: "LingoMind Logo",
                        class: "w-28 h-28 sm:w-36 sm:h-36 object-contain relative z-10 animate-bounce"
                    }
                }
                h2 { class: "text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-emerald-400 mb-6 drop-shadow-sm",
                    "LingoMind"
                }
                div { class: "flex flex-col items-center gap-4",
                    div { class: "flex items-center gap-3",
                        i { class: "fa-solid fa-circle-notch fa-spin text-teal-500 text-xl" }
                        span { class: "text-slate-600 dark:text-slate-300 font-medium tracking-wide", "Memuat Aplikasi..." }
                    }
                    div { class: "w-64 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner",
                        div { class: "h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-[60%]" }
                    }
                }
            }
        } else {
            Router::<Route> {}
        }
    }
}
