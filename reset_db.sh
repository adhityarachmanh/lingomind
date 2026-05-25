#!/bin/bash
set -e

echo "Lingomind DB Reset (Linux)"
echo "Warning: This will drop the database and recreate it!"
echo "Press Ctrl+C to abort or wait 5 seconds..."
sleep 5

echo "Dropping database (if it exists)..."
cargo sqlx database drop -y -f || true

echo "Creating database..."
cargo sqlx database create

echo "Running migrations..."
cargo sqlx migrate run

echo "Database reset complete!"
