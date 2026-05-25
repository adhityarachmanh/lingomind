use dioxus::prelude::*;
use crate::models::engagement::UserEngagementStats;

#[server]
pub async fn update_engagement_after_quiz_server(email: String, points_earned: i32) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let mut coin_reward = 10;
        if let Ok(Some(row)) = sqlx::query("SELECT value FROM app_config WHERE key = 'quiz_completion_coins' LIMIT 1")
            .fetch_optional(pool)
            .await
        {
            if let Ok(val) = row.get::<String, _>("value").parse::<i32>() {
                coin_reward = val;
            }
        }

        sqlx::query(
            "INSERT INTO user_engagement_stats (email, current_streak, longest_streak, total_quiz_completed, total_points_earned, last_active_date, coins, streak_freezes)
             VALUES ($1, 1, 1, 1, $2, CURRENT_DATE, $3, 0)
             ON CONFLICT (email) DO UPDATE
             SET total_quiz_completed = user_engagement_stats.total_quiz_completed + 1,
                 total_points_earned = user_engagement_stats.total_points_earned + EXCLUDED.total_points_earned,
                 coins = user_engagement_stats.coins + $3,
                 current_streak = CASE
                     WHEN user_engagement_stats.last_active_date >= CURRENT_DATE THEN user_engagement_stats.current_streak
                     WHEN user_engagement_stats.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN user_engagement_stats.current_streak + 1
                     WHEN user_engagement_stats.streak_freezes >= (CURRENT_DATE - user_engagement_stats.last_active_date - 1) THEN user_engagement_stats.current_streak + 1
                     ELSE 1
                 END,
                 streak_freezes = CASE
                     WHEN user_engagement_stats.last_active_date < CURRENT_DATE - INTERVAL '1 day' AND user_engagement_stats.streak_freezes >= (CURRENT_DATE - user_engagement_stats.last_active_date - 1) THEN user_engagement_stats.streak_freezes - (CURRENT_DATE - user_engagement_stats.last_active_date - 1)
                     ELSE user_engagement_stats.streak_freezes
                 END,
                 longest_streak = GREATEST(
                     user_engagement_stats.longest_streak,
                     CASE
                         WHEN user_engagement_stats.last_active_date >= CURRENT_DATE THEN user_engagement_stats.current_streak
                         WHEN user_engagement_stats.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN user_engagement_stats.current_streak + 1
                         WHEN user_engagement_stats.streak_freezes >= (CURRENT_DATE - user_engagement_stats.last_active_date - 1) THEN user_engagement_stats.current_streak + 1
                         ELSE 1
                     END
                 ),
                 last_active_date = CURRENT_DATE"
        )
        .bind(email.clone())
        .bind(points_earned)
        .bind(coin_reward)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal update engagement: {e}")))?;
        
        // Evaluate badges
        let _ = super::badge::evaluate_and_award_badges_server(email).await;
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}

#[server]
pub async fn get_engagement_stats_server(email: String) -> Result<UserEngagementStats, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;
    let pool = super::db::get_pool();
    let row_opt = sqlx::query("SELECT current_streak, longest_streak, total_quiz_completed, total_points_earned, coins, streak_freezes FROM user_engagement_stats WHERE email = $1 LIMIT 1")
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
            coins: row.get("coins"),
            streak_freezes: row.get("streak_freezes"),
        })
    } else {
        Ok(UserEngagementStats { current_streak: 0, longest_streak: 0, total_quiz_completed: 0, total_points_earned: 0, coins: 0, streak_freezes: 0 })
    }
}
