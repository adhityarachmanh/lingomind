// src/models/lesson.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct LessonVocab {
    pub word: String,
    pub meaning: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct LessonContainer {
    pub title: String,
    pub content: String,
    pub vocabulary: Vec<LessonVocab>,
    pub example_sentences: Vec<String>,
}