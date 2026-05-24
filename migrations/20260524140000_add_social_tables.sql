-- migrations/20260524140000_add_social_tables.sql

-- Tabel Followers
CREATE TABLE IF NOT EXISTS followers (
    follower_email VARCHAR(255) NOT NULL,
    followed_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_email, followed_email),
    FOREIGN KEY (follower_email) REFERENCES users(email) ON DELETE CASCADE,
    FOREIGN KEY (followed_email) REFERENCES users(email) ON DELETE CASCADE
);

-- Index untuk pencarian cepat follower/following
CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_email);
CREATE INDEX IF NOT EXISTS idx_followers_followed ON followers(followed_email);

-- Tabel Quiz Battles (Asynchronous)
CREATE TABLE IF NOT EXISTS quiz_battles (
    id SERIAL PRIMARY KEY,
    challenger_email VARCHAR(255) NOT NULL,
    challenged_email VARCHAR(255) NOT NULL,
    language VARCHAR(50) NOT NULL,
    goal VARCHAR(255) NOT NULL,
    challenger_score INT DEFAULT 0,
    challenged_score INT, -- NULL jika challenged belum mengerjakan
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'declined'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (challenger_email) REFERENCES users(email) ON DELETE CASCADE,
    FOREIGN KEY (challenged_email) REFERENCES users(email) ON DELETE CASCADE
);

-- Index untuk pencarian battle berdasarkan user
CREATE INDEX IF NOT EXISTS idx_battles_challenger ON quiz_battles(challenger_email);
CREATE INDEX IF NOT EXISTS idx_battles_challenged ON quiz_battles(challenged_email);
