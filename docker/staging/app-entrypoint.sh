#!/bin/bash
# The app service (m1-068, D-DB-20): runs the migrations, creates the first
# admin account on the first start, then becomes Apostrophe in cluster mode
# (APOS_CLUSTER_PROCESSES; m1-054). Runs as the assurer user. Compose starts
# it once the mongo service is healthy.
#
# ASSURER_CREATE_ADMIN=0 (restore drill): no admin account, because the
# restored database has its own.
#
# Guide: docs/runbooks/staging-container.md
set -euo pipefail

DATA=/app/data

log() {
  echo "[assurer] $*"
}

. /usr/local/lib/assurer/app-env.sh
cd /app

node app @apostrophecms/migration:migrate

# A random password, written to the app-data volume and never logged. The
# owner reads it once, changes it in the admin UI and deletes the file.
if [ "${ASSURER_CREATE_ADMIN:-1}" = 1 ] && [ ! -e "$DATA/.admin-ready" ]; then
  log "First start: creating the admin account with a random password"
  (umask 077; node -e "console.log(require('node:crypto').randomBytes(16).toString('hex'))" \
    > "$DATA/admin-initial-password")
  # The prompt reads one line (hence the newline) and echoes it, so its output
  # must stay out of the logs.
  node app @apostrophecms/user:add admin admin < "$DATA/admin-initial-password" > /dev/null
  touch "$DATA/.admin-ready"
  log "Admin login: user 'admin', password in $DATA/admin-initial-password."
  log "Change it in the admin UI, then delete that file"
fi

log "Starting (${APOS_CLUSTER_PROCESSES:-1} web process(es))"
# The primary restarts a worker that exits; Docker restarts the container if
# the primary stops.
exec node app
