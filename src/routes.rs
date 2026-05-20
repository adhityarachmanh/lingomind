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
use crate::views::placement::PlacementTest;

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
    #[route("/lesson/:language/:level/:goal")]
    Lesson { language: String, level: String, goal: String },
    #[route("/quiz/:language/:level/:goal")]
    Quiz { language: String, level: String, goal: String },
    #[route("/chat/:language/:level/:goal")]
    ChatRoleplay { language: String, level: String, goal: String },
    #[route("/review/:language")]
    FlashcardReview { language: String },
    #[route("/practice/:language/:level/:goal")]
    WeaknessPractice { language: String, level: String, goal: String },
    #[route("/analytics/:language")]
    WeaknessAnalytics { language: String },
    #[route("/placement")]
    PlacementTest {},
}
