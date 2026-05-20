// src/main.rs
use dioxus::prelude::*;

// Deklarasikan semua modul/file terpisah agar dikenali oleh compiler Rust
pub mod models;
pub mod services;
pub mod components;
pub mod views;
pub mod routes; // Modul rute baru

// Re-export Route agar bisa di-use dengan mudah dari crate root jika dibutuhkan
pub use routes::Route;

fn main() {
    // Jalankan inisialisasi database & migration HANYA jika berjalan di sisi server (bukan di WASM client)
    #[cfg(not(target_arch = "wasm32"))]
    {
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async {
                if let Err(err) = services::db::init_db().await {
                    eprintln!("Gagal menginisialisasi database / migration: {}", err);
                    std::process::exit(1);
                }
                println!("Database Neon PostgreSQL berhasil terhubung & Migration sukses diterapkan! 🚀");
            });
    }

    // Meluncurkan aplikasi Dioxus Fullstack dengan root component App
    dioxus::launch(components::app::App);
}