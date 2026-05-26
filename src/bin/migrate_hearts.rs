use sqlx::PgPool;
use std::env;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    dotenvy::dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;

    sqlx::query("ALTER TABLE user_engagement_stats ADD COLUMN IF NOT EXISTS hearts INT NOT NULL DEFAULT 5")
        .execute(&pool)
        .await?;

    sqlx::query("ALTER TABLE user_engagement_stats ADD COLUMN IF NOT EXISTS last_heart_refill TIMESTAMP WITH TIME ZONE")
        .execute(&pool)
        .await?;

    println!("Migration for Hearts applied successfully!");
    Ok(())
}
