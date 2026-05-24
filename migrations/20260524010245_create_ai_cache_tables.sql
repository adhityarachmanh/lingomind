-- migrations/20260524010245_create_ai_cache_tables.sql

CREATE TABLE IF NOT EXISTS cached_lessons (
    id SERIAL PRIMARY KEY,
    language VARCHAR(50) NOT NULL,
    level VARCHAR(10) NOT NULL,
    goal VARCHAR(100) NOT NULL,
    part INTEGER NOT NULL,
    content_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cached_lessons_lookup ON cached_lessons(language, level, goal, part);

CREATE TABLE IF NOT EXISTS cached_quizzes (
    id SERIAL PRIMARY KEY,
    language VARCHAR(50) NOT NULL,
    level VARCHAR(10) NOT NULL,
    goal VARCHAR(100) NOT NULL,
    content_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cached_quizzes_lookup ON cached_quizzes(language, level, goal);
