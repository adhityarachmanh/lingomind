-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_session_id_fkey";

-- DropForeignKey
ALTER TABLE "followers" DROP CONSTRAINT "followers_followed_email_fkey";

-- DropForeignKey
ALTER TABLE "followers" DROP CONSTRAINT "followers_follower_email_fkey";

-- DropForeignKey
ALTER TABLE "quiz_battles" DROP CONSTRAINT "quiz_battles_challenged_email_fkey";

-- DropForeignKey
ALTER TABLE "quiz_battles" DROP CONSTRAINT "quiz_battles_challenger_email_fkey";

-- DropForeignKey
ALTER TABLE "social_feed" DROP CONSTRAINT "social_feed_email_fkey";

-- DropForeignKey
ALTER TABLE "social_feed_likes" DROP CONSTRAINT "social_feed_likes_feed_id_fkey";

-- DropForeignKey
ALTER TABLE "social_feed_likes" DROP CONSTRAINT "social_feed_likes_liker_email_fkey";

-- DropForeignKey
ALTER TABLE "topics" DROP CONSTRAINT "topics_level_id_fkey";

-- DropForeignKey
ALTER TABLE "user_badges" DROP CONSTRAINT "user_badges_badge_id_fkey";

-- DropForeignKey
ALTER TABLE "user_badges" DROP CONSTRAINT "user_badges_email_fkey";

-- DropForeignKey
ALTER TABLE "user_daily_missions" DROP CONSTRAINT "user_daily_missions_email_fkey";

-- DropForeignKey
ALTER TABLE "user_inventory" DROP CONSTRAINT "user_inventory_email_fkey";

-- DropForeignKey
ALTER TABLE "user_language_progress" DROP CONSTRAINT "user_language_progress_base_level_fkey";

-- DropForeignKey
ALTER TABLE "user_language_progress" DROP CONSTRAINT "user_language_progress_email_fkey";

-- DropForeignKey
ALTER TABLE "user_language_progress" DROP CONSTRAINT "user_language_progress_language_id_fkey";

-- DropForeignKey
ALTER TABLE "user_league_members" DROP CONSTRAINT "user_league_members_email_fkey";

-- DropForeignKey
ALTER TABLE "user_league_members" DROP CONSTRAINT "user_league_members_group_id_fkey";

-- DropForeignKey
ALTER TABLE "user_pets" DROP CONSTRAINT "user_pets_email_fkey";

-- DropForeignKey
ALTER TABLE "user_progress_logs" DROP CONSTRAINT "user_progress_logs_email_fkey";

-- AlterTable
ALTER TABLE "email_verification_tokens" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(6);

-- AlterTable
ALTER TABLE "password_resets" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(6);

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "followers" ADD CONSTRAINT "followers_follower_email_fkey" FOREIGN KEY ("follower_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "followers" ADD CONSTRAINT "followers_followed_email_fkey" FOREIGN KEY ("followed_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_battles" ADD CONSTRAINT "quiz_battles_challenger_email_fkey" FOREIGN KEY ("challenger_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_battles" ADD CONSTRAINT "quiz_battles_challenged_email_fkey" FOREIGN KEY ("challenged_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_progress_logs" ADD CONSTRAINT "user_progress_logs_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_language_progress" ADD CONSTRAINT "user_language_progress_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_language_progress" ADD CONSTRAINT "user_language_progress_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_language_progress" ADD CONSTRAINT "user_language_progress_base_level_fkey" FOREIGN KEY ("base_level") REFERENCES "levels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_daily_missions" ADD CONSTRAINT "user_daily_missions_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_league_members" ADD CONSTRAINT "user_league_members_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_league_members" ADD CONSTRAINT "user_league_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "league_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_pets" ADD CONSTRAINT "user_pets_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_feed" ADD CONSTRAINT "social_feed_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_feed_likes" ADD CONSTRAINT "social_feed_likes_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "social_feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_feed_likes" ADD CONSTRAINT "social_feed_likes_liker_email_fkey" FOREIGN KEY ("liker_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE NO ACTION;
