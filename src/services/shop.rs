use dioxus::prelude::*;

#[server]
pub async fn buy_streak_freeze_server(email: String) -> Result<String, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let item_opt = sqlx::query("SELECT cost, effect_type FROM shop_items WHERE effect_type = 'streak_freeze' LIMIT 1")
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal fetch item: {e}")))?;

        let (cost, effect_type) = if let Some(item) = item_opt {
            (item.get::<i32, _>("cost"), item.get::<String, _>("effect_type"))
        } else {
            return Err(ServerFnError::new("Item tidak ditemukan di tabel konfigurasi."));
        };

        let stats_opt = sqlx::query("SELECT coins FROM user_engagement_stats WHERE email = $1 LIMIT 1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal fetch stats: {e}")))?;

        let coins: i32 = if let Some(stats) = stats_opt {
            stats.get("coins")
        } else {
            // User belum punya baris engagement, buat dulu dengan 0 coins
            sqlx::query("INSERT INTO user_engagement_stats (email, coins, streak_days, streak_freezes) VALUES ($1, 0, 0, 0) ON CONFLICT (email) DO NOTHING")
                .bind(&email)
                .execute(pool)
                .await
                .map_err(|e| ServerFnError::new(format!("Gagal init stats: {e}")))?;
            0
        };

        if coins >= cost {
            sqlx::query("UPDATE user_engagement_stats SET coins = coins - $1, streak_freezes = streak_freezes + 1 WHERE email = $2")
                .bind(cost)
                .bind(&email)
                .execute(pool)
                .await
                .map_err(|e| ServerFnError::new(format!("Gagal proses pembelian: {e}")))?;
            return Ok("Berhasil membeli Streak Freeze!".to_string());
        } else {
            return Err(ServerFnError::new(format!("Koin tidak cukup (butuh {cost}). Kerjakan kuis untuk mendapatkannya!")));
        }
    }
    #[cfg(target_arch = "wasm32")]
    {
        Err(ServerFnError::new("Cannot execute on client"))
    }
}

