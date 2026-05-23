use dioxus::prelude::*;
use crate::models::mission::DailyMission;

#[server]
pub async fn get_daily_mission_server(email: String, language: String) -> Result<DailyMission, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
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

    let flash_target = if due_count <= 0 { 5 } else { due_count.min(15) as i32 };
    let weakness_target = if weak_7d >= 10 { 5 } else { 3 };

    Ok(DailyMission {
        language,
        lesson_target: 1,
        quiz_target: 1,
        weakness_target,
        flashcard_target: flash_target,
    })
}
