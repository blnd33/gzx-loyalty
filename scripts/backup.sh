#!/usr/bin/env bash
# Backs up the whole GZX loyalty database to a timestamped, compressed file.
# Usage:  SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres' ./scripts/backup.sh
# (Supabase dashboard -> Connect -> "Session pooler" connection string.)
set -euo pipefail
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to your Supabase connection string}"
mkdir -p backups
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump "$SUPABASE_DB_URL" --schema=public --format=custom --no-owner --no-privileges \
  --file "backups/gzx-loyalty-$STAMP.dump"
echo "Saved backups/gzx-loyalty-$STAMP.dump"
# Restore into an empty database:
#   pg_restore --no-owner --no-privileges --dbname "$TARGET_DB_URL" backups/gzx-loyalty-<stamp>.dump
