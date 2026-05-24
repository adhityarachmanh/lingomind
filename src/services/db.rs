// src/services/db.rs

#[cfg(not(target_arch = "wasm32"))]
mod server_db {
    use sqlx::PgPool;
    use tokio::sync::OnceCell;

    static DB_POOL: OnceCell<PgPool> = OnceCell::const_new();

    pub async fn init_db() -> Result<(), Box<dyn std::error::Error>> {
        dotenvy::dotenv().ok();
        let database_url = std::env::var("DATABASE_URL")
            .map_err(|_| "DATABASE_URL tidak ditemukan di .env")?;

        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(20)
            .acquire_timeout(std::time::Duration::from_secs(60))
            .connect(&database_url).await?;

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await?;

        let _ = DB_POOL.set(pool);
        Ok(())
    }

    pub fn get_pool() -> &'static PgPool {
        DB_POOL.get().expect("Database pool belum diinisialisasi.")
    }
}

// Ekspos fungsi hanya jika dikompilasi di sisi server asli
#[cfg(not(target_arch = "wasm32"))]
pub use server_db::{init_db, get_pool};

// Sediakan mock kosong agar frontend WASM tidak error saat proses build
#[cfg(target_arch = "wasm32")]
pub async fn init_db() -> Result<(), String> { Ok(()) }