// src/routes.rs
use dioxus::prelude::*;
use crate::views::login::Login;
use crate::views::register::Register;
use crate::views::dashboard::Dashboard;
use crate::views::quiz::Quiz;
use crate::views::lesson::Lesson;
use crate::views::chat::ChatRoleplay;
use crate::views::flashcard_review::FlashcardReview;
use crate::views::weakness_practice::WeaknessPractice;
use crate::views::weakness_analytics::WeaknessAnalytics;

#[derive(Debug, Clone, Routable, PartialEq)]
#[rustfmt::skip]
pub enum Route {
    #[layout(crate::components::navbar::Navbar)]
    #[route("/")]
    Login {},
    #[route("/register")]
    Register {},
    #[route("/dashboard")]
    Dashboard {},
    #[route("/lesson/:level/:goal")]
    Lesson { level: String, goal: String },
    #[route("/quiz/:level/:goal")]
    Quiz { level: String, goal: String },
    #[route("/chat/:level/:goal")]
    ChatRoleplay { level: String, goal: String },
    #[route("/review")]
    FlashcardReview {},
    #[route("/practice/:level/:goal")]
    WeaknessPractice { level: String, goal: String },
    #[route("/analytics")]
    WeaknessAnalytics {},
}
