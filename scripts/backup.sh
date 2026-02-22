#!/usr/bin/env bash
# SQLite backup script for Taste
# Safe with WAL mode — uses .backup command
# Usage: bash scripts/backup.sh [db_path] [backup_dir]
# Cron: 0 3 * * * cd /path/to/taste && bash scripts/backup.sh

set -euo pipefail

DB_PATH="${1:-./data/taste.db}"
BACKUP_DIR="${2:-./backups}"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/taste_${TIMESTAMP}.db"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
  echo "[Backup] Database not found at $DB_PATH"
  exit 1
fi

# Perform backup using SQLite .backup (safe with WAL mode)
sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

# Verify backup
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[Backup] Created: $BACKUP_FILE ($SIZE)"
else
  echo "[Backup] FAILED — backup file empty or missing"
  exit 1
fi

# Clean up old backups
DELETED=$(find "$BACKUP_DIR" -name "taste_*.db" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[Backup] Cleaned up $DELETED backups older than ${RETENTION_DAYS} days"
fi
