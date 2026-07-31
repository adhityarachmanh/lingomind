use serde::{Deserialize, Serialize};
use crate::models::weakness::{WeaknessItem, WeaknessAnalyticsItem, SkillProgressPoint};
use crate::models::mission::DailyMission;
use crate::models::engagement::UserEngagementStats;
use crate::models::badge::Badge;
use crate::models::social::{QuizBattle, SocialFeedItem};
use crate::models::pet::PetData;

#[derive(Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct DashboardSummary {
    pub due_flashcard_count: i32,
    pub top_weaknesses: Vec<WeaknessItem>,
    pub daily_mission: Option<DailyMission>,
    pub weakness_analytics_trend: Vec<WeaknessAnalyticsItem>,
    pub skill_progress: Vec<SkillProgressPoint>,
    pub engagement: Option<UserEngagementStats>,
    pub badges: Vec<Badge>,
    pub active_battles: Vec<QuizBattle>,
    pub active_pet: Option<PetData>,
    pub social_feed: Vec<SocialFeedItem>,
}
