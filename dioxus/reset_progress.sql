-- reset_progress.sql
-- Script untuk mereset seluruh progress pengguna di LingoMind tanpa menghapus akun pengguna (tabel users).

BEGIN;

-- 1. Mengosongkan semua tabel data aktivitas/progress
-- Menggunakan DO block karena TRUNCATE tidak mendukung IF EXISTS di PostgreSQL
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'chat_sessions',
        'flashcards',
        'weakness_logs',
        'user_language_goals',
        'skill_progress_logs',
        'user_engagement_stats',
        'password_resets',
        'user_badges',
        'followers',
        'quiz_battles',
        'cached_lessons',
        'cached_quizzes',
        'email_verification_tokens',
        'user_progress_logs',
        'user_language_progress'
    ]
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
            EXECUTE format('TRUNCATE TABLE %I CASCADE', tbl);
            RAISE NOTICE 'Truncated: %', tbl;
        ELSE
            RAISE NOTICE 'Skipped (not found): %', tbl;
        END IF;
    END LOOP;
END
$$;

-- 2. Mereset kolom progress dan level pada tabel users
UPDATE users 
SET 
    score = 0,
    preferred_language = 'English';

COMMIT;
