ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_language TEXT;

UPDATE users
SET preferred_language = 'English'
WHERE preferred_language IS NULL OR btrim(preferred_language) = '';

ALTER TABLE users
ALTER COLUMN preferred_language SET NOT NULL;
