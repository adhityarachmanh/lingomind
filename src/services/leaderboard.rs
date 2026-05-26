// src/services/leaderboard.rs
use dioxus::prelude::*;
use crate::models::leaderboard::LeaderboardEntry;
use crate::models::league::{LeagueMember, WeeklyLeagueData};

#[server]
pub async fn get_leaderboard_server(limit: i32) -> Result<Vec<LeaderboardEntry>, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    use sqlx::Row;

    let pool = super::db::get_pool();
    let safe_limit = limit.clamp(10, 100);

    let rows = sqlx::query(
        r#"
            SELECT u.email, u.full_name, u.score,
                   COALESCE(e.current_streak, 0) AS current_streak,
                   COALESCE(e.total_quiz_completed, 0) AS total_quiz_completed,
                   e.active_frame,
                   e.active_title,
                   e.active_name_color
            FROM users u
            LEFT JOIN user_engagement_stats e ON u.email = e.email
            WHERE u.role != 'admin'
            ORDER BY u.score DESC
            LIMIT $1"#
    )
    .bind(safe_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| ServerFnError::new(format!("Gagal mengambil data leaderboard: {e}")))?;

    let mut entries = Vec::new();
    for (i, row) in rows.into_iter().enumerate() {
        entries.push(LeaderboardEntry {
            rank: (i + 1) as i32,
            email: row.get("email"),
            full_name: row.get("full_name"),
            score: row.get::<Option<i32>, _>("score").unwrap_or(0),
            current_streak: row.get("current_streak"),
            total_quiz_completed: row.get("total_quiz_completed"),
            active_frame: row.try_get("active_frame").ok(),
            active_title: row.try_get("active_title").ok(),
            active_name_color: row.try_get("active_name_color").ok(),
        });
    }

    Ok(entries)
}

#[server]
pub async fn get_weekly_league_server(email: String) -> Result<WeeklyLeagueData, ServerFnError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use sqlx::Row;
        let pool = super::db::get_pool();
        
        let mut tx = pool.begin().await.map_err(|e| ServerFnError::new(e.to_string()))?;
        
        // 1. Cek apakah user sudah masuk ke grup minggu ini
        let current_membership_opt = sqlx::query(
            r#"
            SELECT m.group_id, g.division, g.week_start_date 
            FROM user_league_members m
            JOIN league_groups g ON m.group_id = g.id
            WHERE m.email = $1 AND g.week_start_date = date_trunc('week', CURRENT_DATE)
            "#
        )
        .bind(&email)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;

        let (group_id, division) = if let Some(m) = current_membership_opt {
            (m.get::<i32, _>("group_id"), m.get::<String, _>("division"))
        } else {
            // Belum masuk. Cari tau divisi dari minggu lalu.
            // Simplified logic: If no previous, start at Bronze.
            // To make it fully functional with promote/demote, we would query the previous week.
            let mut target_division = "Bronze".to_string();
            
            let prev_membership_opt = sqlx::query(
                r#"
                WITH RankedMembers AS (
                    SELECT m.email, m.group_id, g.division,
                           ROW_NUMBER() OVER(PARTITION BY m.group_id ORDER BY m.league_score DESC) as rnk
                    FROM user_league_members m
                    JOIN league_groups g ON m.group_id = g.id
                    WHERE m.email = $1 AND g.week_start_date = date_trunc('week', CURRENT_DATE) - INTERVAL '1 week'
                )
                SELECT division, rnk FROM RankedMembers LIMIT 1
                "#
            )
            .bind(&email)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;

            if let Some(prev) = prev_membership_opt {
                let prev_div: String = prev.get("division");
                let prev_rnk: i64 = prev.get("rnk");
                
                let divisions = vec!["Bronze", "Silver", "Gold", "Diamond"];
                let prev_idx = divisions.iter().position(|&r| r == prev_div).unwrap_or(0);
                
                let new_idx = if prev_rnk <= 5 {
                    (prev_idx + 1).min(3) // Promosi
                } else if prev_rnk >= 26 {
                    prev_idx.saturating_sub(1) // Degradasi
                } else {
                    prev_idx // Aman
                };
                
                target_division = divisions[new_idx].to_string();
            }

            // Cari grup minggu ini dengan divisi yang sama dan isi < 30
            let available_group_opt = sqlx::query(
                "SELECT id FROM league_groups WHERE division = $1 AND week_start_date = date_trunc('week', CURRENT_DATE) AND member_count < 30 LIMIT 1 FOR UPDATE"
            )
            .bind(&target_division)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;

            let new_group_id = if let Some(grp) = available_group_opt {
                let id: i32 = grp.get("id");
                sqlx::query("UPDATE league_groups SET member_count = member_count + 1 WHERE id = $1")
                    .bind(id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| ServerFnError::new(e.to_string()))?;
                id
            } else {
                let row = sqlx::query(
                    "INSERT INTO league_groups (division, week_start_date, member_count) VALUES ($1, date_trunc('week', CURRENT_DATE), 1) RETURNING id"
                )
                .bind(&target_division)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| ServerFnError::new(e.to_string()))?;
                row.get("id")
            };

            sqlx::query("INSERT INTO user_league_members (email, group_id, league_score) VALUES ($1, $2, 0)")
                .bind(&email)
                .bind(new_group_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| ServerFnError::new(e.to_string()))?;

            (new_group_id, target_division)
        };

        // Ambil semua member di grup tersebut
        let member_rows = sqlx::query(
            r#"
            SELECT m.email, u.full_name, m.league_score,
                   e.active_frame, e.active_title, e.active_name_color
            FROM user_league_members m
            JOIN users u ON m.email = u.email
            LEFT JOIN user_engagement_stats e ON m.email = e.email
            WHERE m.group_id = $1
            ORDER BY m.league_score DESC
            "#
        )
        .bind(group_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| ServerFnError::new(e.to_string()))?;
        
        tx.commit().await.map_err(|e| ServerFnError::new(e.to_string()))?;

        let mut members = Vec::new();
        for (i, row) in member_rows.into_iter().enumerate() {
            let rnk = (i + 1) as i32;
            let status_zone = if rnk <= 5 {
                "promosi"
            } else if rnk >= 26 {
                "degradasi"
            } else {
                "aman"
            };
            
            members.push(LeagueMember {
                email: row.get("email"),
                full_name: row.get("full_name"),
                league_score: row.get("league_score"),
                rank: rnk,
                division: division.clone(),
                status_zone: status_zone.to_string(),
                active_frame: row.try_get("active_frame").ok(),
                active_title: row.try_get("active_title").ok(),
                active_name_color: row.try_get("active_name_color").ok(),
            });
        }

        let days_left_row = sqlx::query("SELECT EXTRACT(DAY FROM (date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' - CURRENT_TIMESTAMP))::int AS days_left")
            .fetch_one(super::db::get_pool())
            .await
            .map_err(|e| ServerFnError::new(e.to_string()))?;
        let days_left: i32 = days_left_row.get("days_left");

        Ok(WeeklyLeagueData {
            division,
            members,
            days_left,
        })
    }
    #[cfg(target_arch = "wasm32")]
    {
        Err(ServerFnError::new("Cannot execute on client"))
    }
}
