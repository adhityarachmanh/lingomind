use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    dotenvy::dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    // 1. Add columns to user_engagement_stats
    sqlx::query(
        "ALTER TABLE user_engagement_stats 
         ADD COLUMN IF NOT EXISTS double_xp_until TIMESTAMP WITH TIME ZONE,
         ADD COLUMN IF NOT EXISTS has_weekend_amulet BOOLEAN DEFAULT FALSE,
         ADD COLUMN IF NOT EXISTS active_frame VARCHAR(255)"
    )
    .execute(&pool)
    .await?;
    println!("Columns added.");

    // 2. Insert new shop items
    sqlx::query(
        "INSERT INTO shop_items (name, description, cost, effect_type, icon_name) VALUES
         ('Double XP Potion', 'Menggandakan perolehan XP selama 1 jam berikutnya.', 100, 'double_xp', '🧪'),
         ('Weekend Amulet', 'Melindungi streak agar tidak hilang meskipun absen di hari Sabtu & Minggu.', 80, 'weekend_amulet', '🛡️'),
         ('Gold Profile Frame', 'Bingkai profil eksklusif berwarna emas untuk dipamerkan di Leaderboard.', 250, 'profile_frame_gold', '🖼️'),
         ('Mystery Box', 'Buka untuk mendapatkan hadiah acak! Bisa zonk, bisa jackpot!', 50, 'mystery_box', '🎁')
         ON CONFLICT DO NOTHING"
    )
    .execute(&pool)
    .await?;
    println!("Shop items inserted.");

    Ok(())
}
