#[cfg(not(target_arch = "wasm32"))]
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL tidak ditemukan di .env")?;

    let pool = sqlx::PgPool::connect(&database_url).await?;

    sqlx::query("DROP SCHEMA IF EXISTS public CASCADE;")
        .execute(&pool)
        .await?;
    sqlx::query("CREATE SCHEMA public;").execute(&pool).await?;
    sqlx::query("GRANT ALL ON SCHEMA public TO postgres;")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("GRANT ALL ON SCHEMA public TO public;")
        .execute(&pool)
        .await
        .ok();

    println!("Database schema public berhasil di-reset.");
    Ok(())
}

#[cfg(target_arch = "wasm32")]
fn main() {}
