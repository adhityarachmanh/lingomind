use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StoryQuestion {
    pub question_text: String,
    pub options: Vec<String>,
    pub correct_answer: String,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StorySegment {
    pub text: String,
    pub speaker: Option<String>,
    pub translation: String,
    pub question: Option<StoryQuestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StoryData {
    pub title: String,
    pub title_translation: String,
    pub segments: Vec<StorySegment>,
}
