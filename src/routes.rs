// src/routes.rs
use dioxus::prelude::*;
use crate::views::login::Login;
use crate::views::register::Register;
use crate::views::dashboard::Dashboard;
use crate::views::quiz::Quiz;
use crate::views::lesson::Lesson;
use crate::views::chat::ChatRoleplay;
use crate::views::voice_chat::VoiceChat;
use crate::views::pronunciation_practice::PronunciationPractice;
use crate::views::flashcard_review::FlashcardReview;
use crate::views::weakness_practice::WeaknessPractice;
use crate::views::general_practice::GeneralPractice;
use crate::views::weakness_analytics::WeaknessAnalytics;
use crate::views::roadmap::Roadmap;
use crate::views::leaderboard::Leaderboard;
use crate::views::forgot_password::ForgotPassword;
use crate::views::reset_password::ResetPassword;
use crate::views::verify_email::VerifyEmail;
use crate::views::guide::Guide;
use crate::views::placement_test::PlacementTest;
use crate::views::exam::Exam;
use crate::views::admin::login::AdminLogin;
use crate::views::admin::dashboard::AdminDashboard;
use crate::views::shop::Shop;
use crate::views::profile::Profile;
use crate::views::story::Story;

#[derive(Debug, Clone, Routable, PartialEq)]
#[rustfmt::skip]
pub enum Route {
    #[layout(crate::components::navbar::Navbar)]
    #[route("/")]
    Login {},
    #[route("/register")]
    Register {},
    #[route("/verify-email?:token")]
    VerifyEmail { token: String },
    #[route("/forgot-password")]
    ForgotPassword {},
    #[route("/reset-password?:token")]
    ResetPassword { token: String },
    #[route("/dashboard")]
    Dashboard {},
    #[route("/roadmap")]
    Roadmap {},
    #[route("/lesson/:level/:goal")]
    LessonLegacy { level: String, goal: String },
    #[route("/lesson/:goal")]
    Lesson { goal: String },
    #[route("/quiz/:level/:goal")]
    QuizLegacy { level: String, goal: String },
    #[route("/quiz/:goal?:battle_id")]
    Quiz { goal: String, battle_id: Option<i32> },
    #[route("/chat/:level/:goal")]
    ChatRoleplayLegacy { level: String, goal: String },
    #[route("/chat/:goal")]
    ChatRoleplay { goal: String },
    #[route("/voice-chat/:level/:goal")]
    VoiceChatLegacy { level: String, goal: String },
    #[route("/voice-chat/:goal")]
    VoiceChat { goal: String },
    #[route("/pronunciation-practice")]
    PronunciationPractice {},
    #[route("/flashcard-review")]
    FlashcardReview {},
    #[route("/practice/:level/:goal")]
    WeaknessPracticeLegacy { level: String, goal: String },
    #[route("/practice/:goal")]
    WeaknessPractice { goal: String },
    #[route("/general-practice")]
    GeneralPractice {},
    #[route("/analytics")]
    WeaknessAnalytics {},
    #[route("/leaderboard")]
    Leaderboard {},
    #[route("/guide")]
    Guide {},
    #[route("/placement")]
    PlacementTest {},
    #[route("/exam/:level")]
    Exam { level: String },
    #[route("/shop")]
    Shop {},
    #[route("/profile/:email")]
    Profile { email: String },
    #[route("/story/:goal")]
    Story { goal: String },

    #[end_layout]
    #[route("/admin/login")]
    AdminLogin {},
    #[redirect("/admin", || Route::AdminDashboard { tab: "konfigurasi".to_string() })]
    #[route("/admin/:tab")]
    AdminDashboard { tab: String },
}

#[component]
fn LessonLegacy(level: String, goal: String) -> Element {
    let _ = level;
    let navigator = use_navigator();
    use_effect(move || {
        navigator.replace(Route::Lesson { goal: goal.clone() });
    });

    rsx! { div { class: "min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center", "Mengarahkan ke route lesson terbaru..." } }
}

#[component]
fn QuizLegacy(level: String, goal: String) -> Element {
    let _ = level;
    let navigator = use_navigator();
    use_effect(move || {
        navigator.replace(Route::Quiz { goal: goal.clone(), battle_id: None });
    });

    rsx! { div { class: "min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center", "Mengarahkan ke route quiz terbaru..." } }
}

#[component]
fn ChatRoleplayLegacy(level: String, goal: String) -> Element {
    let _ = level;
    let navigator = use_navigator();
    use_effect(move || {
        navigator.replace(Route::ChatRoleplay { goal: goal.clone() });
    });

    rsx! { div { class: "min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center", "Mengarahkan ke route chat terbaru..." } }
}

#[component]
fn VoiceChatLegacy(level: String, goal: String) -> Element {
    let _ = level;
    let navigator = use_navigator();
    use_effect(move || {
        navigator.replace(Route::VoiceChat { goal: goal.clone() });
    });

    rsx! { div { class: "min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center", "Mengarahkan ke rute voice chat terbaru..." } }
}

#[component]
fn WeaknessPracticeLegacy(level: String, goal: String) -> Element {
    let _ = level;
    let navigator = use_navigator();
    use_effect(move || {
        navigator.replace(Route::WeaknessPractice { goal: goal.clone() });
    });

    rsx! { div { class: "min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center", "Mengarahkan ke route practice terbaru..." } }
}
