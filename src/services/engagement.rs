use dioxus::prelude::*;
use crate::models::engagement::UserEngagementStats;

#[server]
pub async fn update_engagement_after_quiz_server(email: String, points_earned: i32) -> Result<(), ServerFnError> {
    let pool = super::db::get_pool();
    sqlx::query(
        "INSERT INTO user_engagement_stats (email, current_streak, longest_streak, total_quiz_completed, total_points_earned, last_active_date)
         VALUES ($1, 1, 1, 1, $2, CURRENT_DATE)
         ON CONFLICT (email) DO UPDATE
         SET total_quiz_completed = user_engagement_stats.total_quiz_completed + 1,
             total_points_earned = user_engagement_stats.total_points_earned + EXCLUDED.total_points_earned,
             current_streak = CASE
                 WHEN user_engagement_stats.last_active_date = CURRENT_DATE THEN user_engagement_stats.current_streak
                 WHEN user_engagement_stats.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN user_engagement_stats.current_streak + 1
                 ELSE 1
             END,
             longest_streak = GREATEST(
                 user_engagement_stats.longest_streak,
                 CASE
                     WHEN user_engagement_stats.last_active_date = CURRENT_DATE THEN user_engagement_stats.current_streak
                     WHEN user_engagement_stats.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN user_engagement_stats.current_streak + 1
                     ELSE 1
                 END
             ),
             last_active_date = CURRENT_DATE"
    )
    .bind(email)
    .bind(points_earned)
    .execute(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal update engagement: {e}")))?;
    Ok(())
}

#[server]
pub async fn get_engagement_stats_server(email: String) -> Result<UserEngagementStats, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;
    let pool = super::db::get_pool();
    let row_opt = sqlx::query("SELECT current_streak, longest_streak, total_quiz_completed, total_points_earned FROM user_engagement_stats WHERE email = $1 LIMIT 1")
        .bind(email)
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal ambil stats: {e}")))?;
    if let Some(row) = row_opt {
        Ok(UserEngagementStats {
            current_streak: row.get("current_streak"),
            longest_streak: row.get("longest_streak"),
            total_quiz_completed: row.get("total_quiz_completed"),
            total_points_earned: row.get("total_points_earned"),
        })
    } else {
        Ok(UserEngagementStats { current_streak: 0, longest_streak: 0, total_quiz_completed: 0, total_points_earned: 0 })
    }
}
