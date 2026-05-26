-- migrations/20260526060000_add_utilities_and_cooldowns.sql

-- Tambahkan kolom ke user_engagement_stats
ALTER TABLE user_engagement_stats ADD COLUMN IF NOT EXISTS previous_streak INT NOT NULL DEFAULT 0;
ALTER TABLE user_engagement_stats ADD COLUMN IF NOT EXISTS double_xp_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_engagement_stats ADD COLUMN IF NOT EXISTS exam_retake_tickets INT NOT NULL DEFAULT 0;

-- Tambahkan kolom ke user_language_progress
ALTER TABLE user_language_progress ADD COLUMN IF NOT EXISTS exam_cooldown_until TIMESTAMP WITH TIME ZONE;

-- Tambahkan item Utilitas ke Shop (tabel shop_items tidak berubah secara skema, namun item ditangani secara logis)
-- Kami mendaftarkannya jika belum ada
INSERT INTO shop_items (name, description, cost, effect_type, icon_name)
SELECT 'Streak Repair', 'Memperbaiki streak harian yang baru saja hangus.', 2000, 'streak_repair', '🩹'
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE effect_type = 'streak_repair');

INSERT INTO shop_items (name, description, cost, effect_type, icon_name)
SELECT 'Double XP 24 Jam', 'Menggandakan perolehan poin dari semua aktivitas selama 24 jam ke depan.', 500, 'double_xp', '🧪'
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE effect_type = 'double_xp');

INSERT INTO shop_items (name, description, cost, effect_type, icon_name)
SELECT 'Tiket Ujian Ulang', 'Buka gembok cooldown Exam agar bisa langsung mengambil ujian ulang.', 1000, 'exam_retake', '🎫'
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE effect_type = 'exam_retake');
