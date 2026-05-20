use dioxus::prelude::*;
use crate::models::weakness::{WeaknessItem, WeaknessAnalyticsItem};

#[server(LogWeakness)]
pub async fn log_weakness_server(username: String, language: String, topic: String, note: String) -> Result<(), ServerFnError> {
    if username.trim().is_empty() || language.trim().is_empty() || topic.trim().is_empty() {
        return Err(ServerFnError::new("Data weakness tidak valid."));
    }

    let pool = super::db::get_pool();
    sqlx::query("INSERT INTO weakness_logs (username, language, topic, note) VALUES ($1, $2, $3, $4)")
        .bind(username)
        .bind(language)
        .bind(topic)
        .bind(note)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal menyimpan weakness: {e}")))?;

    Ok(())
}

#[server(GetTopWeaknesses)]
pub async fn get_top_weaknesses_server(username: String, language: String, limit: i64) -> Result<Vec<WeaknessItem>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let safe_limit = if limit <= 0 { 3 } else { limit.min(10) };
    let pool = super::db::get_pool();

    let rows = sqlx::query(
        "SELECT topic, COUNT(*)::bigint AS cnt FROM weakness_logs WHERE username = $1 AND language = $2 GROUP BY topic ORDER BY cnt DESC LIMIT $3"
    )
    .bind(username)
    .bind(language)
    .bind(safe_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal mengambil weakness: {e}")))?;

    Ok(rows.into_iter().map(|row| WeaknessItem { topic: row.get("topic"), count: row.get("cnt") }).collect())
}

#[server(GetWeaknessAnalytics)]
pub async fn get_weakness_analytics_server(username: String, language: String, limit: i64) -> Result<Vec<WeaknessAnalyticsItem>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let safe_limit = if limit <= 0 { 8 } else { limit.min(20) };
    let pool = super::db::get_pool();

    let rows = sqlx::query(
        "SELECT topic,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint AS count_7d,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::bigint AS count_30d
        FROM weakness_logs
        WHERE username = $1 AND language = $2
        GROUP BY topic
        ORDER BY count_30d DESC, count_7d DESC
        LIMIT $3"
    )
    .bind(username)
    .bind(language)
    .bind(safe_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal mengambil weakness analytics: {e}")))?;

    Ok(rows.into_iter().map(|row| WeaknessAnalyticsItem {
        topic: row.get("topic"),
        count_7d: row.get("count_7d"),
        count_30d: row.get("count_30d"),
    }).collect())
}

#[server(GetPriorityWeakness)]
pub async fn get_priority_weakness_server(username: String, language: String) -> Result<Option<String>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let pool = super::db::get_pool();
    let row = sqlx::query(
        "SELECT topic,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint AS c7,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::bigint AS c30
         FROM weakness_logs
         WHERE username = $1 AND language = $2
         GROUP BY topic
         ORDER BY (COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::float / 7.0)
                - (COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::float / 30.0) DESC,
                c30 DESC
         LIMIT 1"
    )
    .bind(username)
    .bind(language)
    .fetch_optional(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal mengambil priority weakness: {e}")))?;

    Ok(row.map(|r| r.get::<String, _>("topic")))
}
