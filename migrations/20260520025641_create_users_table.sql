-- migrations/20260520123456_create_users_table.sql

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    score INT DEFAULT 0,
    -- PERBAIKAN: Menggunakan JSONB dengan nilai default Map untuk mendukung level tiap bahasa
    current_level JSONB DEFAULT '{"English": "A1", "German": "A1", "Japanese": "A1"}'::jsonb
);