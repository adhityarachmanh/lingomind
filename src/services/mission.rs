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

        // Fetch or create user progress for today
        let progress_row = sqlx::query(
            "INSERT INTO user_daily_missions (email, date)
             VALUES ($1, CURRENT_DATE)
             ON CONFLICT (email, date) DO NOTHING
             RETURNING lessons_completed, quizzes_completed, weakness_practices_completed, flashcards_reviewed, is_completed, reward_claimed"
        )
        .bind(&email)
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal membuat progress misi: {e}")))?;

        let (mut lp, mut qp, mut wp, mut fp, mut ic, mut rc) = (0, 0, 0, 0, false, false);
        
        if let Some(r) = progress_row {
            lp = r.get("lessons_completed");
            qp = r.get("quizzes_completed");
            wp = r.get("weakness_practices_completed");
            fp = r.get("flashcards_reviewed");
            ic = r.get("is_completed");
            rc = r.get("reward_claimed");
        } else {
            // It already existed, just select it
            if let Ok(Some(r)) = sqlx::query(
                "SELECT lessons_completed, quizzes_completed, weakness_practices_completed, flashcards_reviewed, is_completed, reward_claimed
                 FROM user_daily_missions
                 WHERE email = $1 AND date = CURRENT_DATE"
            )
            .bind(&email)
            .fetch_optional(pool)
            .await
            {
                lp = r.get("lessons_completed");
                qp = r.get("quizzes_completed");
                wp = r.get("weakness_practices_completed");
                fp = r.get("flashcards_reviewed");
                ic = r.get("is_completed");
                rc = r.get("reward_claimed");
            }
        }

        // Auto-complete check
        if !ic && lp >= lesson_target && qp >= quiz_target && wp >= weakness_target && fp >= flash_target {
            ic = true;
            let _ = sqlx::query("UPDATE user_daily_missions SET is_completed = TRUE WHERE email = $1 AND date = CURRENT_DATE")
                .bind(&email)
                .execute(pool)
                .await;
        }

        Ok(DailyMission {
            language,
            lesson_target,
            quiz_target,
            weakness_target,
            flashcard_target: flash_target,
            lesson_progress: lp,
            quiz_progress: qp,
            weakness_progress: wp,
            flashcard_progress: fp,
            is_completed: ic,
            reward_claimed: rc,
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
            lesson_progress: 0,
            quiz_progress: 0,
            weakness_progress: 0,
            flashcard_progress: 0,
            is_completed: false,
            reward_claimed: false,
        })
    }
}

#[server]
pub async fn increment_mission_progress_server(email: String, activity_type: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        
        if email.trim().is_empty() {
            return Ok(());
        }

        let pool = super::db::get_pool();
        
        // Ensure record exists
        sqlx::query("INSERT INTO user_daily_missions (email, date) VALUES ($1, CURRENT_DATE) ON CONFLICT DO NOTHING")
            .bind(&email)
            .execute(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal inisialisasi misi: {e}")))?;

        let column = match activity_type.as_str() {
            "lesson" => "lessons_completed",
            "quiz" => "quizzes_completed",
            "weakness" => "weakness_practices_completed",
            "flashcard" => "flashcards_reviewed",
            _ => return Ok(()),
        };

        let query = format!("UPDATE user_daily_missions SET {column} = {column} + 1 WHERE email = $1 AND date = CURRENT_DATE");
        sqlx::query(&query)
            .bind(&email)
            .execute(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal mengupdate progress: {e}")))?;

        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}

#[server]
pub async fn claim_mission_reward_server(email: String) -> Result<String, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        
        let pool = super::db::get_pool();

        let row = sqlx::query("SELECT is_completed, reward_claimed FROM user_daily_missions WHERE email = $1 AND date = CURRENT_DATE")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal cek status misi: {e}")))?;
            
        let Some(r) = row else {
            return Err(ServerFnError::new("Misi belum dimulai"));
        };
        
        let is_completed: bool = r.get("is_completed");
        let reward_claimed: bool = r.get("reward_claimed");
        
        if !is_completed {
            return Err(ServerFnError::new("Misi belum selesai"));
        }
        if reward_claimed {
            return Err(ServerFnError::new("Hadiah sudah diklaim"));
        }
        
        let reward_amount = 50;
        
        sqlx::query("UPDATE user_daily_missions SET reward_claimed = TRUE WHERE email = $1 AND date = CURRENT_DATE")
            .bind(&email)
            .execute(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal klaim: {e}")))?;
            
        sqlx::query("UPDATE user_engagement_stats SET coins = coins + $1 WHERE email = $2")
            .bind(reward_amount)
            .bind(&email)
            .execute(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal update koin: {e}")))?;

        Ok(format!("Kamu mendapatkan {} koin!", reward_amount))
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok("Kamu mendapatkan 50 koin!".to_string())
    }
}
