CREATE TABLE IF NOT EXISTS flashcards (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    language TEXT NOT NULL,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 1,
    repetition INTEGER NOT NULL DEFAULT 0,
    due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (email, language, front_text, back_text)
);

CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards (email, due_at);
