-- Menambahkan kolom koin dan streak_freezes
ALTER TABLE user_engagement_stats ADD COLUMN IF NOT EXISTS coins INT NOT NULL DEFAULT 0;
ALTER TABLE user_engagement_stats ADD COLUMN IF NOT EXISTS streak_freezes INT NOT NULL DEFAULT 0;

-- Tabel Badges
CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon_name VARCHAR(255) NOT NULL,
    requirement_type VARCHAR(50) NOT NULL,
    requirement_value INT NOT NULL
);

-- Tabel relasi User Badges
CREATE TABLE IF NOT EXISTS user_badges (
    email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    badge_id INT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (email, badge_id)
);

-- Seed data badge awal
INSERT INTO badges (name, description, icon_name, requirement_type, requirement_value)
VALUES 
    ('First Step', 'Menyelesaikan kuis pertama.', '🎯', 'quiz_completed', 1),
    ('Week Warrior', 'Mencapai 7 hari streak belajar.', '🔥', 'streak', 7),
    ('Rich Scholar', 'Mengumpulkan 100 koin.', '💰', 'coins', 100)
ON CONFLICT (name) DO NOTHING;
