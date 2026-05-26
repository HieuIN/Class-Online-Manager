#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/ctalk/backups}"
DATE="$(date +%Y%m%d-%H%M%S)"
FILE="${BACKUP_DIR}/ctalk-${DATE}.sql.gz"

mkdir -p "${BACKUP_DIR}"
docker compose -f /opt/ctalk/app/docker-compose.vps.yml exec -T postgres \
  pg_dump -U "${DB_USER:-ctalk}" "${DB_NAME:-class_manager}" | gzip > "${FILE}"

find "${BACKUP_DIR}" -type f -name "ctalk-*.sql.gz" -mtime +14 -delete
echo "Backup written to ${FILE}"
