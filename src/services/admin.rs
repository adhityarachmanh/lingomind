use dioxus::prelude::*;
use crate::models::user::UserProfile;

#[cfg(feature = "server")]
use sqlx::Row;

#[server]
pub async fn check_is_admin_server(email: String) -> Result<bool, ServerFnError> {
    let pool = crate::services::db::get_pool();
    let row = sqlx::query("SELECT role FROM users WHERE email = $1")
        .bind(email.trim())
        .fetch_optional(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    match row {
        Some(u) => {
            let role: String = u.get("role");
            Ok(role == "admin")
        },
        None => Ok(false),
    }
}

use crate::models::admin::{AppConfigItem, MissionConfigItem, ShopItemAdmin, LanguageAdmin};

#[server]
pub async fn get_app_configs_admin(email: String) -> Result<Vec<AppConfigItem>, ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    let rows = sqlx::query("SELECT key, value, description FROM app_config")
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    let mut configs = Vec::new();
    for row in rows {
        configs.push(AppConfigItem {
            key: row.get("key"),
            value: row.get("value"),
            description: row.get("description"),
        });
    }
    Ok(configs)
}

#[server]
pub async fn update_app_config_admin(email: String, key: String, value: String) -> Result<(), ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    sqlx::query("UPDATE app_config SET value = $1 WHERE key = $2")
        .bind(value)
        .bind(key)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    Ok(())
}

#[server]
pub async fn get_mission_configs_admin(email: String) -> Result<Vec<MissionConfigItem>, ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    let rows = sqlx::query("SELECT id, name, lesson_target, quiz_target, weakness_target, flashcard_target_min, flashcard_target_max FROM mission_config ORDER BY id")
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    let mut missions = Vec::new();
    for row in rows {
        missions.push(MissionConfigItem {
            id: row.get("id"),
            name: row.get("name"),
            lesson_target: row.get("lesson_target"),
            quiz_target: row.get("quiz_target"),
            weakness_target: row.get("weakness_target"),
            flashcard_target_min: row.get("flashcard_target_min"),
            flashcard_target_max: row.get("flashcard_target_max"),
        });
    }
    Ok(missions)
}

#[server]
pub async fn update_mission_config_admin(email: String, config: MissionConfigItem) -> Result<(), ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    sqlx::query("UPDATE mission_config SET lesson_target = $1, quiz_target = $2, weakness_target = $3, flashcard_target_min = $4, flashcard_target_max = $5 WHERE id = $6")
        .bind(config.lesson_target)
        .bind(config.quiz_target)
        .bind(config.weakness_target)
        .bind(config.flashcard_target_min)
        .bind(config.flashcard_target_max)
        .bind(config.id)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    Ok(())
}

#[server]
pub async fn get_languages_admin(email: String) -> Result<Vec<LanguageAdmin>, ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    let rows = sqlx::query("SELECT id, name, native_name, flag, description, theme_class, button_class, category, tts_lang_code FROM languages ORDER BY name")
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    let mut langs = Vec::new();
    for row in rows {
        langs.push(LanguageAdmin {
            id: row.get("id"),
            name: row.get("name"),
            native_name: row.get("native_name"),
            flag: row.get("flag"),
            description: row.get("description"),
            theme_class: row.get("theme_class"),
            button_class: row.get("button_class"),
            category: row.get("category"),
            tts_lang_code: row.get("tts_lang_code"),
        });
    }
    Ok(langs)
}

#[server]
pub async fn update_language_admin(email: String, lang: LanguageAdmin) -> Result<(), ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    sqlx::query("UPDATE languages SET name = $1, native_name = $2, flag = $3, description = $4, theme_class = $5, button_class = $6, category = $7, tts_lang_code = $8 WHERE id = $9")
        .bind(lang.name)
        .bind(lang.native_name)
        .bind(lang.flag)
        .bind(lang.description)
        .bind(lang.theme_class)
        .bind(lang.button_class)
        .bind(lang.category)
        .bind(lang.tts_lang_code)
        .bind(lang.id)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    Ok(())
}

#[server]
pub async fn create_language_admin(email: String, lang: LanguageAdmin) -> Result<(), ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    sqlx::query("INSERT INTO languages (id, name, native_name, flag, description, theme_class, button_class, category, tts_lang_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)")
        .bind(lang.id)
        .bind(lang.name)
        .bind(lang.native_name)
        .bind(lang.flag)
        .bind(lang.description)
        .bind(lang.theme_class)
        .bind(lang.button_class)
        .bind(lang.category)
        .bind(lang.tts_lang_code)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    Ok(())
}

#[server]
pub async fn get_shop_items_admin(email: String) -> Result<Vec<ShopItemAdmin>, ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    let rows = sqlx::query("SELECT id, name, description, cost, effect_type, icon_name FROM shop_items ORDER BY cost")
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    let mut items = Vec::new();
    for row in rows {
        items.push(ShopItemAdmin {
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

#[server]
pub async fn update_shop_item_admin(email: String, item: ShopItemAdmin) -> Result<(), ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    sqlx::query("UPDATE shop_items SET name = $1, description = $2, cost = $3, effect_type = $4, icon_name = $5 WHERE id = $6")
        .bind(item.name)
        .bind(item.description)
        .bind(item.cost)
        .bind(item.effect_type)
        .bind(item.icon_name)
        .bind(item.id)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    Ok(())
}

#[server]
pub async fn create_shop_item_admin(
    email: String,
    name: String,
    description: Option<String>,
    cost: i32,
    effect_type: String,
    icon_name: Option<String>,
) -> Result<(), ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    sqlx::query("INSERT INTO shop_items (name, description, cost, effect_type, icon_name) VALUES ($1, $2, $3, $4, $5)")
        .bind(name)
        .bind(description)
        .bind(cost)
        .bind(effect_type)
        .bind(icon_name)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    Ok(())
}

#[server]
pub async fn get_levels_admin(email: String) -> Result<Vec<crate::models::admin::LevelAdminItem>, ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    let rows = sqlx::query("SELECT id, title, description, base_reward_points, order_index FROM levels ORDER BY order_index")
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    let mut levels = Vec::new();
    for row in rows {
        levels.push(crate::models::admin::LevelAdminItem {
            id: row.get("id"),
            title: row.get("title"),
            description: row.get("description"),
            base_reward_points: row.get("base_reward_points"),
            order_index: row.get("order_index"),
        });
    }
    Ok(levels)
}

#[server]
pub async fn update_level_admin(email: String, level: crate::models::admin::LevelAdminItem) -> Result<(), ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    sqlx::query("UPDATE levels SET title = $1, description = $2, base_reward_points = $3, order_index = $4 WHERE id = $5")
        .bind(level.title)
        .bind(level.description)
        .bind(level.base_reward_points)
        .bind(level.order_index)
        .bind(level.id)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    Ok(())
}

#[server]
pub async fn get_topics_admin(email: String, level_id: String) -> Result<Vec<crate::models::admin::TopicAdminItem>, ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    let rows = sqlx::query("SELECT id, level_id, title, order_index FROM topics WHERE level_id = $1 ORDER BY order_index")
        .bind(level_id)
        .fetch_all(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    let mut topics = Vec::new();
    for row in rows {
        topics.push(crate::models::admin::TopicAdminItem {
            id: row.get("id"),
            level_id: row.get("level_id"),
            title: row.get("title"),
            order_index: row.get("order_index"),
        });
    }
    Ok(topics)
}

#[server]
pub async fn update_topic_admin(email: String, topic: crate::models::admin::TopicAdminItem) -> Result<(), ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    sqlx::query("UPDATE topics SET title = $1, order_index = $2 WHERE id = $3")
        .bind(topic.title)
        .bind(topic.order_index)
        .bind(topic.id)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    Ok(())
}

#[server]
pub async fn create_level_admin(email: String, level: crate::models::admin::LevelAdminItem) -> Result<(), ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    sqlx::query("INSERT INTO levels (id, title, description, base_reward_points, order_index) VALUES ($1, $2, $3, $4, $5)")
        .bind(level.id)
        .bind(level.title)
        .bind(level.description)
        .bind(level.base_reward_points)
        .bind(level.order_index)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    Ok(())
}

#[server]
pub async fn create_topic_admin(email: String, level_id: String, title: String, order_index: i32) -> Result<(), ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    sqlx::query("INSERT INTO topics (level_id, title, order_index) VALUES ($1, $2, $3)")
        .bind(level_id)
        .bind(title)
        .bind(order_index)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    Ok(())
}

#[server]
pub async fn get_users_admin(email: String) -> Result<Vec<crate::models::admin::UserAdminItem>, ServerFnError> {
    if !check_is_admin_server(email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    let rows = sqlx::query(
        "SELECT u.email, u.full_name, u.role, u.is_verified, u.score, 
                COALESCE(e.coins, 0) as coins, 
                COALESCE(e.current_streak, 0) as streak_days 
         FROM users u 
         LEFT JOIN user_engagement_stats e ON u.email = e.email 
         ORDER BY u.email"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    let mut users = Vec::new();
    for row in rows {
        let coins_raw: i32 = row.try_get("coins").unwrap_or(0);
        let streak_raw: i32 = row.try_get("streak_days").unwrap_or(0);
        
        users.push(crate::models::admin::UserAdminItem {
            email: row.get("email"),
            full_name: row.try_get("full_name").unwrap_or_else(|_| "Unknown".to_string()),
            role: row.try_get("role").unwrap_or_else(|_| "user".to_string()),
            is_verified: row.try_get("is_verified").unwrap_or(false),
            score: row.try_get("score").unwrap_or(0),
            coins: coins_raw as i32,
            streak_days: streak_raw as i32,
        });
    }
    Ok(users)
}

#[server]
pub async fn update_user_role_admin(admin_email: String, target_email: String, new_role: String) -> Result<(), ServerFnError> {
    if !check_is_admin_server(admin_email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    sqlx::query("UPDATE users SET role = $1 WHERE email = $2")
        .bind(new_role)
        .bind(target_email)
        .execute(pool)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
    Ok(())
}

#[server]
pub async fn reset_user_progress_admin(admin_email: String, target_email: String) -> Result<(), ServerFnError> {
    if !check_is_admin_server(admin_email).await? {
        return Err(ServerFnError::new("Akses ditolak."));
    }
    
    let pool = crate::services::db::get_pool();
    let mut tx = pool.begin().await.map_err(|e| ServerFnError::new(e.to_string()))?;

    let e = target_email;

    // Delete user specific data from various tables
    let tables_with_email = vec![
        "chat_sessions",
        "flashcards",
        "weakness_logs",
        "user_language_goals",
        "skill_progress_logs",
        "user_engagement_stats",
        "password_resets",
        "user_badges",
        "email_verification_tokens",
        "user_progress_logs",
        "user_language_progress",
    ];

    for tbl in tables_with_email {
        let query = format!("DELETE FROM {} WHERE email = $1", tbl);
        sqlx::query(&query).bind(&e).execute(&mut *tx).await.map_err(|err| ServerFnError::new(err.to_string()))?;
    }

    // Delete from followers and quiz_battles
    sqlx::query("DELETE FROM followers WHERE follower_email = $1 OR followed_email = $1").bind(&e).execute(&mut *tx).await.map_err(|err| ServerFnError::new(err.to_string()))?;
    sqlx::query("DELETE FROM quiz_battles WHERE challenger_email = $1 OR challenged_email = $1").bind(&e).execute(&mut *tx).await.map_err(|err| ServerFnError::new(err.to_string()))?;

    // Update user score and language
    sqlx::query("UPDATE users SET score = 0, preferred_language = 'English' WHERE email = $1")
        .bind(&e)
        .execute(&mut *tx)
        .await
        .map_err(|err| ServerFnError::new(err.to_string()))?;

    tx.commit().await.map_err(|err| ServerFnError::new(err.to_string()))?;

    Ok(())
}
