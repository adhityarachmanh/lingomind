use sqlx::postgres::PgPoolOptions;
use bcrypt::{hash, DEFAULT_COST};
use dotenvy::dotenv;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&db_url)
        .await?;

    let new_password = "Arh10310!";
    let hashed = hash(new_password, DEFAULT_COST).unwrap();

    let email = "admin@lingomind.com";

    let result = sqlx::query("UPDATE users SET password_hash = $1 WHERE email = $2")
        .bind(&hashed)
        .bind(email)
        .execute(&pool)
        .await?;

    println!("Rows affected: {}", result.rows_affected());
    println!("Successfully updated password for {}", email);

    Ok(())
}
