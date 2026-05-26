CREATE TABLE IF NOT EXISTS social_feed (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- e.g. 'level_up', 'pet_hatched', 'streak_milestone', 'pvp_win'
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_feed_likes (
    feed_id INTEGER NOT NULL REFERENCES social_feed(id) ON DELETE CASCADE,
    liker_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (feed_id, liker_email)
);
