-- Tabel untuk menyimpan sesi roleplay
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    language VARCHAR(20) NOT NULL,
    level VARCHAR(10) NOT NULL,
    roleplay_setting VARCHAR(50) NOT NULL, -- Contoh: "Cafe", "Hotel", "Airport"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk menyimpan riwayat pesan dalam sesi
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender VARCHAR(10) NOT NULL, -- "user" atau "ai"
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);