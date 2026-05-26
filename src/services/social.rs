// src/services/social.rs
use dioxus::prelude::*;
use crate::models::social::{SocialUser, SocialFeedItem};

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
                   COALESCE(ue.total_quiz_completed, 0) as total_quiz_completed,
                   ue.active_frame,
                   ue.active_title,
                   ue.active_name_color
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
                active_frame: row.try_get::<String, _>("active_frame").ok(),
                active_title: row.try_get::<String, _>("active_title").ok(),
                active_name_color: row.try_get::<String, _>("active_name_color").ok(),
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
                   COALESCE(ue.total_quiz_completed, 0) as total_quiz_completed,
                   ue.active_frame,
                   ue.active_title,
                   ue.active_name_color
            FROM users u
            INNER JOIN followers f ON u.email = f.followed_email AND f.follower_email = $1
            LEFT JOIN user_engagement_stats ue ON u.email = ue.email
            UNION
            SELECT u.email, u.full_name, u.score,
                   COALESCE(ue.current_streak, 0) as current_streak,
                   COALESCE(ue.total_quiz_completed, 0) as total_quiz_completed,
                   ue.active_frame,
                   ue.active_title,
                   ue.active_name_color
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
                active_frame: row.try_get::<String, _>("active_frame").ok(),
                active_title: row.try_get::<String, _>("active_title").ok(),
                active_name_color: row.try_get::<String, _>("active_name_color").ok(),
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
pub async fn log_activity_server(email: String, activity_type: String, content: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let pool = crate::services::db::get_pool();
        sqlx::query(
            r#"
            INSERT INTO social_feed (email, activity_type, content)
            VALUES ($1, $2, $3)
            "#
        )
        .bind(&email)
        .bind(&activity_type)
        .bind(&content)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Failed to log activity: {}", e)))?;
        
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}

#[server]
pub async fn like_activity_server(feed_id: i32, liker_email: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let pool = crate::services::db::get_pool();
        
        let mut tx = pool.begin().await.map_err(|e| ServerFnError::new(format!("Transaction error: {}", e)))?;
        
        let result = sqlx::query("INSERT INTO social_feed_likes (feed_id, liker_email) VALUES ($1, $2) ON CONFLICT DO NOTHING")
            .bind(feed_id)
            .bind(&liker_email)
            .execute(&mut *tx)
            .await
            .map_err(|e| ServerFnError::new(format!("Failed to add like: {}", e)))?;
            
        if result.rows_affected() > 0 {
            sqlx::query("UPDATE social_feed SET likes_count = likes_count + 1 WHERE id = $1")
                .bind(feed_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| ServerFnError::new(format!("Failed to update likes count: {}", e)))?;
        }
        
        tx.commit().await.map_err(|e| ServerFnError::new(format!("Failed to commit like: {}", e)))?;
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}

#[server]
pub async fn get_social_feed_server(current_user_email: String) -> Result<Vec<SocialFeedItem>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = crate::services::db::get_pool();
        
        let rows = sqlx::query(
            r#"
            SELECT sf.id, sf.email, u.full_name, 
                   COALESCE(vp.emoji, '👤') as emoji, 
                   sf.activity_type, sf.content, sf.likes_count, 
                   sf.created_at,
                   (SELECT COUNT(*) FROM social_feed_likes sfl WHERE sfl.feed_id = sf.id AND sfl.liker_email = $1) > 0 as has_liked
            FROM social_feed sf
            INNER JOIN users u ON sf.email = u.email
            LEFT JOIN virtual_pets vp ON u.email = vp.email AND vp.is_active = true
            WHERE sf.email = $1 OR sf.email IN (SELECT followed_email FROM followers WHERE follower_email = $1)
            ORDER BY sf.created_at DESC
            LIMIT 50
            "#
        )
        .bind(&current_user_email)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Database error: {}", e)))?;

        let mut feed = Vec::new();
        for row in rows {
            let dt: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let created_at_str = dt.format("%d %b %Y, %H:%M").to_string();
            
            feed.push(SocialFeedItem {
                id: row.get("id"),
                email: row.get("email"),
                full_name: row.get("full_name"),
                emoji: row.get("emoji"),
                activity_type: row.get("activity_type"),
                content: row.get("content"),
                likes_count: row.get("likes_count"),
                created_at: created_at_str,
                has_liked: row.get("has_liked"),
            });
        }
        
        Ok(feed)
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(vec![])
    }
}
