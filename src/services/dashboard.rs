use dioxus::prelude::*;
use crate::models::dashboard::DashboardSummary;
use crate::services::flashcard::get_due_flashcard_count_server;
use crate::services::weakness::{get_top_weaknesses_server, get_weakness_analytics_server, get_skill_progress_7d_server};
use crate::services::mission::get_daily_mission_server;
use crate::services::engagement::get_engagement_stats_server;
use crate::services::badge::get_user_badges_server;
use crate::services::battle::get_active_battles_server;
use crate::services::pet::get_active_pet_server;
use crate::services::social::get_social_feed_server;

#[server]
pub async fn get_dashboard_summary_server(
    email: String,
    language: String,
) -> Result<DashboardSummary, ServerFnError> {
    let (
        due_flashcard_count_res,
        top_weaknesses_res,
        daily_mission_res,
        weakness_analytics_trend_res,
        skill_progress_res,
        engagement_res,
        badges_res,
        active_battles_res,
        active_pet_res,
        social_feed_res
    ) = tokio::join!(
        get_due_flashcard_count_server(email.clone(), language.clone()),
        get_top_weaknesses_server(email.clone(), language.clone(), 2),
        get_daily_mission_server(email.clone(), language.clone()),
        get_weakness_analytics_server(email.clone(), language.clone(), 1),
        get_skill_progress_7d_server(email.clone(), language.clone()),
        get_engagement_stats_server(email.clone()),
        get_user_badges_server(email.clone()),
        get_active_battles_server(email.clone()),
        get_active_pet_server(email.clone()),
        get_social_feed_server(email.clone())
    );

    Ok(DashboardSummary {
        due_flashcard_count: due_flashcard_count_res.unwrap_or(0) as i32,
        top_weaknesses: top_weaknesses_res.unwrap_or_default(),
        daily_mission: daily_mission_res.ok(),
        weakness_analytics_trend: weakness_analytics_trend_res.unwrap_or_default(),
        skill_progress: skill_progress_res.unwrap_or_default(),
        engagement: engagement_res.ok(),
        badges: badges_res.unwrap_or_default(),
        active_battles: active_battles_res.unwrap_or_default(),
        active_pet: active_pet_res.ok().flatten(),
        social_feed: social_feed_res.unwrap_or_default(),
    })
}
