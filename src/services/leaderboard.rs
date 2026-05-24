// src/services/leaderboard.rs
use dioxus::prelude::*;
use crate::models::leaderboard::LeaderboardEntry;

#[server]
pub async fn get_leaderboard_server(limit: i32) -> Result<Vec<LeaderboardEntry>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let pool = super::db::get_pool();
    let safe_limit = limit.clamp(10, 100);

    let rows = sqlx::query(
        r#"
            SELECT u.email, u.full_name, u.score,
                   COALESCE(e.current_streak, 0) AS current_streak,
                   COALESCE(e.total_quiz_completed, 0) AS total_quiz_completed
            FROM users u
            LEFT JOIN user_engagement_stats e ON u.email = e.email
            ORDER BY u.score DESC
            LIMIT $1"#
    )
    .bind(safe_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal mengambil data leaderboard: {e}")))?;

    let mut entries = Vec::new();
    for (i, row) in rows.into_iter().enumerate() {
        entries.push(LeaderboardEntry {
            rank: (i + 1) as i32,
            email: row.get("email"),
            full_name: row.get("full_name"),
            score: row.get::<Option<i32>, _>("score").unwrap_or(0),
            current_streak: row.get("current_streak"),
            total_quiz_completed: row.get("total_quiz_completed"),
        });
    }

    Ok(entries)
}
