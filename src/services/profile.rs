use dioxus::prelude::*;
use crate::models::user::PublicProfile;
use crate::models::badge::Badge;

#[server]
pub async fn get_public_profile_server(email: String) -> Result<PublicProfile, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = crate::services::db::get_pool();
        
        // Dapatkan data dasar user
        let user_row = sqlx::query("SELECT full_name, score FROM users WHERE email = $1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal fetch user: {}", e)))?;

        let user = match user_row {
            Some(row) => row,
            None => return Err(ServerFnError::new("Pengguna tidak ditemukan")),
        };

        let full_name: String = user.get("full_name");
        let score: i32 = user.get("score");

        // Dapatkan data engagement
        let stats_row = sqlx::query("SELECT current_streak, longest_streak, active_frame, active_title, active_name_color FROM user_engagement_stats WHERE email = $1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal fetch engagement: {}", e)))?;

        let (current_streak, longest_streak, active_frame, active_title, active_name_color) = match stats_row {
            Some(row) => (
                row.get("current_streak"),
                row.get("longest_streak"),
                row.try_get::<String, _>("active_frame").ok(),
                row.try_get::<String, _>("active_title").ok(),
                row.try_get::<String, _>("active_name_color").ok()
            ),
            None => (0, 0, None, None, None),
        };

        // Dapatkan badges
        let badge_rows = sqlx::query(
            "SELECT b.id, b.name, b.description, b.icon_name, b.requirement_type, b.requirement_value 
             FROM badges b 
             JOIN user_badges ub ON b.id = ub.badge_id 
             WHERE ub.email = $1 
             ORDER BY ub.earned_at DESC"
        )
        .bind(&email)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal ambil daftar badge: {}", e)))?;

        let mut badges = Vec::new();
        for row in badge_rows {
            badges.push(Badge {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                icon_name: row.get("icon_name"),
                requirement_type: row.get("requirement_type"),
                requirement_value: row.get("requirement_value"),
            });
        }

        Ok(PublicProfile {
            email: email.clone(),
            full_name,
            score,
            current_streak,
            longest_streak,
            active_frame,
            active_title,
            active_name_color,
            joined_date: "Member".to_string(), // Kita tidak ada created_at, biarkan statis
            badges,
        })
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(PublicProfile {
            email: "".to_string(),
            full_name: "".to_string(),
            score: 0,
            current_streak: 0,
            longest_streak: 0,
            active_frame: None,
            active_title: None,
            active_name_color: None,
            joined_date: "".to_string(),
            badges: vec![],
        })
    }
}

#[server]
pub async fn get_user_frames_server(email: String) -> Result<Vec<String>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = crate::services::db::get_pool();
        let rows = sqlx::query("SELECT item_value FROM user_inventory WHERE email = $1 AND item_type LIKE 'profile_frame_%'")
            .bind(&email).fetch_all(pool).await.map_err(|e| ServerFnError::new(e.to_string()))?;
        Ok(rows.into_iter().map(|r| r.get("item_value")).collect())
    }
    #[cfg(target_arch = "wasm32")]
    { Ok(vec![]) }
}

#[server]
pub async fn get_user_titles_server(email: String) -> Result<Vec<String>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = crate::services::db::get_pool();
        let rows = sqlx::query("SELECT item_value FROM user_inventory WHERE email = $1 AND item_type LIKE 'title_%'")
            .bind(&email).fetch_all(pool).await.map_err(|e| ServerFnError::new(e.to_string()))?;
        Ok(rows.into_iter().map(|r| r.get("item_value")).collect())
    }
    #[cfg(target_arch = "wasm32")]
    { Ok(vec![]) }
}

#[server]
pub async fn get_user_colors_server(email: String) -> Result<Vec<String>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = crate::services::db::get_pool();
        let rows = sqlx::query("SELECT item_value FROM user_inventory WHERE email = $1 AND item_type LIKE 'name_color_%'")
            .bind(&email).fetch_all(pool).await.map_err(|e| ServerFnError::new(e.to_string()))?;
        Ok(rows.into_iter().map(|r| r.get("item_value")).collect())
    }
    #[cfg(target_arch = "wasm32")]
    { Ok(vec![]) }
}

#[server]
pub async fn equip_frame_server(email: String, frame: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let pool = crate::services::db::get_pool();
        let frame_opt = if frame.is_empty() { None } else { Some(frame) };
        sqlx::query("UPDATE user_engagement_stats SET active_frame = $1 WHERE email = $2")
            .bind(frame_opt).bind(&email).execute(pool).await.map_err(|e| ServerFnError::new(e.to_string()))?;
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    { Ok(()) }
}

#[server]
pub async fn equip_title_server(email: String, title: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let pool = crate::services::db::get_pool();
        let title_opt = if title.is_empty() { None } else { Some(title) };
        sqlx::query("UPDATE user_engagement_stats SET active_title = $1 WHERE email = $2")
            .bind(title_opt).bind(&email).execute(pool).await.map_err(|e| ServerFnError::new(e.to_string()))?;
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    { Ok(()) }
}

#[server]
pub async fn equip_color_server(email: String, color: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let pool = crate::services::db::get_pool();
        let color_opt = if color.is_empty() { None } else { Some(color) };
        sqlx::query("UPDATE user_engagement_stats SET active_name_color = $1 WHERE email = $2")
            .bind(color_opt).bind(&email).execute(pool).await.map_err(|e| ServerFnError::new(e.to_string()))?;
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    { Ok(()) }
}

#[server]
pub async fn get_profile_summary_server(target_email: String, requesting_email: String) -> Result<crate::models::user::ProfileSummary, ServerFnError> {
    let profile_res = get_public_profile_server(target_email.clone()).await?;
    
    let mut frames = vec![];
    let mut titles = vec![];
    let mut colors = vec![];
    
    if target_email == requesting_email {
        let (f_res, t_res, c_res) = tokio::join!(
            get_user_frames_server(target_email.clone()),
            get_user_titles_server(target_email.clone()),
            get_user_colors_server(target_email)
        );
        frames = f_res.unwrap_or_default();
        titles = t_res.unwrap_or_default();
        colors = c_res.unwrap_or_default();
    }
    
    Ok(crate::models::user::ProfileSummary {
        profile: profile_res,
        frames,
        titles,
        colors,
    })
}
