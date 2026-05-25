CREATE TABLE user_inventory (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    item_value TEXT NOT NULL,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, item_type, item_value)
);
