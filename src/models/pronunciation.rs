use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct WordPronunciation {
    pub word: String,
    pub status: String, // "correct", "incorrect", "missing"
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct PronunciationEvaluation {
    pub score: i32,
    pub feedback: String,
    pub word_results: Vec<WordPronunciation>,
}
