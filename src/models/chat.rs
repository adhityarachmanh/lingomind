// src/models/chat.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatSession {
    pub id: i32,
    pub username: String,
    pub language: String,
    pub level: String,
    pub roleplay_setting: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub id: i32,
    pub session_id: i32,
    pub sender: String, // "user" atau "ai"
    pub content: String,
}