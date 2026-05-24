#!/bin/bash
# reset_progress.sh - Script untuk mereset seluruh progress pengguna di LingoMind tanpa menghapus akun.

ENV_FILE="/etc/lingomind/lingomind.env"

# Cek apakah file environment tersedia
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: File environment tidak ditemukan di $ENV_FILE"
    exit 1
fi

# Cek apakah memiliki izin membaca file environment
if [ ! -r "$ENV_FILE" ]; then
    echo "Error: Tidak memiliki izin membaca file $ENV_FILE."
    echo "Silakan jalankan ulang script menggunakan 'sudo':"
    echo "sudo ./reset_progress.sh"
    exit 1
fi

# Mengambil nilai DATABASE_URL secara dinamis
DATABASE_URL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r')

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL tidak ditemukan di dalam $ENV_FILE"
    exit 1
fi

echo "Memulai reset progress di database LingoMind..."

# Menjalankan perintah psql menggunakan database URL yang didapatkan
psql "$DATABASE_URL" << 'EOF'
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
        'email_verification_tokens'
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
EOF

if [ $? -eq 0 ]; then
    echo "--------------------------------------------------------"
    echo "Berhasil! Seluruh progress pengguna telah dibersihkan."
    echo "Akun pengguna (nama, email, password) tetap utuh & aman."
    echo "--------------------------------------------------------"
else
    echo "Error: Gagal mengeksekusi reset di database."
    exit 1
fi
