#!/bin/sh
# Back up the BookLog PostgreSQL database to a single file.
#
#   sh backend/db/backup.sh                 -> backups/booklog-YYYY-MM-DD.dump
#   sh backend/db/backup.sh my-file.dump
#
# The custom format (-Fc) is compressed and restores with pg_restore
# (see restore.sh). Neo4j is rebuilt from PostgreSQL after a restore, and
# MongoDB lives in Atlas, so this one file holds everything needed.
set -e
DB="${PGDATABASE:-booklog}"
OUT="${1:-backups/$DB-$(date +%Y-%m-%d).dump}"
mkdir -p "$(dirname "$OUT")"
pg_dump -Fc --no-owner --no-privileges -d "$DB" -f "$OUT"
echo "Backed up $DB to $OUT ($(du -h "$OUT" | cut -f1))"
