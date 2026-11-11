#!/bin/bash
# The backup service (m1-068; the schedule of m1-055): applies the PBM
# configuration if the database has none, then takes a base backup soon after
# each start and every ASSURER_BACKUP_INTERVAL_HOURS, followed by removing
# backups and oplog slices older than ASSURER_BACKUP_RETENTION. PITR needs a
# base backup older than the point it restores to, so the retention is one day
# longer than the 7-day PITR target (D-DB-4). Runs as the pbm user; pbm-agent
# (the pbm service) does the work.
#
# ASSURER_BACKUP_INTERVAL_HOURS=0 (restore drill): configure with PITR off, then
# exit.
#
# Guide: docs/runbooks/pbm-backup-and-restore.md
set -euo pipefail

BACKUP_HOURS="${ASSURER_BACKUP_INTERVAL_HOURS:-24}"
BACKUP_RETENTION="${ASSURER_BACKUP_RETENTION:-8d}"

log() {
  echo "[assurer] $*"
}

if ! [[ "$BACKUP_HOURS" =~ ^[0-9]+$ ]]; then
  log "ASSURER_BACKUP_INTERVAL_HOURS must be a whole number (0: configure only)"
  exit 1
fi

# The configuration lives in the database (admin.pbmConfig), so a new or
# restored database is configured again. The agent must be running first.
if pbmc config --out=json 2> /dev/null | grep -q '"/backups"'; then
  log "PBM is configured"
else
  configured=0
  for _ in $(seq 1 30); do
    if pbmc config --file /etc/assurer/pbm-config.yaml > /dev/null 2>&1; then
      configured=1
      break
    fi
    sleep 5
  done
  [ "$configured" = 1 ] || { log "ERROR: could not apply the PBM configuration; see 'pbmc logs'"; exit 1; }
  if [ "$BACKUP_HOURS" = 0 ]; then
    pbmc config --set pitr.enabled=false > /dev/null
  fi
  log "PBM configured (PITR $([ "$BACKUP_HOURS" = 0 ] && echo off || echo on))"
fi

if [ "$BACKUP_HOURS" = 0 ]; then
  exit 0
fi

trap 'exit 0' TERM INT
sleep 120 & wait $!
while true; do
  if pbmc backup --wait > /dev/null 2>&1; then
    log "Base backup finished"
  else
    log "ERROR: base backup failed; see 'pbmc status' and 'pbmc logs'"
  fi
  if ! pbmc cleanup --older-than "$BACKUP_RETENTION" --yes --wait > /dev/null 2>&1; then
    log "ERROR: removing old backups failed"
  fi
  sleep $((BACKUP_HOURS * 3600)) & wait $!
done
