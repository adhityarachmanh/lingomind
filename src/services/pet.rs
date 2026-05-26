// src/services/pet.rs
use dioxus::prelude::*;
use crate::models::pet::PetData;

#[server]
pub async fn get_active_pet_server(email: String) -> Result<Option<PetData>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let row_opt = sqlx::query(
            "SELECT id, pet_type, stage, exp FROM user_pets WHERE email = $1 AND is_active = true LIMIT 1"
        )
        .bind(&email)
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

        if let Some(row) = row_opt {
            let p_type: String = row.get("pet_type");
            let stage: i32 = row.get("stage");
            
            let (emoji, label) = match p_type.as_str() {
                "dragon" => {
                    match stage {
                        1 => ("🥚".to_string(), "Telur Naga".to_string()),
                        2 => ("🦎".to_string(), "Bayi Naga Api".to_string()),
                        3 => ("🦖".to_string(), "Naga Remaja".to_string()),
                        _ => ("🐉".to_string(), "Naga Raksasa".to_string()),
                    }
                },
                "owl" => {
                    match stage {
                        1 => ("🥚".to_string(), "Telur Burung".to_string()),
                        2 => ("🐣".to_string(), "Anak Burung".to_string()),
                        3 => ("🐥".to_string(), "Burung Kecil".to_string()),
                        _ => ("🦉".to_string(), "Burung Malam".to_string()),
                    }
                },
                "fenrir" => {
                    match stage {
                        1 => ("🥚".to_string(), "Telur Serigala".to_string()),
                        2 => ("🐾".to_string(), "Anak Serigala".to_string()),
                        3 => ("🐕".to_string(), "Serigala Muda".to_string()),
                        _ => ("🐺".to_string(), "Serigala Es".to_string()),
                    }
                },
                _ => ("🥚".to_string(), "Telur Misterius".to_string()),
            };

            Ok(Some(PetData {
                id: row.get("id"),
                pet_type: p_type,
                stage,
                exp: row.get("exp"),
                emoji,
                label,
            }))
        } else {
            Ok(None)
        }
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(None)
    }
}

#[server]
pub async fn feed_pet_server(email: String, pet_id: i32) -> Result<String, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        let mut tx = pool.begin().await.map_err(|e| ServerFnError::new(e.to_string()))?;

        // 1. Cek apakah koin cukup (50 koin)
        let stats_opt = sqlx::query("SELECT coins FROM user_engagement_stats WHERE email = $1 FOR UPDATE")
            .bind(&email)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;

        if let Some(stats) = stats_opt {
            let coins: i32 = stats.get("coins");
            if coins < 50 {
                return Err(ServerFnError::new("Koin tidak cukup! Butuh 50 Koin."));
            }
            
            sqlx::query("UPDATE user_engagement_stats SET coins = coins - 50 WHERE email = $1")
                .bind(&email)
                .execute(&mut *tx)
                .await
                .map_err(|e| ServerFnError::new(e.to_string()))?;
        } else {
            return Err(ServerFnError::new("User stats tidak ditemukan."));
        }

        // 2. Tambah EXP peliharaan
        let pet_row = sqlx::query("SELECT stage, exp FROM user_pets WHERE id = $1 AND email = $2 FOR UPDATE")
            .bind(pet_id)
            .bind(&email)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| ServerFnError::new("Peliharaan tidak ditemukan!".to_string()))?;

        let mut stage: i32 = pet_row.get("stage");
        let mut exp: i32 = pet_row.get("exp");

        if stage >= 4 {
            // Sudah maksimal
            exp += 50; // Boleh nambah terus walau sudah max
        } else {
            exp += 50;
            // Evaluasi stage
            if stage == 1 && exp >= 100 {
                stage = 2;
                exp = 0; // Reset ke 0 tiap naik stage biar bar expnya naik dari awal
            } else if stage == 2 && exp >= 300 {
                stage = 3;
                exp = 0;
            } else if stage == 3 && exp >= 1000 {
                stage = 4;
                exp = 0;
            }
        }

        sqlx::query("UPDATE user_pets SET stage = $1, exp = $2 WHERE id = $3")
            .bind(stage)
            .bind(exp)
            .bind(pet_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;

        tx.commit().await.map_err(|e| ServerFnError::new(e.to_string()))?;

        Ok("Nyam nyam! Peliharaanmu senang.".to_string())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok("".to_string())
    }
}

#[server]
pub async fn get_all_pets_server(email: String) -> Result<Vec<PetData>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let rows = sqlx::query(
            "SELECT id, pet_type, stage, exp FROM user_pets WHERE email = $1 ORDER BY id ASC"
        )
        .bind(&email)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

        let mut pets = Vec::new();
        for row in rows {
            let p_type: String = row.get("pet_type");
            let stage: i32 = row.get("stage");
            
            let (emoji, label) = match p_type.as_str() {
                "dragon" => {
                    match stage {
                        1 => ("🥚".to_string(), "Telur Naga".to_string()),
                        2 => ("🦎".to_string(), "Bayi Naga Api".to_string()),
                        3 => ("🦖".to_string(), "Naga Remaja".to_string()),
                        _ => ("🐉".to_string(), "Naga Raksasa".to_string()),
                    }
                },
                "owl" => {
                    match stage {
                        1 => ("🥚".to_string(), "Telur Burung".to_string()),
                        2 => ("🐣".to_string(), "Anak Burung".to_string()),
                        3 => ("🐥".to_string(), "Burung Kecil".to_string()),
                        _ => ("🦉".to_string(), "Burung Malam".to_string()),
                    }
                },
                "fenrir" => {
                    match stage {
                        1 => ("🥚".to_string(), "Telur Serigala".to_string()),
                        2 => ("🐾".to_string(), "Anak Serigala".to_string()),
                        3 => ("🐕".to_string(), "Serigala Muda".to_string()),
                        _ => ("🐺".to_string(), "Serigala Es".to_string()),
                    }
                },
                _ => ("🥚".to_string(), "Telur Misterius".to_string()),
            };

            pets.push(PetData {
                id: row.get("id"),
                pet_type: p_type,
                stage,
                exp: row.get("exp"),
                emoji,
                label,
            });
        }
        Ok(pets)
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(vec![])
    }
}

#[server]
pub async fn set_active_pet_server(email: String, pet_id: i32) -> Result<(), ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let pool = super::db::get_pool();
        let mut tx = pool.begin().await.map_err(|e| ServerFnError::new(e.to_string()))?;

        // Set all to false
        sqlx::query("UPDATE user_pets SET is_active = false WHERE email = $1")
            .bind(&email)
            .execute(&mut *tx)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;

        // Set target to true
        sqlx::query("UPDATE user_pets SET is_active = true WHERE id = $1 AND email = $2")
            .bind(pet_id)
            .bind(&email)
            .execute(&mut *tx)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;

        tx.commit().await.map_err(|e| ServerFnError::new(e.to_string()))?;
        Ok(())
    }
    #[cfg(target_arch = "wasm32")]
    {
        Ok(())
    }
}
