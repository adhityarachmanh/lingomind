CREATE TABLE IF NOT EXISTS skill_progress_logs (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    language TEXT NOT NULL,
    skill TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_progress_user_lang_day
ON skill_progress_logs (username, language, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_progress_user_lang_skill_day
ON skill_progress_logs (username, language, skill, created_at DESC);
