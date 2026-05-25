use dioxus::prelude::*;
use crate::models::shop::ShopItem;

#[server]
pub async fn get_shop_items_server() -> Result<Vec<ShopItem>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let rows = sqlx::query(
            "SELECT id, name, description, cost, effect_type, icon_name 
             FROM shop_items ORDER BY cost ASC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal fetch shop items: {e}")))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(ShopItem {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                cost: row.get("cost"),
                effect_type: row.get("effect_type"),
                icon_name: row.get("icon_name"),
            });
        }
        Ok(items)
    }
    #[cfg(target_arch = "wasm32")]
    {
        Err(ServerFnError::new("Cannot execute on client"))
    }
}

#[server]
pub async fn buy_shop_item_server(email: String, item_id: i32) -> Result<String, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        use rand::Rng;
        let pool = super::db::get_pool();
        
        let item_opt = sqlx::query("SELECT name, cost, effect_type FROM shop_items WHERE id = $1")
            .bind(item_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal fetch item: {e}")))?;

        let (name, cost, effect_type) = if let Some(item) = item_opt {
            (item.get::<String, _>("name"), item.get::<i32, _>("cost"), item.get::<String, _>("effect_type"))
        } else {
            return Err(ServerFnError::new("Item tidak ditemukan."));
        };

        let stats_opt = sqlx::query("SELECT coins FROM user_engagement_stats WHERE email = $1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal fetch stats: {e}")))?;

        let coins: i32 = if let Some(stats) = stats_opt {
            stats.get("coins")
        } else {
            sqlx::query("INSERT INTO user_engagement_stats (email, coins, current_streak, streak_freezes) VALUES ($1, 0, 0, 0) ON CONFLICT (email) DO NOTHING")
                .bind(&email)
                .execute(pool)
                .await
                .map_err(|e| ServerFnError::new(format!("Gagal init stats: {e}")))?;
            0
        };

        if coins < cost {
            return Err(ServerFnError::new(format!("Koin tidak cukup (butuh {cost}).")));
        }

        let mut tx = pool.begin().await.map_err(|e| ServerFnError::new(e.to_string()))?;
        
        // Potong koin
        sqlx::query("UPDATE user_engagement_stats SET coins = coins - $1 WHERE email = $2")
            .bind(cost)
            .bind(&email)
            .execute(&mut *tx)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;

        let mut return_message = format!("Berhasil membeli {}!", name);

        match effect_type.as_str() {
            "streak_freeze" => {
                sqlx::query("UPDATE user_engagement_stats SET streak_freezes = streak_freezes + 1 WHERE email = $1")
                    .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
            },
            "double_xp" => {
                sqlx::query("UPDATE user_engagement_stats SET double_xp_until = NOW() + INTERVAL '1 hour' WHERE email = $1")
                    .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
            },
            "weekend_amulet" => {
                sqlx::query("UPDATE user_engagement_stats SET has_weekend_amulet = TRUE WHERE email = $1")
                    .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
            },
            "profile_frame_gold" => {
                sqlx::query("UPDATE user_engagement_stats SET active_frame = 'gold' WHERE email = $1")
                    .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
            },
            "mystery_box" => {
                let mut rng = rand::thread_rng();
                let roll = rng.gen_range(1..=100);
                if roll <= 40 {
                    // Zonk: refund 10 koin
                    sqlx::query("UPDATE user_engagement_stats SET coins = coins + 10 WHERE email = $1")
                        .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
                    return_message = "Mystery Box: Zonk! Kamu dapat kembalian 10 koin.".to_string();
                } else if roll <= 75 {
                    // Double XP
                    sqlx::query("UPDATE user_engagement_stats SET double_xp_until = NOW() + INTERVAL '1 hour' WHERE email = $1")
                        .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
                    return_message = "Mystery Box: Hoki! Kamu dapat efek Double XP 1 Jam!".to_string();
                } else if roll <= 95 {
                    // Streak freeze
                    sqlx::query("UPDATE user_engagement_stats SET streak_freezes = streak_freezes + 1 WHERE email = $1")
                        .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
                    return_message = "Mystery Box: Mantap! Kamu dapat 1 Streak Freeze!".to_string();
                } else {
                    // Jackpot: 100 koin
                    sqlx::query("UPDATE user_engagement_stats SET coins = coins + 100 WHERE email = $1")
                        .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
                    return_message = "Mystery Box: JACKPOT! 🎉 Kamu dapat 100 koin!".to_string();
                }
            },
            _ => {
                // Default fallback (no extra action needed for unknown types right now)
            }
        }

        tx.commit().await.map_err(|e| ServerFnError::new(e.to_string()))?;

        Ok(return_message)
    }
    #[cfg(target_arch = "wasm32")]
    {
        Err(ServerFnError::new("Cannot execute on client"))
    }
}
