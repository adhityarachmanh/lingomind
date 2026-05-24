-- migrations/20260524130000_add_modifier_to_cached_lessons.sql

ALTER TABLE cached_lessons ADD COLUMN IF NOT EXISTS modifier VARCHAR(50) NOT NULL DEFAULT 'normal';
DROP INDEX IF EXISTS idx_cached_lessons_lookup;
CREATE INDEX idx_cached_lessons_lookup ON cached_lessons(language, level, goal, part, modifier);

ALTER TABLE cached_quizzes ADD COLUMN IF NOT EXISTS modifier VARCHAR(50) NOT NULL DEFAULT 'normal';
DROP INDEX IF EXISTS idx_cached_quizzes_lookup;
CREATE INDEX idx_cached_quizzes_lookup ON cached_quizzes(language, level, goal, modifier);
