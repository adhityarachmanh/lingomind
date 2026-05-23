use dioxus::prelude::*;
use crate::models::flashcard::{Flashcard, NewFlashcard};

#[cfg(feature = "server")]
fn sm2_next(ease_factor: f64, interval_days: i32, repetition: i32, quality: i32) -> (f64, i32, i32) {
    let mut ef = ease_factor + (0.1 - (5 - quality) as f64 * (0.08 + (5 - quality) as f64 * 0.02));
    if ef < 1.3 {
        ef = 1.3;
    }

    if quality < 3 {
        return (ef, 1, 0);
    }

    let new_repetition = repetition + 1;
    let new_interval = if new_repetition == 1 {
        1
    } else if new_repetition == 2 {
        3
    } else {
        ((interval_days as f64) * ef).round() as i32
    };

    (ef, new_interval.max(1), new_repetition)
}

#[server]
pub async fn add_flashcards_server(email: String, cards: Vec<NewFlashcard>) -> Result<(), ServerFnError> {

    if email.trim().is_empty() {
        return Err(ServerFnError::new("User tidak valid."));
    }

    let pool = super::db::get_pool();

    for card in cards {
        if card.front_text.trim().is_empty() || card.back_text.trim().is_empty() {
            continue;
        }

        let _ = sqlx::query(
            "INSERT INTO flashcards (email, language, front_text, back_text) VALUES ($1, $2, $3, $4) ON CONFLICT (email, language, front_text, back_text) DO NOTHING"
        )
        .bind(&email)
        .bind(card.language)
        .bind(card.front_text)
        .bind(card.back_text)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal menyimpan flashcard: {e}")))?;
    }

    Ok(())
}

#[server]
pub async fn get_due_flashcards_server(email: String, language: String, limit: i64) -> Result<Vec<Flashcard>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let safe_limit = if limit <= 0 { 10 } else { limit.min(50) };
    let pool = super::db::get_pool();

    let rows = sqlx::query(
        "SELECT id, email, language, front_text, back_text, ease_factor, interval_days, repetition FROM flashcards WHERE email = $1 AND language = $2 AND due_at <= NOW() ORDER BY due_at ASC LIMIT $3"
    )
    .bind(email)
    .bind(language)
    .bind(safe_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal mengambil flashcard due: {e}")))?;

    let mut cards = Vec::with_capacity(rows.len());
    for row in rows {
        cards.push(Flashcard {
            id: row.get("id"),
            email: row.get("email"),
            language: row.get("language"),
            front_text: row.get("front_text"),
            back_text: row.get("back_text"),
            ease_factor: row.get("ease_factor"),
            interval_days: row.get("interval_days"),
            repetition: row.get("repetition"),
        });
    }

    Ok(cards)
}

#[server]
pub async fn get_due_flashcard_count_server(email: String, language: String) -> Result<i64, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let pool = super::db::get_pool();
    let row = sqlx::query(
        "SELECT COUNT(*)::bigint AS cnt FROM flashcards WHERE email = $1 AND language = $2 AND due_at <= NOW()"
    )
    .bind(email)
    .bind(language)
    .fetch_one(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal hitung due flashcard: {e}")))?;

    Ok(row.get("cnt"))
}

#[server]
pub async fn review_flashcard_server(card_id: i32, quality: i32) -> Result<(), ServerFnError> {
    if !(0..=5).contains(&quality) {
        return Err(ServerFnError::new("Quality review harus 0..5."));
    }

    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let pool = super::db::get_pool();
    let row = sqlx::query("SELECT ease_factor, interval_days, repetition FROM flashcards WHERE id = $1")
        .bind(card_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal mengambil data flashcard: {e}")))?
        .ok_or_else(|| ServerFnError::new("Flashcard tidak ditemukan."))?;

    let ef: f64 = row.get("ease_factor");
    let interval_days: i32 = row.get("interval_days");
    let repetition: i32 = row.get("repetition");

    let (new_ef, new_interval, new_repetition) = sm2_next(ef, interval_days, repetition, quality);

    sqlx::query(
        "UPDATE flashcards SET ease_factor = $1, interval_days = $2, repetition = $3, due_at = NOW() + ($2 * INTERVAL '1 day'), last_reviewed_at = NOW() WHERE id = $4"
    )
    .bind(new_ef)
    .bind(new_interval)
    .bind(new_repetition)
    .bind(card_id)
    .execute(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal update review flashcard: {e}")))?;

    Ok(())
}
