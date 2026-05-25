@echo off
echo Lingomind DB Reset (Windows)
echo Warning: This will drop the database and recreate it!
echo Press Ctrl+C to abort or wait 5 seconds...
timeout /t 5

echo Dropping database (if it exists)...
cargo sqlx database drop -y -f

echo Creating database...
cargo sqlx database create

echo Running migrations...
cargo sqlx migrate run

echo Database reset complete!
