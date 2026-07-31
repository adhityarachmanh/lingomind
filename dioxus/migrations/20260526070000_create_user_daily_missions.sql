-- 20260526070000_create_user_daily_missions.sql
CREATE TABLE IF NOT EXISTS user_daily_missions (
    email VARCHAR(255) NOT NULL REFERENCES users(email),
    date DATE NOT NULL,
    lessons_completed INTEGER DEFAULT 0,
    quizzes_completed INTEGER DEFAULT 0,
    weakness_practices_completed INTEGER DEFAULT 0,
    flashcards_reviewed INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    reward_claimed BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (email, date)
);
