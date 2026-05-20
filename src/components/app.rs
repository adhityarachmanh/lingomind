// src/components/app.rs
use dioxus::prelude::*;
use crate::models::user::UserProfile;
use crate::models::constants::LANGUAGE_COURSES;
use crate::routes::Route;

const FAVICON: Asset = asset!("/assets/favicon.ico");
const TAILWIND_CSS: Asset = asset!("/assets/tailwind.css");
const LOCAL_STORAGE_KEY: &str = "lingomind_user_session";
const LANGUAGE_STORAGE_KEY: &str = "lingomind_selected_language";

#[component]
pub fn App() -> Element {
    // 1. Sediakan Global State Context. Default diisi (None, false) agar server tidak salah render data.
    let mut session_state = use_context_provider(|| {
        let initial_user: Option<UserProfile> = None;
        Signal::new((initial_user, false)) // false = Sesi belum siap/masih memuat data
    });
    let mut selected_language = use_context_provider(|| Signal::new("English".to_string()));

    // 2. PERBAIKAN: Gunakan use_effect (bukan use_hook) untuk membaca LocalStorage sesaat setelah client-side aktif
    use_effect(move || {
        #[cfg(target_arch = "wasm32")]
        {
            // Logika ini berjalan murni di browser setelah komponen terpasang di layar
            if let Some(window) = web_sys::window() {
                if let Ok(Some(local_storage)) = window.local_storage() {
                    let storage: web_sys::Storage = local_storage;
                    if let Ok(Some(stored_lang)) = storage.get_item(LANGUAGE_STORAGE_KEY) {
                        let is_valid = LANGUAGE_COURSES.iter().any(|c| c.id == stored_lang);
                        if is_valid {
                            selected_language.set(stored_lang);
                        }
                    }
                    if let Ok(Some(stored_json)) = storage.get_item(LOCAL_STORAGE_KEY) {
                        if let Ok(profile) = serde_json::from_str::<UserProfile>(&stored_json) {
                            // Jika sesi ditemukan di LocalStorage, pasang data user dan ubah status ke true (siap)
                            session_state.set((Some(profile), true));
                            return;
                        }
                    }
                }
            }
            // Jika tidak ada data tersimpan, buka gerbang proteksi dengan (None, true)
            session_state.set((None, true));
        }
    });

    // 3. Efek otomatis untuk sinkronisasi data state ke LocalStorage setiap kali ada mutasi data (Login/Logout/Score Update)
    use_effect(move || {
        let (current_profile, is_ready) = session_state();
        
        // Sinkronisasi hanya berjalan jika fase pembacaan awal (fase 2) sudah sukses diselesaikan
        if is_ready {
            #[cfg(target_arch = "wasm32")]
            {
                if let Some(window) = web_sys::window() {
                    if let Ok(Some(local_storage)) = window.local_storage() {
                        let storage: web_sys::Storage = local_storage;
                        let _ = storage.set_item(LANGUAGE_STORAGE_KEY, &selected_language());
                        if let Some(profile) = current_profile {
                            if let Ok(json_string) = serde_json::to_string(&profile) {
                                let _ = storage.set_item(LOCAL_STORAGE_KEY, &json_string);
                            }
                        } else {
                            let _ = storage.remove_item(LOCAL_STORAGE_KEY);
                        }
                    }
                }
            }
        }
    });

    rsx! {
        document::Link { rel: "icon", href: FAVICON }
        document::Link { rel: "stylesheet", href: TAILWIND_CSS }
        Router::<Route> {}
    }
}
