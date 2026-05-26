// src/services/battle.rs
use dioxus::prelude::*;
use crate::models::social::QuizBattle;

#[server]
pub async fn create_battle_server(challenger: String, challenged: String, language: String, goal: String) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let pool = crate::services::db::get_pool();
        sqlx::query(
            "INSERT INTO quiz_battles (challenger_email, challenged_email, language, goal) VALUES ($1, $2, $3, $4)"
        )
        .bind(&challenger)
        .bind(&challenged)
        .bind(&language)
        .bind(&goal)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Gagal membuat tantangan: {}", e)))?;
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}

#[server]
pub async fn get_active_battles_server(email: String) -> Result<Vec<QuizBattle>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = crate::services::db::get_pool();
        
        let rows = sqlx::query(
            r#"
            SELECT b.id, b.challenger_email, u1.full_name as challenger_name,
                   b.challenged_email, u2.full_name as challenged_name,
                   b.language, b.goal, b.challenger_score, b.challenged_score, b.status
            FROM quiz_battles b
            JOIN users u1 ON b.challenger_email = u1.email
            JOIN users u2 ON b.challenged_email = u2.email
            WHERE (b.challenger_email = $1 OR b.challenged_email = $1)
            ORDER BY b.created_at DESC
            LIMIT 50
            "#
        )
        .bind(&email)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(format!("Database error: {}", e)))?;

        let mut battles = Vec::new();
        for row in rows {
            battles.push(QuizBattle {
                id: row.get("id"),
                challenger_email: row.get("challenger_email"),
                challenger_name: row.get("challenger_name"),
                challenged_email: row.get("challenged_email"),
                challenged_name: row.get("challenged_name"),
                language: row.get("language"),
                goal: row.get("goal"),
                challenger_score: row.get("challenger_score"),
                challenged_score: row.get("challenged_score"),
                status: row.get("status"),
            });
        }
        Ok(battles)
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(vec![])
    }
}

#[server]
pub async fn submit_battle_score_server(battle_id: i32, email: String, score: i32) -> Result<String, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = crate::services::db::get_pool();
        
        // Cek status battle
        let battle_row = sqlx::query("SELECT challenger_email, challenged_email, status, challenger_score, challenged_score FROM quiz_battles WHERE id = $1")
            .bind(battle_id)
            .fetch_one(pool)
            .await
            .map_err(|e| ServerFnError::new(format!("Battle tidak ditemukan: {}", e)))?;
            
        let status: String = battle_row.get("status");
        if status != "pending" {
            return Err(ServerFnError::new("Tantangan sudah selesai atau dibatalkan."));
        }
        
        let challenger_email: String = battle_row.get("challenger_email");
        let challenged_email: String = battle_row.get("challenged_email");
        let is_challenger = email == challenger_email;
        let is_challenged = email == challenged_email;
        
        if !is_challenger && !is_challenged {
            return Err(ServerFnError::new("Anda tidak berpartisipasi dalam tantangan ini."));
        }

        // Update skor yang sesuai
        if is_challenger {
            sqlx::query("UPDATE quiz_battles SET challenger_score = $1 WHERE id = $2")
                .bind(score)
                .bind(battle_id)
                .execute(pool)
                .await
                .map_err(|e| ServerFnError::new(e.to_string()))?;
        } else {
            sqlx::query("UPDATE quiz_battles SET challenged_score = $1 WHERE id = $2")
                .bind(score)
                .bind(battle_id)
                .execute(pool)
                .await
                .map_err(|e| ServerFnError::new(e.to_string()))?;
        }

        // Ambil data terbaru untuk cek apakah keduanya sudah mengerjakan
        let updated_row = sqlx::query("SELECT challenger_score, challenged_score FROM quiz_battles WHERE id = $1")
            .bind(battle_id)
            .fetch_one(pool)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;
            
        let c1: i32 = updated_row.get("challenger_score");
        let c2: Option<i32> = updated_row.get("challenged_score");
        
        if let Some(c2_val) = c2 {
            // Keduanya sudah bermain, tentukan pemenang
            sqlx::query("UPDATE quiz_battles SET status = 'completed' WHERE id = $1")
                .bind(battle_id)
                .execute(pool)
                .await
                .map_err(|e| ServerFnError::new(e.to_string()))?;
                
            let winner_email = if c1 > c2_val {
                Some(challenger_email.clone())
            } else if c2_val > c1 {
                Some(challenged_email.clone())
            } else {
                None // Seri
            };
            
            if let Some(w_email) = winner_email {
                // Beri hadiah koin (misal 50 koin) ke pemenang
                sqlx::query("UPDATE user_engagement_stats SET coins = coins + 50 WHERE email = $1")
                    .bind(&w_email)
                    .execute(pool)
                    .await
                    .map_err(|e| ServerFnError::new(e.to_string()))?;

                // Update Daily Mission PvP Wins
                let _ = sqlx::query("INSERT INTO user_daily_missions (email, date) VALUES ($1, CURRENT_DATE) ON CONFLICT DO NOTHING")
                    .bind(&w_email).execute(pool).await;
                let _ = sqlx::query("UPDATE user_daily_missions SET pvp_wins_today = pvp_wins_today + 1 WHERE email = $1 AND date = CURRENT_DATE")
                    .bind(&w_email).execute(pool).await;
                    
                if w_email == email {
                    return Ok("Selamat! Anda menang dalam tantangan ini dan mendapat 50 Koin!".to_string());
                } else {
                    return Ok("Anda kalah dalam tantangan ini. Coba lagi lain kali!".to_string());
                }
            } else {
                return Ok("Hasilnya SERI! Kalian berdua sama-sama hebat.".to_string());
            }
        } else if is_challenger {
            return Ok("Skor berhasil disimpan! Menunggu lawan menyelesaikan kuis.".to_string());
        }

        Ok("Skor berhasil disimpan!".to_string())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok("OK".to_string())
    }
}
