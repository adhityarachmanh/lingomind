CREATE TABLE IF NOT EXISTS user_language_goals (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    language TEXT NOT NULL,
    goal TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (username, language)
);
