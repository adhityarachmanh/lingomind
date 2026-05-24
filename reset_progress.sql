-- reset_progress.sql
-- Script untuk mereset seluruh progress pengguna di LingoMind tanpa menghapus akun pengguna (tabel users).

BEGIN;

-- 1. Mengosongkan semua tabel data aktivitas/progress yang berelasi dengan pengguna
TRUNCATE TABLE chat_messages CASCADE;
TRUNCATE TABLE chat_sessions CASCADE;
TRUNCATE TABLE flashcards CASCADE;
TRUNCATE TABLE weakness_logs CASCADE;
TRUNCATE TABLE user_language_goals CASCADE;
TRUNCATE TABLE skill_progress_logs CASCADE;
TRUNCATE TABLE user_engagement_stats CASCADE;
TRUNCATE TABLE password_resets CASCADE;

-- 2. Mereset kolom progress dan level pada tabel users ke nilai awal default (28 bahasa)
UPDATE users 
SET 
    score = 0,
    preferred_language = 'English',
    current_level = '{
        "English": "A1",
        "Spanish": "A1",
        "French": "A1",
        "German": "A1",
        "Italian": "A1",
        "Portuguese": "A1",
        "Japanese": "A1",
        "Korean": "A1",
        "Mandarin": "A1",
        "Hindi": "A1",
        "Arabic": "A1",
        "Turkish": "A1",
        "Russian": "A1",
        "Dutch": "A1",
        "Vietnamese": "A1",
        "Thai": "A1",
        "Swedish": "A1",
        "Polish": "A1",
        "Danish": "A1",
        "Finnish": "A1",
        "Norwegian": "A1",
        "Greek": "A1",
        "Ukrainian": "A1",
        "Czech": "A1",
        "Romanian": "A1",
        "Hungarian": "A1",
        "Filipino": "A1",
        "Malay": "A1"
    }'::jsonb;

COMMIT;
