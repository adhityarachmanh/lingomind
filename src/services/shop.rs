use dioxus::prelude::*;
use crate::models::shop::ShopItem;

#[server]
pub async fn get_shop_items_server(email: String) -> Result<Vec<ShopItem>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let rows = sqlx::query(
            "SELECT s.id, s.name, s.description, s.cost, s.effect_type, s.icon_name,
                    (SELECT COUNT(*) FROM user_inventory i WHERE i.email = $1 AND i.item_type = s.effect_type) > 0 as is_owned
             FROM shop_items s ORDER BY s.cost ASC"
        )
        .bind(&email)
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
                is_owned: row.get("is_owned"),
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
            "streak_repair" => {
                let stats = sqlx::query("SELECT last_active_date, current_streak, previous_streak FROM user_engagement_stats WHERE email = $1")
                    .bind(&email).fetch_one(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
                
                let last_active: Option<chrono::NaiveDate> = stats.get("last_active_date");
                let current_streak: i32 = stats.get("current_streak");
                
                if let Some(la) = last_active {
                    let today = chrono::Utc::now().naive_utc().date();
                    let diff = (today - la).num_days();
                    
                    if diff == 1 {
                        // Jika beda 1 hari (kemarin aktif), streak belum benar-benar hangus hari ini. Tidak butuh repair.
                        return Err(ServerFnError::new("Streak Anda masih aktif hari ini. Lakukan 1 kuis untuk mempertahankannya!"));
                    } else if diff >= 2 {
                        // Hangus.
                        // Jika current_streak sudah direset ke 1 atau 0, restore previous_streak.
                        sqlx::query("UPDATE user_engagement_stats SET current_streak = previous_streak + 1, last_active_date = CURRENT_DATE - INTERVAL '1 day' WHERE email = $1")
                            .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
                        return_message = "Streak Anda berhasil dipulihkan!".to_string();
                    } else {
                        return Err(ServerFnError::new("Streak Anda belum hangus."));
                    }
                } else {
                    return Err(ServerFnError::new("Anda belum memiliki riwayat belajar."));
                }
            },
            "double_xp" => {
                sqlx::query("UPDATE user_engagement_stats SET double_xp_until = NOW() + INTERVAL '24 hours' WHERE email = $1")
                    .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
            },
            "exam_retake" => {
                sqlx::query("UPDATE user_engagement_stats SET exam_retake_tickets = exam_retake_tickets + 1 WHERE email = $1")
                    .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
            },
            "weekend_amulet" => {
                sqlx::query("UPDATE user_engagement_stats SET has_weekend_amulet = TRUE WHERE email = $1")
                    .bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
            },
            "profile_frame_gold" | "profile_frame_diamond" | "profile_frame_mythic" => {
                let frame_value = match effect_type.as_str() {
                    "profile_frame_gold" => "gold",
                    "profile_frame_diamond" => "diamond",
                    "profile_frame_mythic" => "mythic",
                    _ => "gold",
                };

                // Check if already owned
                let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user_inventory WHERE email = $1 AND item_type = $2 AND item_value = $3")
                    .bind(&email).bind(&effect_type).bind(frame_value)
                    .fetch_one(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
                
                if count.0 > 0 {
                    return Err(ServerFnError::new("Anda sudah memiliki bingkai ini!"));
                }

                // Insert to inventory
                sqlx::query("INSERT INTO user_inventory (email, item_type, item_value) VALUES ($1, $2, $3)")
                    .bind(&email).bind(&effect_type).bind(frame_value)
                    .execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;

                // Auto-equip
                sqlx::query("UPDATE user_engagement_stats SET active_frame = $1 WHERE email = $2")
                    .bind(frame_value).bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
            },
            eff if eff.starts_with("title_") => {
                let title_value = eff.trim_start_matches("title_");
                let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user_inventory WHERE email = $1 AND item_type = $2 AND item_value = $3")
                    .bind(&email).bind(&effect_type).bind(title_value)
                    .fetch_one(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
                
                if count.0 > 0 {
                    return Err(ServerFnError::new("Anda sudah memiliki gelar ini!"));
                }
                
                sqlx::query("INSERT INTO user_inventory (email, item_type, item_value) VALUES ($1, $2, $3)")
                    .bind(&email).bind(&effect_type).bind(title_value)
                    .execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;

                sqlx::query("UPDATE user_engagement_stats SET active_title = $1 WHERE email = $2")
                    .bind(title_value).bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
            },
            eff if eff.starts_with("name_color_") => {
                let color_value = eff.trim_start_matches("name_color_");
                let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user_inventory WHERE email = $1 AND item_type = $2 AND item_value = $3")
                    .bind(&email).bind(&effect_type).bind(color_value)
                    .fetch_one(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
                
                if count.0 > 0 {
                    return Err(ServerFnError::new("Anda sudah memiliki warna ini!"));
                }

                sqlx::query("INSERT INTO user_inventory (email, item_type, item_value) VALUES ($1, $2, $3)")
                    .bind(&email).bind(&effect_type).bind(color_value)
                    .execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;

                sqlx::query("UPDATE user_engagement_stats SET active_name_color = $1 WHERE email = $2")
                    .bind(color_value).bind(&email).execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
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
            eff if eff.starts_with("egg_") => {
                let pet_type = eff.trim_start_matches("egg_");

                // Cek apakah sudah punya pet jenis ini
                let has_pet: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user_pets WHERE email = $1 AND pet_type = $2")
                    .bind(&email).bind(pet_type).fetch_one(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;

                if has_pet.0 > 0 {
                    return Err(ServerFnError::new("Anda sudah memiliki jenis peliharaan ini!"));
                }

                // Cek apakah sudah ada pet yang aktif
                let active_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user_pets WHERE email = $1 AND is_active = true")
                    .bind(&email).fetch_one(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
                
                let is_active = active_count.0 == 0; // Otomatis aktif jika ini pet pertama
                
                sqlx::query("INSERT INTO user_pets (email, pet_type, stage, exp, is_active) VALUES ($1, $2, 1, 0, $3)")
                    .bind(&email).bind(pet_type).bind(is_active)
                    .execute(&mut *tx).await.map_err(|e| ServerFnError::new(e.to_string()))?;
                    
                let _ = crate::services::social::log_activity_server(
                    email.clone(), 
                    "pet_hatched".to_string(), 
                    format!("Baru saja menetaskan {}!", name)
                ).await;
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
