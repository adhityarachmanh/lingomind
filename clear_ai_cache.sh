#!/bin/bash
# clear_ai_cache.sh
# Script to clear the AI Quiz Cache (cached_quizzes) in the database.
# This forces the system to fetch fresh HTML-formatted quizzes.

# Load environment variables
ENV_FILE="/etc/lingomind/lingomind.env"

if [ -f "$ENV_FILE" ]; then
  echo "Loading environment variables from $ENV_FILE..."
  export $(grep -v '^#' "$ENV_FILE" | xargs)
elif [ -f .env ]; then
  echo "Loading environment variables from local .env..."
  export $(grep -v '^#' .env | xargs)
else
  echo "Environment file not found at $ENV_FILE or local .env."
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set in .env."
  exit 1
fi

echo "Connecting to database to clear cached_quizzes..."

# Execute TRUNCATE command using psql
psql "$DATABASE_URL" -c "TRUNCATE TABLE cached_quizzes, cached_lessons RESTART IDENTITY;"

if [ $? -eq 0 ]; then
  echo "✅ AI Cache (Quizzes & Lessons) cleared successfully! The system will now generate fresh HTML content."
else
  echo "❌ Failed to clear AI Quiz Cache. Please check your database connection or psql installation."
  exit 1
fi
