#!/bin/bash
# Starts the Apostrophe app on SQLite and Litestream in one container (m1-048).
# The first start creates the session secret, demo content and an admin
# account. With LITESTREAM_POC_RESTORE=1 and no database yet, it first restores
# the database from the read-only replica in /replica-source (optionally to
# LITESTREAM_POC_RESTORE_TIMESTAMP), into a new, empty path. If either process
# stops, the container stops, so the restart policy brings both back together.
set -euo pipefail

SECRETS=/data/secrets
DB_FILE=/data/db/assurer.sqlite

log() {
  echo "[litestream-poc] $*"
}

if [ ! -s "$SECRETS/session-secret" ]; then
  (umask 077; openssl rand -hex 48 > "$SECRETS/session-secret")
fi
APOS_SESSION_SECRET="$(cat "$SECRETS/session-secret")"
export APOS_SESSION_SECRET

if [ "${LITESTREAM_POC_RESTORE:-0}" = "1" ] && [ ! -e "$DB_FILE" ]; then
  restore_args=(-o "$DB_FILE")
  if [ -n "${LITESTREAM_POC_RESTORE_TIMESTAMP:-}" ]; then
    restore_args+=(-timestamp "$LITESTREAM_POC_RESTORE_TIMESTAMP")
  fi
  log "Restoring the database from /replica-source ${LITESTREAM_POC_RESTORE_TIMESTAMP:-(latest)}"
  litestream restore "${restore_args[@]}" file:///replica-source/assurer
  # The restored database already has its content and admin account.
  touch "$SECRETS/.content-ready"
fi

node app @apostrophecms/migration:migrate

litestream replicate -config /etc/litestream.yml &
litestream_pid=$!
app_pid=

shutdown() {
  log "Stopping"
  if [ -n "$app_pid" ]; then
    kill -TERM "$app_pid" 2>/dev/null || true
    wait "$app_pid" 2>/dev/null || true
  fi
  # Litestream syncs the last WAL frames on SIGTERM.
  kill -TERM "$litestream_pid" 2>/dev/null || true
  wait "$litestream_pid" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

if [ ! -e "$SECRETS/.content-ready" ]; then
  log "First start: loading demo content and creating the admin account"
  node app assurer-demo:seed
  # The prompt echoes what it reads, so its output must stay out of the logs.
  echo "${ASSURER_ADMIN_PASSWORD:?set a test password for the first start}" \
    | node app @apostrophecms/user:add admin admin > /dev/null
  touch "$SECRETS/.content-ready"
fi

node app &
app_pid=$!
log "Started"

# Stop when either process ends. shutdown() handles a stop request.
wait -n "$litestream_pid" "$app_pid" || true
log "A process stopped; stopping the container"
kill -TERM "$app_pid" "$litestream_pid" 2>/dev/null || true
wait "$app_pid" 2>/dev/null || true
wait "$litestream_pid" 2>/dev/null || true
exit 1
