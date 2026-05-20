ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS goal TEXT NOT NULL DEFAULT 'General';

CREATE INDEX IF NOT EXISTS idx_chat_sessions_lookup
ON chat_sessions (email, language, level, goal, roleplay_setting);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
ON chat_messages (session_id, created_at ASC);
