// Di dalam src/services/mod.rs
pub mod db;
pub mod auth;
#[cfg(not(target_arch = "wasm32"))]
pub mod cron;
pub mod social;
pub mod battle;
pub mod offline;
pub mod gemini; // Compiler otomatis akan mencari ke folder gemini/mod.rs

pub mod flashcard;

pub mod weakness;

pub mod goal;

pub mod mission;
pub mod engagement;
pub mod leaderboard;
pub mod badge;
pub mod shop;
pub mod curriculum;
pub mod admin;
pub mod profile;
pub mod pet;
pub mod dashboard;
