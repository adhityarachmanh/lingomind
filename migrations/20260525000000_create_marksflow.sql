CREATE TABLE IF NOT EXISTS user_progress_logs (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- 'quiz' or 'exam'
    topic VARCHAR(255) NOT NULL,
    score_gained INT NOT NULL,
    passed BOOLEAN NOT NULL,
    base_level VARCHAR(10) NOT NULL, -- e.g. 'A1'
    topic_idx INT NOT NULL, -- e.g. 0, 1, 2, 3, 4
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- B-tree index to quickly query a user's logs for a specific language
CREATE INDEX idx_user_progress_logs_email_lang ON user_progress_logs(email, language);
