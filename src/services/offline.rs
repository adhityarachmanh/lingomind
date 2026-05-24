// src/services/offline.rs
use dioxus::prelude::*;
use crate::models::lesson::LessonContainer;
use crate::models::flashcard::Flashcard;

const OFFLINE_LESSONS_KEY: &str = "lingomind_offline_lessons";
const OFFLINE_FLASHCARDS_KEY: &str = "lingomind_offline_flashcards";

#[cfg(target_arch = "wasm32")]
pub fn save_offline_lesson(language: &str, goal: &str, lesson: &LessonContainer) {
    if let Some(window) = web_sys::window() {
        if let Ok(Some(storage)) = window.local_storage() {
            let key = format!("{}_{}_{}", OFFLINE_LESSONS_KEY, language, goal);
            if let Ok(json) = serde_json::to_string(lesson) {
                let _ = storage.set_item(&key, &json);
            }
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn save_offline_lesson(_language: &str, _goal: &str, _lesson: &LessonContainer) {}

#[cfg(target_arch = "wasm32")]
pub fn get_offline_lesson(language: &str, goal: &str) -> Option<LessonContainer> {
    if let Some(window) = web_sys::window() {
        if let Ok(Some(storage)) = window.local_storage() {
            let key = format!("{}_{}_{}", OFFLINE_LESSONS_KEY, language, goal);
            if let Ok(Some(json)) = storage.get_item(&key) {
                if let Ok(lesson) = serde_json::from_str(&json) {
                    return Some(lesson);
                }
            }
        }
    }
    None
}

#[cfg(not(target_arch = "wasm32"))]
pub fn get_offline_lesson(_language: &str, _goal: &str) -> Option<LessonContainer> { None }

#[cfg(target_arch = "wasm32")]
pub fn save_offline_flashcards(language: &str, flashcards: &Vec<Flashcard>) {
    if let Some(window) = web_sys::window() {
        if let Ok(Some(storage)) = window.local_storage() {
            let key = format!("{}_{}", OFFLINE_FLASHCARDS_KEY, language);
            if let Ok(json) = serde_json::to_string(flashcards) {
                let _ = storage.set_item(&key, &json);
            }
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn save_offline_flashcards(_language: &str, _flashcards: &Vec<Flashcard>) {}

#[cfg(target_arch = "wasm32")]
pub fn get_offline_flashcards(language: &str) -> Option<Vec<Flashcard>> {
    if let Some(window) = web_sys::window() {
        if let Ok(Some(storage)) = window.local_storage() {
            let key = format!("{}_{}", OFFLINE_FLASHCARDS_KEY, language);
            if let Ok(Some(json)) = storage.get_item(&key) {
                if let Ok(flashcards) = serde_json::from_str(&json) {
                    return Some(flashcards);
                }
            }
        }
    }
    None
}

#[cfg(not(target_arch = "wasm32"))]
pub fn get_offline_flashcards(_language: &str) -> Option<Vec<Flashcard>> { None }
