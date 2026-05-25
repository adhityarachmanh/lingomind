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
