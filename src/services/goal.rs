use dioxus::prelude::*;
use crate::models::goal::UserLanguageGoal;

#[server(SetLanguageGoal)]
pub async fn set_language_goal_server(email: String, language: String, goal: String) -> Result<(), ServerFnError> {
    let pool = super::db::get_pool();
    sqlx::query("INSERT INTO user_language_goals (email, language, goal, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (email, language) DO UPDATE SET goal = EXCLUDED.goal, updated_at = NOW()")
        .bind(email)
        .bind(language)
        .bind(goal)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal menyimpan goal: {e}")))?;
    Ok(())
}

#[server(GetLanguageGoals)]
pub async fn get_language_goals_server(email: String) -> Result<Vec<UserLanguageGoal>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let pool = super::db::get_pool();
    let rows = sqlx::query("SELECT language, goal FROM user_language_goals WHERE email = $1")
        .bind(email)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal mengambil goals: {e}")))?;

    Ok(rows.into_iter().map(|r| UserLanguageGoal { language: r.get("language"), goal: r.get("goal") }).collect())
}

#[server(GetLanguageGoal)]
pub async fn get_language_goal_server(email: String, language: String) -> Result<Option<String>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let pool = super::db::get_pool();
    let row = sqlx::query("SELECT goal FROM user_language_goals WHERE email = $1 AND language = $2 LIMIT 1")
        .bind(email)
        .bind(language)
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal mengambil goal: {e}")))?;

    Ok(row.map(|r| r.get::<String, _>("goal")))
}
