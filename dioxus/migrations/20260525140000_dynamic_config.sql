-- 20260525140000_dynamic_config.sql
CREATE TABLE app_config (
    key VARCHAR(255) PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    description TEXT
);

INSERT INTO app_config (key, value, description) VALUES
('quiz_completion_coins', '10', 'Koin yang didapat setelah menyelesaikan kuis');

CREATE TABLE shop_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cost INTEGER NOT NULL,
    effect_type VARCHAR(255) NOT NULL,
    icon_name VARCHAR(255)
);

INSERT INTO shop_items (name, description, cost, effect_type, icon_name) VALUES
('Streak Freeze', 'Menjaga streak tetap utuh jika kamu absen satu hari.', 50, 'streak_freeze', '❄️');

CREATE TABLE mission_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    lesson_target INTEGER DEFAULT 1,
    quiz_target INTEGER DEFAULT 1,
    weakness_target INTEGER DEFAULT 3,
    flashcard_target_min INTEGER DEFAULT 5,
    flashcard_target_max INTEGER DEFAULT 15
);

INSERT INTO mission_config (name, lesson_target, quiz_target, weakness_target, flashcard_target_min, flashcard_target_max) VALUES
('Daily Standard', 1, 1, 3, 5, 15);
