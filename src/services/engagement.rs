use dioxus::prelude::*;
use crate::models::engagement::UserEngagementStats;

#[server]
pub async fn update_engagement_after_quiz_server(email: String, points_earned: i32) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let mut coin_reward = 10;
        if let Ok(Some(row)) = sqlx::query("SELECT value FROM app_config WHERE key = 'quiz_completion_coins' LIMIT 1")
            .fetch_optional(pool)
            .await
        {
            if let Ok(val) = row.get::<String, _>("value").parse::<i32>() {
                coin_reward = val;
            }
        }

        sqlx::query(
            "INSERT INTO user_engagement_stats (email, current_streak, longest_streak, total_quiz_completed, total_points_earned, last_active_date, coins, streak_freezes, previous_streak, exam_retake_tickets, hearts)
             VALUES ($1, 1, 1, 1, $2, CURRENT_DATE, $3, 0, 0, 0, 5)
             ON CONFLICT (email) DO UPDATE
             SET total_quiz_completed = user_engagement_stats.total_quiz_completed + 1,
                 total_points_earned = user_engagement_stats.total_points_earned + CASE WHEN user_engagement_stats.double_xp_until >= CURRENT_TIMESTAMP THEN EXCLUDED.total_points_earned * 2 ELSE EXCLUDED.total_points_earned END,
                 coins = user_engagement_stats.coins + $3,
                 previous_streak = CASE
                     WHEN user_engagement_stats.last_active_date >= CURRENT_DATE THEN user_engagement_stats.previous_streak
                     WHEN user_engagement_stats.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN user_engagement_stats.previous_streak
                     WHEN user_engagement_stats.streak_freezes >= (CURRENT_DATE - user_engagement_stats.last_active_date - 1) THEN user_engagement_stats.previous_streak
                     WHEN COALESCE(user_engagement_stats.has_weekend_amulet, FALSE) AND EXTRACT(ISODOW FROM CURRENT_DATE) = 1 AND user_engagement_stats.last_active_date >= CURRENT_DATE - INTERVAL '3 days' THEN user_engagement_stats.previous_streak
                     WHEN COALESCE(user_engagement_stats.has_weekend_amulet, FALSE) AND EXTRACT(ISODOW FROM CURRENT_DATE) = 7 AND user_engagement_stats.last_active_date >= CURRENT_DATE - INTERVAL '2 days' THEN user_engagement_stats.previous_streak
                     ELSE user_engagement_stats.current_streak
                 END,
                 current_streak = CASE
                     WHEN user_engagement_stats.last_active_date >= CURRENT_DATE THEN user_engagement_stats.current_streak
                     WHEN user_engagement_stats.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN user_engagement_stats.current_streak + 1
                     WHEN user_engagement_stats.streak_freezes >= (CURRENT_DATE - user_engagement_stats.last_active_date - 1) THEN user_engagement_stats.current_streak + 1
                     WHEN COALESCE(user_engagement_stats.has_weekend_amulet, FALSE) AND EXTRACT(ISODOW FROM CURRENT_DATE) = 1 AND user_engagement_stats.last_active_date >= CURRENT_DATE - INTERVAL '3 days' THEN user_engagement_stats.current_streak + 1
                     WHEN COALESCE(user_engagement_stats.has_weekend_amulet, FALSE) AND EXTRACT(ISODOW FROM CURRENT_DATE) = 7 AND user_engagement_stats.last_active_date >= CURRENT_DATE - INTERVAL '2 days' THEN user_engagement_stats.current_streak + 1
                     ELSE 1
                 END,
                 streak_freezes = CASE
                     WHEN user_engagement_stats.last_active_date < CURRENT_DATE - INTERVAL '1 day' AND user_engagement_stats.streak_freezes >= (CURRENT_DATE - user_engagement_stats.last_active_date - 1) THEN user_engagement_stats.streak_freezes - (CURRENT_DATE - user_engagement_stats.last_active_date - 1)
                     ELSE user_engagement_stats.streak_freezes
                 END,
                 longest_streak = GREATEST(
                     user_engagement_stats.longest_streak,
                     CASE
                         WHEN user_engagement_stats.last_active_date >= CURRENT_DATE THEN user_engagement_stats.current_streak
                         WHEN user_engagement_stats.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN user_engagement_stats.current_streak + 1
                         WHEN user_engagement_stats.streak_freezes >= (CURRENT_DATE - user_engagement_stats.last_active_date - 1) THEN user_engagement_stats.current_streak + 1
                         WHEN COALESCE(user_engagement_stats.has_weekend_amulet, FALSE) AND EXTRACT(ISODOW FROM CURRENT_DATE) = 1 AND user_engagement_stats.last_active_date >= CURRENT_DATE - INTERVAL '3 days' THEN user_engagement_stats.current_streak + 1
                         WHEN COALESCE(user_engagement_stats.has_weekend_amulet, FALSE) AND EXTRACT(ISODOW FROM CURRENT_DATE) = 7 AND user_engagement_stats.last_active_date >= CURRENT_DATE - INTERVAL '2 days' THEN user_engagement_stats.current_streak + 1
                         ELSE 1
                     END
                 ),
                 last_active_date = CURRENT_DATE"
        )
        .bind(email.clone())
        .bind(points_earned)
        .bind(coin_reward)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal update engagement: {e}")))?;
        
        // Evaluate badges
        let _ = super::badge::evaluate_and_award_badges_server(email.clone()).await;
        
        // Log milestone
        let stats_opt = sqlx::query("SELECT current_streak FROM user_engagement_stats WHERE email = $1 LIMIT 1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);
            
        if let Some(stats) = stats_opt {
            let streak: i32 = stats.get("current_streak");
            if streak > 0 && streak % 7 == 0 {
                let _ = crate::services::social::log_activity_server(
                    email.clone(), 
                    "streak_milestone".to_string(), 
                    format!("Luar biasa! Berhasil mencapai {} hari beruntun belajar!", streak)
                ).await;
            }
        }
        
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}

#[server]
pub async fn get_engagement_stats_server(email: String) -> Result<UserEngagementStats, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        use chrono::Utc;
        let pool = super::db::get_pool();
        let row_opt = sqlx::query("SELECT current_streak, longest_streak, total_quiz_completed, total_points_earned, coins, streak_freezes, previous_streak, double_xp_until, exam_retake_tickets, hearts, last_heart_refill FROM user_engagement_stats WHERE email = $1 LIMIT 1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Gagal ambil stats: {e}")))?;
            
        if let Some(row) = row_opt {
            let mut hearts: i32 = row.get("hearts");
            let mut last_heart_refill: Option<chrono::DateTime<Utc>> = row.get("last_heart_refill");
            
            // Auto regeneration logic: 1 heart per 4 hours
            if hearts < 5 {
                if let Some(last_refill) = last_heart_refill {
                    let now = Utc::now();
                    let diff_hours = (now - last_refill).num_hours();
                    
                    if diff_hours >= 4 {
                        let hearts_to_add = (diff_hours / 4) as i32;
                        hearts = std::cmp::min(5, hearts + hearts_to_add);
                        
                        if hearts == 5 {
                            last_heart_refill = None;
                        } else {
                            // Advance the last_refill time by (hearts_to_add * 4) hours
                            last_heart_refill = Some(last_refill + chrono::Duration::hours((hearts_to_add * 4) as i64));
                        }
                        
                        // Update the DB
                        let _ = sqlx::query("UPDATE user_engagement_stats SET hearts = $1, last_heart_refill = $2 WHERE email = $3")
                            .bind(hearts)
                            .bind(last_heart_refill)
                            .bind(&email)
                            .execute(pool)
                            .await;
                    }
                } else if hearts < 5 {
                    // Fallback if somehow it's null but < 5
                    last_heart_refill = Some(Utc::now());
                    let _ = sqlx::query("UPDATE user_engagement_stats SET last_heart_refill = $1 WHERE email = $2")
                        .bind(last_heart_refill)
                        .bind(&email)
                        .execute(pool)
                        .await;
                }
            }

            Ok(UserEngagementStats {
                current_streak: row.get("current_streak"),
                longest_streak: row.get("longest_streak"),
                total_quiz_completed: row.get("total_quiz_completed"),
                total_points_earned: row.get("total_points_earned"),
                coins: row.get("coins"),
                streak_freezes: row.get("streak_freezes"),
                previous_streak: row.get("previous_streak"),
                double_xp_until: row.get("double_xp_until"),
                exam_retake_tickets: row.get("exam_retake_tickets"),
                hearts,
                last_heart_refill,
            })
        } else {
            Ok(UserEngagementStats { current_streak: 0, longest_streak: 0, total_quiz_completed: 0, total_points_earned: 0, coins: 0, streak_freezes: 0, previous_streak: 0, double_xp_until: None, exam_retake_tickets: 0, hearts: 5, last_heart_refill: None })
        }
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(UserEngagementStats { current_streak: 0, longest_streak: 0, total_quiz_completed: 0, total_points_earned: 0, coins: 0, streak_freezes: 0, previous_streak: 0, double_xp_until: None, exam_retake_tickets: 0, hearts: 5, last_heart_refill: None })
    }
}

#[server]
pub async fn deduct_heart_server(email: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        use chrono::Utc;
        let pool = super::db::get_pool();
        
        let row_opt = sqlx::query("SELECT hearts FROM user_engagement_stats WHERE email = $1 LIMIT 1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;
            
        if let Some(row) = row_opt {
            let hearts: i32 = row.get("hearts");
            if hearts > 0 {
                let new_hearts = hearts - 1;
                if new_hearts == 4 {
                    // Set the refill timer
                    sqlx::query("UPDATE user_engagement_stats SET hearts = $1, last_heart_refill = $2 WHERE email = $3")
                        .bind(new_hearts)
                        .bind(Utc::now())
                        .bind(&email)
                        .execute(pool)
                        .await
                        .map_err(|e| ServerFnError::new(e.to_string()))?;
                } else {
                    sqlx::query("UPDATE user_engagement_stats SET hearts = $1 WHERE email = $2")
                        .bind(new_hearts)
                        .bind(&email)
                        .execute(pool)
                        .await
                        .map_err(|e| ServerFnError::new(e.to_string()))?;
                }
            }
        } else {
            // User stats doesn't exist, create it with 4 hearts
            sqlx::query("INSERT INTO user_engagement_stats (email, hearts, last_heart_refill) VALUES ($1, 4, $2)")
                .bind(&email)
                .bind(Utc::now())
                .execute(pool)
                .await
                .map_err(|e| ServerFnError::new(e.to_string()))?;
        }
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}

#[server]
pub async fn refill_hearts_with_coins_server(email: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let mut tx = pool.begin().await.map_err(|e| ServerFnError::new(e.to_string()))?;
        
        let row_opt = sqlx::query("SELECT coins, hearts FROM user_engagement_stats WHERE email = $1 LIMIT 1")
            .bind(&email)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;
            
        if let Some(row) = row_opt {
            let coins: i32 = row.get("coins");
            let hearts: i32 = row.get("hearts");
            let missing_hearts = 5 - hearts;
            if missing_hearts <= 0 {
                return Err(ServerFnError::new("Nyawa sudah penuh!"));
            }
            
            let cost = missing_hearts * 60;
            
            if coins >= cost {
                sqlx::query("UPDATE user_engagement_stats SET coins = coins - $1, hearts = 5, last_heart_refill = NULL WHERE email = $2")
                    .bind(cost)
                    .bind(&email)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| ServerFnError::new(e.to_string()))?;
                tx.commit().await.map_err(|e| ServerFnError::new(e.to_string()))?;
                return Ok(());
            } else {
                return Err(ServerFnError::new(format!("Koin tidak cukup! Butuh {} Koin.", cost)));
            }
        }
        Err(ServerFnError::new("Data user tidak ditemukan."))
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}

#[server]
pub async fn refill_hearts_with_ad_server(email: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let pool = super::db::get_pool();
        sqlx::query("UPDATE user_engagement_stats SET hearts = 5, last_heart_refill = NULL WHERE email = $1")
            .bind(&email)
            .execute(pool)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}

#[server]
pub async fn add_heart_server(email: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        let row_opt = sqlx::query("SELECT hearts FROM user_engagement_stats WHERE email = $1 LIMIT 1")
            .bind(&email)
            .fetch_optional(pool)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;
            
        if let Some(row) = row_opt {
            let hearts: i32 = row.get("hearts");
            if hearts < 5 {
                let new_hearts = hearts + 1;
                if new_hearts == 5 {
                    sqlx::query("UPDATE user_engagement_stats SET hearts = 5, last_heart_refill = NULL WHERE email = $1")
                        .bind(&email)
                        .execute(pool)
                        .await
                        .map_err(|e| ServerFnError::new(e.to_string()))?;
                } else {
                    sqlx::query("UPDATE user_engagement_stats SET hearts = hearts + 1 WHERE email = $1")
                        .bind(&email)
                        .execute(pool)
                        .await
                        .map_err(|e| ServerFnError::new(e.to_string()))?;
                }
            }
        }
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}
