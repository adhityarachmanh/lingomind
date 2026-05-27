// src/views/mod.rs
pub mod admin;
pub mod login;
pub mod register;
pub mod dashboard;
pub mod quiz;
pub mod lesson;
pub mod chat;
pub mod voice_chat;

pub mod flashcard_review;
pub mod pronunciation_practice;

pub mod weakness_practice;
pub mod general_practice;

pub mod weakness_analytics;

pub mod roadmap;

pub mod leaderboard;
pub mod forgot_password;
pub mod reset_password;
pub mod verify_email;
pub mod guide;
pub mod placement_test;
pub mod exam;
pub mod shop;
pub mod profile;
pub mod story;

pub fn insert_newline_after_marker_case_insensitive(text: &str, marker: &str) -> String {
    let text_lower = text.to_lowercase();
    let marker_lower = marker.to_lowercase();

    if let Some(idx) = text_lower.find(&marker_lower) {
        let split_at = idx + marker.len();
        let left = text[..split_at].trim_end();
        let right = text[split_at..].trim_start();
        format!("{left}\n{right}")
    } else {
        text.to_string()
    }
}

pub fn format_question_for_display(question: &str) -> Vec<String> {
    let mut formatted = question
        .replace("Read the dialogue:", "Read the dialogue:\n")
        .replace("Read the dialog:", "Read the dialog:\n")
        .replace("read the dialogue:", "read the dialogue:\n")
        .replace("read the dialog:", "read the dialog:\n");

    for marker in [
        "based on the context:",
        "based on context:",
        "based on the sentence:",
        "in the context:",
    ] {
        formatted = insert_newline_after_marker_case_insensitive(&formatted, marker);
    }

    formatted = formatted
        .replace("sentence: ", "sentence:\n")
        .replace("blank: ", "blank:\n")
        .replace("word: ", "word:\n")
        .replace("following: ", "following:\n")
        .replace("question: ", "question:\n")
        .replace("statement: ", "statement:\n")
        .replace(": '", ":\n'")
        .replace(": \"", ":\n\"");

    for marker in ["A:", "B:", "C:", "D:", "E:", "F:", "X:", "Y:"] {
        // Space before speaker
        let from = format!(" {marker}");
        let to = format!("\n{marker}");
        formatted = formatted.replace(&from, &to);
        
        // Quote before speaker (e.g. "A:)
        let from_quote = format!("\"{marker}");
        let to_quote = format!("\"\n{marker}");
        formatted = formatted.replace(&from_quote, &to_quote);
    }

    // Split text after the dialogue ends. E.g. "Nice to meet you too, Mia." What are...
    formatted = formatted.replace(".\" ", ".\"\n");
    formatted = formatted.replace("!\" ", "!\"\n");
    formatted = formatted.replace("?\" ", "?\"\n");

    formatted
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .map(|line| line.to_string())
        .collect()
}
