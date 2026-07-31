-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "score" INTEGER DEFAULT 0,
    "full_name" VARCHAR(120) NOT NULL,
    "preferred_language" TEXT NOT NULL,
    "is_verified" BOOLEAN DEFAULT false,
    "role" VARCHAR(50) DEFAULT 'user',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "language" VARCHAR(20) NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "roleplay_setting" VARCHAR(50) NOT NULL,
    "goal" TEXT NOT NULL DEFAULT 'General',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER,
    "sender" VARCHAR(10) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcards" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "front_text" TEXT NOT NULL,
    "back_text" TEXT NOT NULL,
    "ease_factor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval_days" INTEGER NOT NULL DEFAULT 1,
    "repetition" INTEGER NOT NULL DEFAULT 0,
    "due_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weakness_logs" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weakness_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_language_goals" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_language_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_progress_logs" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_progress_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_engagement_stats" (
    "email" TEXT NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "total_quiz_completed" INTEGER NOT NULL DEFAULT 0,
    "total_points_earned" INTEGER NOT NULL DEFAULT 0,
    "last_active_date" DATE,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "streak_freezes" INTEGER NOT NULL DEFAULT 0,
    "double_xp_until" TIMESTAMPTZ(6),
    "has_weekend_amulet" BOOLEAN DEFAULT false,
    "active_frame" VARCHAR(255),
    "previous_streak" INTEGER NOT NULL DEFAULT 0,
    "exam_retake_tickets" INTEGER NOT NULL DEFAULT 0,
    "active_title" TEXT,
    "active_name_color" TEXT,
    "hearts" INTEGER NOT NULL DEFAULT 5,
    "last_heart_refill" TIMESTAMPTZ(6),

    CONSTRAINT "user_engagement_stats_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_lessons" (
    "id" SERIAL NOT NULL,
    "language" VARCHAR(50) NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "goal" VARCHAR(100) NOT NULL,
    "part" INTEGER NOT NULL,
    "content_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "modifier" VARCHAR(50) NOT NULL DEFAULT 'normal',

    CONSTRAINT "cached_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_quizzes" (
    "id" SERIAL NOT NULL,
    "language" VARCHAR(50) NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "goal" VARCHAR(100) NOT NULL,
    "content_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "modifier" VARCHAR(50) NOT NULL DEFAULT 'normal',

    CONSTRAINT "cached_quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "icon_name" VARCHAR(255) NOT NULL,
    "requirement_type" VARCHAR(50) NOT NULL,
    "requirement_value" INTEGER NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "email" VARCHAR(255) NOT NULL,
    "badge_id" INTEGER NOT NULL,
    "earned_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("email","badge_id")
);

-- CreateTable
CREATE TABLE "followers" (
    "follower_email" VARCHAR(255) NOT NULL,
    "followed_email" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "followers_pkey" PRIMARY KEY ("follower_email","followed_email")
);

-- CreateTable
CREATE TABLE "quiz_battles" (
    "id" SERIAL NOT NULL,
    "challenger_email" VARCHAR(255) NOT NULL,
    "challenged_email" VARCHAR(255) NOT NULL,
    "language" VARCHAR(50) NOT NULL,
    "goal" VARCHAR(255) NOT NULL,
    "challenger_score" INTEGER DEFAULT 0,
    "challenged_score" INTEGER,
    "status" VARCHAR(50) DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_progress_logs" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "language" VARCHAR(50) NOT NULL,
    "activity_type" VARCHAR(50) NOT NULL,
    "topic" VARCHAR(255) NOT NULL,
    "score_gained" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "base_level" VARCHAR(10) NOT NULL,
    "topic_idx" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_progress_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "languages" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "native_name" VARCHAR(255) NOT NULL,
    "flag" VARCHAR(20) NOT NULL,
    "description" TEXT NOT NULL,
    "theme_class" VARCHAR(255) NOT NULL,
    "button_class" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "tts_lang_code" VARCHAR(20) NOT NULL,
    "edge_tts_voice" VARCHAR(50) NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" VARCHAR(10) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "base_reward_points" INTEGER NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" SERIAL NOT NULL,
    "level_id" VARCHAR(10) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_language_progress" (
    "email" VARCHAR(255) NOT NULL,
    "language_id" VARCHAR(50) NOT NULL,
    "base_level" VARCHAR(10) NOT NULL,
    "topic_idx" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "exam_cooldown_until" TIMESTAMPTZ(6),

    CONSTRAINT "user_language_progress_pkey" PRIMARY KEY ("email","language_id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "key" VARCHAR(255) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "description" TEXT,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "shop_items" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "cost" INTEGER NOT NULL,
    "effect_type" VARCHAR(255) NOT NULL,
    "icon_name" VARCHAR(255),

    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_config" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "lesson_target" INTEGER DEFAULT 1,
    "quiz_target" INTEGER DEFAULT 1,
    "weakness_target" INTEGER DEFAULT 3,
    "flashcard_target_min" INTEGER DEFAULT 5,
    "flashcard_target_max" INTEGER DEFAULT 15,

    CONSTRAINT "mission_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_inventory" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_value" TEXT NOT NULL,
    "acquired_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_daily_missions" (
    "email" VARCHAR(255) NOT NULL,
    "date" DATE NOT NULL,
    "lessons_completed" INTEGER DEFAULT 0,
    "quizzes_completed" INTEGER DEFAULT 0,
    "weakness_practices_completed" INTEGER DEFAULT 0,
    "flashcards_reviewed" INTEGER DEFAULT 0,
    "is_completed" BOOLEAN DEFAULT false,
    "reward_claimed" BOOLEAN DEFAULT false,
    "correct_answers_today" INTEGER DEFAULT 0,
    "pvp_wins_today" INTEGER DEFAULT 0,
    "tier1_claimed" BOOLEAN DEFAULT false,
    "tier2_claimed" BOOLEAN DEFAULT false,
    "tier3_claimed" BOOLEAN DEFAULT false,

    CONSTRAINT "user_daily_missions_pkey" PRIMARY KEY ("email","date")
);

-- CreateTable
CREATE TABLE "league_groups" (
    "id" SERIAL NOT NULL,
    "division" VARCHAR(50) NOT NULL,
    "week_start_date" DATE NOT NULL,
    "member_count" INTEGER DEFAULT 0,

    CONSTRAINT "league_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_league_members" (
    "email" VARCHAR(255) NOT NULL,
    "group_id" INTEGER NOT NULL,
    "league_score" INTEGER DEFAULT 0,

    CONSTRAINT "user_league_members_pkey" PRIMARY KEY ("email","group_id")
);

-- CreateTable
CREATE TABLE "user_pets" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "pet_type" VARCHAR(50) NOT NULL,
    "stage" INTEGER DEFAULT 1,
    "exp" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_feed" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "activity_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "likes_count" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_feed_likes" (
    "feed_id" INTEGER NOT NULL,
    "liker_email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_feed_likes_pkey" PRIMARY KEY ("feed_id","liker_email")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "chat_sessions_email_language_level_goal_roleplay_setting_idx" ON "chat_sessions"("email", "language", "level", "goal", "roleplay_setting");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_created_at_idx" ON "chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "flashcards_email_due_at_idx" ON "flashcards"("email", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "flashcards_email_language_front_text_back_text_key" ON "flashcards"("email", "language", "front_text", "back_text");

-- CreateIndex
CREATE INDEX "weakness_logs_email_language_created_at_idx" ON "weakness_logs"("email", "language", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_language_goals_email_language_key" ON "user_language_goals"("email", "language");

-- CreateIndex
CREATE INDEX "skill_progress_logs_email_language_created_at_idx" ON "skill_progress_logs"("email", "language", "created_at" DESC);

-- CreateIndex
CREATE INDEX "skill_progress_logs_email_language_skill_created_at_idx" ON "skill_progress_logs"("email", "language", "skill", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX "cached_lessons_language_level_goal_part_modifier_idx" ON "cached_lessons"("language", "level", "goal", "part", "modifier");

-- CreateIndex
CREATE INDEX "cached_quizzes_language_level_goal_modifier_idx" ON "cached_quizzes"("language", "level", "goal", "modifier");

-- CreateIndex
CREATE UNIQUE INDEX "badges_name_key" ON "badges"("name");

-- CreateIndex
CREATE INDEX "quiz_battles_challenger_email_idx" ON "quiz_battles"("challenger_email");

-- CreateIndex
CREATE INDEX "quiz_battles_challenged_email_idx" ON "quiz_battles"("challenged_email");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "user_progress_logs_email_language_idx" ON "user_progress_logs"("email", "language");

-- CreateIndex
CREATE INDEX "shop_items_effect_type_idx" ON "shop_items"("effect_type");

-- CreateIndex
CREATE INDEX "user_inventory_email_idx" ON "user_inventory"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_inventory_email_item_type_item_value_key" ON "user_inventory"("email", "item_type", "item_value");

-- CreateIndex
CREATE INDEX "league_groups_week_start_date_division_idx" ON "league_groups"("week_start_date", "division");

-- CreateIndex
CREATE INDEX "user_pets_email_idx" ON "user_pets"("email");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followers" ADD CONSTRAINT "followers_follower_email_fkey" FOREIGN KEY ("follower_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followers" ADD CONSTRAINT "followers_followed_email_fkey" FOREIGN KEY ("followed_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_battles" ADD CONSTRAINT "quiz_battles_challenger_email_fkey" FOREIGN KEY ("challenger_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_battles" ADD CONSTRAINT "quiz_battles_challenged_email_fkey" FOREIGN KEY ("challenged_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress_logs" ADD CONSTRAINT "user_progress_logs_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_language_progress" ADD CONSTRAINT "user_language_progress_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_language_progress" ADD CONSTRAINT "user_language_progress_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_language_progress" ADD CONSTRAINT "user_language_progress_base_level_fkey" FOREIGN KEY ("base_level") REFERENCES "levels"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_daily_missions" ADD CONSTRAINT "user_daily_missions_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_league_members" ADD CONSTRAINT "user_league_members_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_league_members" ADD CONSTRAINT "user_league_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "league_groups"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_pets" ADD CONSTRAINT "user_pets_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_feed" ADD CONSTRAINT "social_feed_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_feed_likes" ADD CONSTRAINT "social_feed_likes_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "social_feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_feed_likes" ADD CONSTRAINT "social_feed_likes_liker_email_fkey" FOREIGN KEY ("liker_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
