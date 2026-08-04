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
  kind: string; ease_factor: number; interval_days: number; repetition: number;
}
export interface NewFlashcard { language: string; front_text: string; back_text: string; kind?: string; }
export interface VocabularyItem { word: string; meaning: string; }
export interface TranslationQuestion { sentence: string; options: string[]; correct: string; }
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
export interface StoryQuestion { question_text: string; options: string[]; correct_answer: string; explanation: string; }
export interface StorySegment { text: string; speaker: string | null; translation: string; question: StoryQuestion | null; }
export interface StoryData { title: string; title_translation: string; segments: StorySegment[]; }
export interface WordResult { word: string; status: "correct" | "incorrect" | "missing"; }
export interface BadgeItem {
  id: number; name: string; description: string; icon_name: string;
  requirement_type: string; requirement_value: number;
}
export interface PronunciationEvaluation { score: number; feedback: string; word_results: WordResult[]; }
export interface ShopItem {
  id: number; name: string; description: string | null;
  cost: number; effect_type: string; icon_name: string | null;
}
export interface PublicProfile {
  email: string;
  full_name: string;
  score: number;
  current_streak: number;
  longest_streak: number;
  active_frame: string | null;
  active_title: string | null;
  active_name_color: string | null;
  joined_date: string;
  badges: BadgeItem[];
  owned_frames: string[];
  owned_titles: string[];
  owned_colors: string[];
}
export interface LeagueMemberRow {
  email: string; full_name: string; league_score: number;
  active_frame: string | null; active_title: string | null; active_name_color: string | null;
  rank: number; zone: "promosi" | "degradasi" | "aman";
}
export interface LeaderboardRow {
  email: string; full_name: string; score: number; current_streak: number;
  total_quiz_completed: number; active_frame: string | null;
  active_title: string | null; active_name_color: string | null; rank: number;
}
export interface FeedItem {
  id: number; email: string; full_name: string; emoji: string;
  activity_type: string; content: string; likes_count: number;
  created_at: string; has_liked: boolean;
}
export interface SearchUserRow {
  email: string; full_name: string; score: number; current_streak: number;
  total_quiz_completed: number; active_frame: string | null; active_title: string | null;
  active_name_color: string | null; rank: number; is_following: boolean;
}
export interface BattleItem {
  id: number; challenger_email: string; challenged_email: string; language: string; goal: string;
  status: string; my_score: number | null; opponent_score: number | null;
  opponent_name: string; created_at: Date | null;
}
export interface PetItem {
  id: number; pet_type: string; stage: number; exp: number; emoji: string; label: string; is_active: boolean;
}
export interface WeaknessAnalyticsItem { topic: string; count_7d: number; count_30d: number; }
export interface AdminUserRow {
  email: string; full_name: string; role: string | null; is_verified: boolean | null;
  score: number; coins: number; streak_days: number;
}
export interface AdminShopItem {
  id: number; name: string; description: string | null;
  cost: number; effect_type: string; icon_name: string | null;
}
export interface AdminLanguageItem {
  id: string; name: string; native_name: string; flag: string; description: string;
  theme_class: string; button_class: string; category: string;
  tts_lang_code: string; edge_tts_voice: string | null;
}
export interface AdminLevelItem {
  id: string; title: string; description: string; base_reward_points: number; order_index: number;
}
export interface AdminTopicItem {
  id: number; level_id: string; title: string; order_index: number;
}
export interface AdminMissionConfigItem {
  id: number; name: string; lesson_target: number; quiz_target: number;
  weakness_target: number; flashcard_target_min: number; flashcard_target_max: number;
}
export interface SkillProgressPoint { day: string; grammar: number; vocabulary: number; listening: number; }
