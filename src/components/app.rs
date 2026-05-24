// src/components/app.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::models::constants::LANGUAGE_COURSES;
use crate::routes::Route;

const FAVICON: Asset = asset!("/assets/logo.png");
const TAILWIND_CSS: Asset = asset!("/assets/tailwind.css");
#[allow(dead_code)]
const LOCAL_STORAGE_KEY: &str = "lingomind_user_session";
#[allow(dead_code)]
const LEGACY_LANGUAGE_STORAGE_KEY: &str = "lingomind_selected_language";

fn canonical_language_id(input: &str) -> String {
    let trimmed = input.trim();
    LANGUAGE_COURSES
        .iter()
        .find(|c| c.id.eq_ignore_ascii_case(trimmed))
        .map(|c| c.id.to_string())
        .unwrap_or_else(|| "English".to_string())
}

#[component]
pub fn App() -> Element {
    #[allow(unused_mut)]
    let mut session_state = use_context_provider(|| {
        let initial_user: Option<UserProfile> = None;
        Signal::new((initial_user, false))
    });
    let mut selected_language = use_context_provider(|| Signal::new("English".to_string()));
    let mut theme_state = use_context_provider(|| Signal::new("light".to_string()));

    use_effect(move || {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(window) = web_sys::window() {
                if let Ok(Some(local_storage)) = window.local_storage() {
                    if let Ok(Some(stored_theme)) = local_storage.get_item("lingomind_theme") {
                        if stored_theme == "dark" || stored_theme == "light" {
                            theme_state.set(stored_theme);
                        }
                    }
                }
            }
        }
    });

    use_effect(move || {
        let current_theme = theme_state();
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(window) = web_sys::window() {
                if let Some(document) = window.document() {
                    if let Some(doc_element) = document.document_element() {
                        if current_theme == "dark" {
                            let _ = doc_element.class_list().add_1("dark");
                        } else {
                            let _ = doc_element.class_list().remove_1("dark");
                        }
                    }
                }
                if let Ok(Some(local_storage)) = window.local_storage() {
                    let _ = local_storage.set_item("lingomind_theme", &current_theme);
                }
            }
        }
    });

    use_effect(move || {
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
                            let preferred_lang = canonical_language_id(&profile.preferred_language);
                            profile.preferred_language = preferred_lang.clone();
                            selected_language.set(preferred_lang);
                            session_state.set((Some(profile), true));
                            return;
                        }

                        if let Ok(legacy_profile) = serde_json::from_str::<LegacyUserProfile>(&stored_json) {
                            let fallback_lang = match storage.get_item(LEGACY_LANGUAGE_STORAGE_KEY) {
                                Ok(Some(lang)) => canonical_language_id(&lang),
                                _ => "English".to_string(),
                            };
                            let migrated = UserProfile {
                                email: legacy_profile.email,
                                full_name: legacy_profile.full_name,
                                preferred_language: fallback_lang.clone(),
                                score: legacy_profile.score,
                                current_level: legacy_profile.current_level,
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
        let (current_profile, is_ready) = session_state();
        if is_ready {
            if let Some(profile) = current_profile.clone() {
                let preferred_lang = canonical_language_id(&profile.preferred_language);
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
        document::Link { rel: "manifest", href: "/assets/manifest.json" }
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
                    // Coba daftarkan dari root (produksi) agar memiliki scope penuh /
                    navigator.serviceWorker.register('/sw.js')
                        .then(registration => {{
                            console.log('SW registered with root scope:', registration.scope);
                        }})
                        .catch(error => {{
                            console.log('Root SW failed, falling back to assets SW:', error);
                            // Fallback untuk local dev jika /sw.js tidak dimap
                            navigator.serviceWorker.register('/assets/sw.js')
                                .then(reg => {{ console.log('SW registered with assets scope:', reg.scope); }})
                                .catch(err => {{ console.log('Assets SW failed:', err); }});
                        }});
                }});
            }}"
        }
        Router::<Route> {}
    }
}
