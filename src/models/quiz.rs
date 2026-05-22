use serde::{Deserialize, Serialize};

fn default_question_type() -> String {
    "text".to_string()
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct QuizQuestion {
    pub question: String,
    #[serde(default = "default_question_type")]
    pub question_type: String,
    #[serde(default)]
    pub listen_text: String,
    pub options: Vec<String>,
    pub correct_answer: String,
    pub explanation: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct QuizContainer {
    pub questions: Vec<QuizQuestion>,
}
