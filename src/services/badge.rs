use dioxus::prelude::*;
use crate::models::badge::Badge;

#[server]
pub async fn evaluate_and_award_badges_server(email: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        // Dapatkan stats user saat ini
        let stats_opt = sqlx::query("SELECT current_streak, total_quiz_completed, coins FROM user_engagement_stats WHERE email = $1 LIMIT 1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal fetch stats untuk badge: {e}")))?;

        if let Some(stats) = stats_opt {
            let streak: i32 = stats.get("current_streak");
            let quizzes: i32 = stats.get("total_quiz_completed");
            let coins: i32 = stats.get("coins");

            // Ambil semua badges yang belum dimiliki user
            let available_badges = sqlx::query(
                "SELECT id, requirement_type, requirement_value FROM badges 
                 WHERE id NOT IN (SELECT badge_id FROM user_badges WHERE email = $1)"
            )
            .bind(&email)
            .fetch_all(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal fetch badges: {e}")))?;

            for row in available_badges {
                let badge_id: i32 = row.get("id");
                let req_type: String = row.get("requirement_type");
                let req_val: i32 = row.get("requirement_value");

                let mut awarded = false;
                match req_type.as_str() {
                    "quiz_completed" => if quizzes >= req_val { awarded = true; },
                    "streak" => if streak >= req_val { awarded = true; },
                    "coins" => if coins >= req_val { awarded = true; },
                    _ => {}
                }

                if awarded {
                    sqlx::query("INSERT INTO user_badges (email, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
                        .bind(&email)
                        .bind(badge_id)
                        .execute(pool)
                        .await
                        .map_err(|e| ServerFnError::new(format!("Gagal insert user badge: {e}")))?;
                }
            }
        }
    }
    Ok(())
}

#[server]
pub async fn get_user_badges_server(email: String) -> Result<Vec<Badge>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        let rows = sqlx::query(
            "SELECT b.id, b.name, b.description, b.icon_name, b.requirement_type, b.requirement_value 
             FROM badges b 
             JOIN user_badges ub ON b.id = ub.badge_id 
             WHERE ub.email = $1 
             ORDER BY ub.earned_at DESC"
        )
        .bind(email)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal ambil daftar badge: {e}")))?;

        let mut badges = Vec::new();
        for row in rows {
            badges.push(Badge {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                icon_name: row.get("icon_name"),
                requirement_type: row.get("requirement_type"),
                requirement_value: row.get("requirement_value"),
            });
        }
        Ok(badges)
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(vec![])
    }
}

#[server]
pub async fn get_all_badges_server() -> Result<Vec<Badge>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        let rows = sqlx::query("SELECT id, name, description, icon_name, requirement_type, requirement_value FROM badges ORDER BY requirement_value ASC")
            .fetch_all(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal ambil semua badge: {e}")))?;

        let mut badges = Vec::new();
        for row in rows {
            badges.push(Badge {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                icon_name: row.get("icon_name"),
                requirement_type: row.get("requirement_type"),
                requirement_value: row.get("requirement_value"),
            });
        }
        Ok(badges)
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(vec![])
    }
}
