#!/bin/sh
# Restore a BookLog backup made with backup.sh (works on another computer too).
#
#   sh backend/db/restore.sh booklog-2026-11-11.dump          # into database "booklog"
#   sh backend/db/restore.sh booklog-2026-11-11.dump mydb     # into another name
#
# Run from the repo root, as your own PostgreSQL superuser (the default on a
# Homebrew install). It:
#   1. creates the database (stops if it already exists, so nothing is overwritten)
#   2. restores tables, data, triggers, policies and views
#   3. re-creates the booklog_app / booklog_reports roles and ownership
#      (migrations 003 and 004), which a dump doesn't carry
#   4. refreshes the report views and rebuilds Neo4j from PostgreSQL (if running)
set -e
FILE="$1"
DB="${2:-booklog}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
    echo "Usage: sh backend/db/restore.sh <backup.dump> [database]" >&2
    exit 1
fi

if psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB'" | grep -q 1; then
    echo "Database '$DB' already exists. Drop it first (dropdb $DB) or pass another name." >&2
    exit 1
fi

createdb "$DB"
pg_restore --no-owner --no-privileges -d "$DB" "$FILE"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/migrations/003_app_role.sql"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/migrations/004_report_role.sql"
echo "Restored $FILE into '$DB': $(psql -d "$DB" -tAc 'SELECT count(*) FROM book') books, $(psql -d "$DB" -tAc 'SELECT count(*) FROM users') users"

if [ -x "$HERE/../venv/bin/python" ] && [ -f "$HERE/../.env" ]; then
    DATABASE_URL="postgresql://booklog_app@localhost:5432/$DB" "$HERE/../venv/bin/python" "$HERE/sync_neo4j.py" || echo "Neo4j not rebuilt (is it running?). Run backend/db/sync_neo4j.py later."
else
    echo "Next: set up backend/venv and backend/.env, then run backend/db/sync_neo4j.py to rebuild Neo4j."
fi
