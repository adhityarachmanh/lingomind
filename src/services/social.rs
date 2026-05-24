// src/services/social.rs
use dioxus::prelude::*;
use crate::models::social::SocialUser;

#[server]
pub async fn search_users_server(query: String, current_user_email: String) -> Result<Vec<SocialUser>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = crate::services::db::get_pool();
        let q = format!("%{}%", query.to_lowercase());
        
        let rows = sqlx::query(
            r#"
            SELECT u.email, u.full_name, u.score,
                   (SELECT COUNT(*) FROM followers WHERE follower_email = $1 AND followed_email = u.email) > 0 as is_following,
                   COALESCE(ue.current_streak, 0) as current_streak,
                   COALESCE(ue.total_quiz_completed, 0) as total_quiz_completed
            FROM users u
            LEFT JOIN user_engagement_stats ue ON u.email = ue.email
            WHERE u.email != $1 AND (LOWER(u.full_name) LIKE $2 OR LOWER(u.email) LIKE $2)
            ORDER BY u.score DESC
            LIMIT 20
            "#
        )
        .bind(&current_user_email)
        .bind(&q)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Database error: {}", e)))?;

        let mut users = Vec::new();
        for (i, row) in rows.into_iter().enumerate() {
            users.push(SocialUser {
                email: row.get("email"),
                full_name: row.get("full_name"),
                is_following: row.get("is_following"),
                score: row.get("score"),
                rank: (i + 1) as i32,
                current_streak: row.get("current_streak"),
                total_quiz_completed: row.get("total_quiz_completed"),
            });
        }
        
        Ok(users)
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(vec![])
    }
}

#[server]
pub async fn toggle_follow_server(follower_email: String, followed_email: String, follow: bool) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let pool = crate::services::db::get_pool();
        if follow {
            sqlx::query("INSERT INTO followers (follower_email, followed_email) VALUES ($1, $2) ON CONFLICT DO NOTHING")
                .bind(&follower_email)
                .bind(&followed_email)
                .execute(pool)
                .await
                .map_err(|e| ServerFnError::new(format!("Gagal follow: {}", e)))?;
        } else {
            sqlx::query("DELETE FROM followers WHERE follower_email = $1 AND followed_email = $2")
                .bind(&follower_email)
                .bind(&followed_email)
                .execute(pool)
                .await
                .map_err(|e| ServerFnError::new(format!("Gagal unfollow: {}", e)))?;
        }
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}

#[server]
pub async fn get_following_leaderboard_server(email: String) -> Result<Vec<SocialUser>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = crate::services::db::get_pool();
        
        let rows = sqlx::query(
            r#"
            SELECT u.email, u.full_name, u.score,
                   COALESCE(ue.current_streak, 0) as current_streak,
                   COALESCE(ue.total_quiz_completed, 0) as total_quiz_completed
            FROM users u
            INNER JOIN followers f ON u.email = f.followed_email AND f.follower_email = $1
            LEFT JOIN user_engagement_stats ue ON u.email = ue.email
            UNION
            SELECT u.email, u.full_name, u.score,
                   COALESCE(ue.current_streak, 0) as current_streak,
                   COALESCE(ue.total_quiz_completed, 0) as total_quiz_completed
            FROM users u
            LEFT JOIN user_engagement_stats ue ON u.email = ue.email
            WHERE u.email = $1
            ORDER BY score DESC
            "#
        )
        .bind(&email)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Database error: {}", e)))?;

        let mut users = Vec::new();
        for (i, row) in rows.into_iter().enumerate() {
            users.push(SocialUser {
                email: row.get("email"),
                full_name: row.get("full_name"),
                is_following: true, // Everyone here is followed or the user themselves
                score: row.get("score"),
                rank: (i + 1) as i32,
                current_streak: row.get("current_streak"),
                total_quiz_completed: row.get("total_quiz_completed"),
            });
        }
        
        Ok(users)
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(vec![])
    }
}
