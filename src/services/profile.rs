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
        let stats_row = sqlx::query("SELECT current_streak, longest_streak, active_frame FROM user_engagement_stats WHERE email = $1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal fetch engagement: {}", e)))?;

        let (current_streak, longest_streak, active_frame) = match stats_row {
            Some(row) => (
                row.get("current_streak"),
                row.get("longest_streak"),
                row.try_get::<String, _>("active_frame").ok() // bisa null
            ),
            None => (0, 0, None),
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
            joined_date: "".to_string(),
            badges: vec![],
        })
    }
}
