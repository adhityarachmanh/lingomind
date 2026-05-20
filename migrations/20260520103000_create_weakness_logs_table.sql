CREATE TABLE IF NOT EXISTS weakness_logs (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    language TEXT NOT NULL,
    topic TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weakness_user_lang ON weakness_logs (username, language, created_at DESC);
