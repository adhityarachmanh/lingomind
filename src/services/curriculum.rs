// src/services/curriculum.rs
use dioxus::prelude::*;
use crate::models::constants::{LanguageCourse, CurriculumLevel};

#[cfg(feature = "server")]
use sqlx::{PgPool, Row};
#[cfg(feature = "server")]
use std::env;

#[server]
pub async fn get_all_languages() -> Result<Vec<LanguageCourse>, ServerFnError> {
    let database_url = env::var("DATABASE_URL").map_err(|_| ServerFnError::new("DATABASE_URL not set"))?;
    let pool = PgPool::connect(&database_url).await.map_err(|e| ServerFnError::new(e.to_string()))?;

    let rows = sqlx::query("SELECT id, name, native_name, flag, description, theme_class, button_class, category, tts_lang_code, edge_tts_voice FROM languages ORDER BY name ASC")
        .fetch_all(&pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

    let mut languages = Vec::new();
    for row in rows {
        languages.push(LanguageCourse {
            id: row.get("id"),
            name: row.get("name"),
            native_name: row.get("native_name"),
            flag: row.get("flag"),
            description: row.get("description"),
            theme_class: row.get("theme_class"),
            button_class: row.get("button_class"),
            category: row.get("category"),
            tts_lang_code: row.get("tts_lang_code"),
            edge_tts_voice: row.get("edge_tts_voice"),
        });
    }

    Ok(languages)
}

#[server]
pub async fn get_all_curriculum() -> Result<Vec<CurriculumLevel>, ServerFnError> {
    let database_url = env::var("DATABASE_URL").map_err(|_| ServerFnError::new("DATABASE_URL not set"))?;
    let pool = PgPool::connect(&database_url).await.map_err(|e| ServerFnError::new(e.to_string()))?;

    // Fetch levels
    let level_rows = sqlx::query("SELECT id, title, description, base_reward_points, order_index FROM levels ORDER BY order_index ASC")
        .fetch_all(&pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

    let mut curriculum = Vec::new();
    for l_row in level_rows {
        let level_id: String = l_row.get("id");
        
        // Fetch topics for this level
        let topic_rows = sqlx::query("SELECT title FROM topics WHERE level_id = $1 ORDER BY order_index ASC")
            .bind(&level_id)
            .fetch_all(&pool)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;

        let mut topics = Vec::new();
        for t_row in topic_rows {
            topics.push(t_row.get("title"));
        }

        curriculum.push(CurriculumLevel {
            level: level_id,
            title: l_row.get("title"),
            description: l_row.get("description"),
            base_reward_points: l_row.get("base_reward_points"),
            topics,
        });
    }

    Ok(curriculum)
}

#[server]
pub async fn check_exam_cooldown_server(email: String, language: String) -> Result<(bool, String, i32), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let row_opt = sqlx::query("SELECT exam_cooldown_until FROM user_language_progress WHERE email = $1 AND language_id = $2")
            .bind(&email)
            .bind(&language)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;
            
        let mut on_cooldown = false;
        let mut cooldown_msg = String::new();
        
        if let Some(row) = row_opt {
            if let Ok(Some(cooldown)) = row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("exam_cooldown_until") {
                let now = chrono::Utc::now();
                if cooldown > now {
                    on_cooldown = true;
                    let diff = cooldown - now;
                    let hours = diff.num_hours();
                    let mins = diff.num_minutes() % 60;
                    if hours > 0 {
                        cooldown_msg = format!("{} jam {} menit", hours, mins);
                    } else {
                        cooldown_msg = format!("{} menit", mins);
                    }
                }
            }
        }
        
        let stats_row = sqlx::query("SELECT exam_retake_tickets FROM user_engagement_stats WHERE email = $1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;
            
        let tickets = if let Some(sr) = stats_row {
            sr.get::<i32, _>("exam_retake_tickets")
        } else {
            0
        };
        
        Ok((on_cooldown, cooldown_msg, tickets))
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok((false, "".to_string(), 0))
    }
}

#[server]
pub async fn consume_retake_ticket_server(email: String, language: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let mut tx = pool.begin().await.map_err(|e| ServerFnError::new(e.to_string()))?;
        
        let stats_row = sqlx::query("SELECT exam_retake_tickets FROM user_engagement_stats WHERE email = $1")
            .bind(&email)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;
            
        if let Some(sr) = stats_row {
            let tickets = sr.get::<i32, _>("exam_retake_tickets");
            if tickets > 0 {
                sqlx::query("UPDATE user_engagement_stats SET exam_retake_tickets = exam_retake_tickets - 1 WHERE email = $1")
                    .bind(&email)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| ServerFnError::new(e.to_string()))?;
                    
                sqlx::query("UPDATE user_language_progress SET exam_cooldown_until = NULL WHERE email = $1 AND language_id = $2")
                    .bind(&email)
                    .bind(&language)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| ServerFnError::new(e.to_string()))?;
                    
                tx.commit().await.map_err(|e| ServerFnError::new(e.to_string()))?;
                return Ok(());
            } else {
                return Err(ServerFnError::new("Anda tidak memiliki tiket retake exam."));
            }
        }
        
        Err(ServerFnError::new("Data user tidak ditemukan."))
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}
