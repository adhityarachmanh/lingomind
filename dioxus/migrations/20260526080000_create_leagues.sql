-- 20260526080000_create_leagues.sql
CREATE TABLE IF NOT EXISTS league_groups (
    id SERIAL PRIMARY KEY,
    division VARCHAR(50) NOT NULL, -- Bronze, Silver, Gold, Diamond
    week_start_date DATE NOT NULL,
    member_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_league_groups_week_start ON league_groups(week_start_date, division);

CREATE TABLE IF NOT EXISTS user_league_members (
    email VARCHAR(255) NOT NULL REFERENCES users(email),
    group_id INTEGER NOT NULL REFERENCES league_groups(id),
    league_score INTEGER DEFAULT 0,
    PRIMARY KEY (email, group_id)
);

CREATE INDEX IF NOT EXISTS idx_user_league_members_email ON user_league_members(email);
