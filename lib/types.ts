export interface UserProfile {
  email: string; full_name: string; preferred_language: string;
  score: number; current_level: Record<string, string>; role: string;
}
export interface EngagementStats {
  current_streak: number; longest_streak: number; total_quiz_completed: number;
  total_points_earned: number; coins: number; streak_freezes: number;
  previous_streak: number; double_xp_until: Date | null; exam_retake_tickets: number;
  hearts: number; last_heart_refill: Date | null;
  last_active_date: Date | null; has_weekend_amulet: boolean | null;
}
export interface DailyMission {
  lessons_completed: number; quizzes_completed: number; weakness_practices_completed: number;
  flashcards_reviewed: number; is_completed: boolean; reward_claimed: boolean;
  lesson_target: number; quiz_target: number; weakness_target: number; flashcard_target: number;
  correct_answers_today: number; pvp_wins_today: number;
  tier1_claimed: boolean; tier2_claimed: boolean; tier3_claimed: boolean;
}
export interface LanguageCourse {
  id: string; name: string; native_name: string; flag: string; description: string;
  theme_class: string; button_class: string; category: string;
  tts_lang_code: string; edge_tts_voice: string | null;
}
export interface CurriculumLevel {
  level: string; title: string; description: string;
  base_reward_points: number; topics: string[];
}
export interface FlashcardItem {
  id: number; email: string; language: string; front_text: string; back_text: string;
  ease_factor: number; interval_days: number; repetition: number;
}
export interface NewFlashcard { language: string; front_text: string; back_text: string; }
export interface VocabularyItem { word: string; meaning: string; }
export interface ExampleSentence { target: string; meaning: string; }
export interface LessonContainer {
  title: string;
  content: string;
  vocabulary: VocabularyItem[];
  example_sentences: ExampleSentence[];
}
export interface QuizQuestion {
  question: string;
  question_type: string;
  listen_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}
export interface QuizContainer { questions: QuizQuestion[]; }
export interface ChatMessageItem { id: number; sender: "user" | "ai"; content: string; }
