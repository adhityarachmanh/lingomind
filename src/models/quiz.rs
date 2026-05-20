use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct QuizQuestion {
    pub question: String,
    pub options: Vec<String>,
    pub correct_answer: String,
    pub explanation: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct QuizContainer {
    pub questions: Vec<QuizQuestion>,
}