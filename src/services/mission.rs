use dioxus::prelude::*;
use crate::models::mission::DailyMission;

#[server]
pub async fn get_daily_mission_server(email: String, language: String) -> Result<DailyMission, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;

        let pool = super::db::get_pool();

        let due_row = sqlx::query("SELECT COUNT(*)::bigint AS cnt FROM flashcards WHERE email = $1 AND language = $2 AND due_at <= NOW()")
            .bind(&email)
            .bind(&language)
            .fetch_one(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal hitung due flashcard: {e}")))?;
        let due_count: i64 = due_row.get("cnt");

        let weak_row = sqlx::query("SELECT COUNT(*)::bigint AS cnt FROM weakness_logs WHERE email = $1 AND language = $2 AND created_at >= NOW() - INTERVAL '7 days'")
            .bind(&email)
            .bind(&language)
            .fetch_one(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal hitung weakness: {e}")))?;
        let weak_7d: i64 = weak_row.get("cnt");

        // Fetch config
        let mut lesson_target = 1;
        let mut quiz_target = 1;
        let mut base_weakness_target = 3;
        let mut fc_min = 5;
        let mut fc_max = 15;

        if let Ok(Some(cfg)) = sqlx::query("SELECT lesson_target, quiz_target, weakness_target, flashcard_target_min, flashcard_target_max FROM mission_config WHERE name = 'Daily Standard' LIMIT 1")
            .fetch_optional(pool)
            .await
        {
            lesson_target = cfg.get("lesson_target");
            quiz_target = cfg.get("quiz_target");
            base_weakness_target = cfg.get("weakness_target");
            fc_min = cfg.get("flashcard_target_min");
            fc_max = cfg.get("flashcard_target_max");
        }

        let flash_target = if due_count <= 0 { fc_min } else { (due_count as i32).min(fc_max) };
        let weakness_target = if weak_7d >= 10 { base_weakness_target + 2 } else { base_weakness_target };

        Ok(DailyMission {
            language,
            lesson_target,
            quiz_target,
            weakness_target,
            flashcard_target: flash_target,
        })
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(DailyMission {
            language,
            lesson_target: 1,
            quiz_target: 1,
            weakness_target: 3,
            flashcard_target: 5,
        })
    }
}
