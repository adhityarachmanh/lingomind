CREATE TABLE IF NOT EXISTS user_engagement_stats (
    username TEXT PRIMARY KEY,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    total_quiz_completed INT NOT NULL DEFAULT 0,
    total_points_earned INT NOT NULL DEFAULT 0,
    last_active_date DATE
);
