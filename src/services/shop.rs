use dioxus::prelude::*;

#[server]
pub async fn buy_streak_freeze_server(email: String) -> Result<String, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let stats_opt = sqlx::query("SELECT coins FROM user_engagement_stats WHERE email = $1 LIMIT 1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal fetch stats: {e}")))?;

        if let Some(stats) = stats_opt {
            let coins: i32 = stats.get("coins");
            if coins >= 50 {
                // Kurangi koin 50, tambah 1 freeze
                sqlx::query("UPDATE user_engagement_stats SET coins = coins - 50, streak_freezes = streak_freezes + 1 WHERE email = $1")
                    .bind(&email)
                    .execute(pool)
                    .await
                    .map_err(|e| ServerFnError::new(format!("Gagal proses pembelian: {e}")))?;
                return Ok("Berhasil membeli Streak Freeze!".to_string());
            } else {
                return Err(ServerFnError::new("Koin tidak cukup. Kerjakan kuis untuk mendapatkannya!"));
            }
        }
        Err(ServerFnError::new("Koin tidak cukup. Kerjakan kuis untuk mendapatkannya!"))
    }
    #[cfg(target_arch = "wasm32")]
    {
        Err(ServerFnError::new("Cannot execute on client"))
    }
}
