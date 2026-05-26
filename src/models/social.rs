// src/models/social.rs
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SocialUser {
    pub email: String,
    pub full_name: String,
    pub is_following: bool, // true if current user follows this person
    pub score: i32,
    pub rank: i32,
    pub current_streak: i32,
    pub total_quiz_completed: i32,
    pub active_frame: Option<String>,
    pub active_title: Option<String>,
    pub active_name_color: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct QuizBattle {
    pub id: i32,
    pub challenger_email: String,
    pub challenger_name: String,
    pub challenged_email: String,
    pub challenged_name: String,
    pub language: String,
    pub goal: String,
    pub challenger_score: i32,
    pub challenged_score: Option<i32>,
    pub status: String,
}
