#!/bin/bash
# PBM proof of concept (m1-046). Wraps the demo entrypoint, which it does not
# change, and runs pbm-agent next to it.
#
# PBM_POC_MODE=site (default): the demo entrypoint starts MongoDB and the app.
#   Once MongoDB is ready, this script creates the pbm database user (first
#   start only), applies the PBM configuration (first start only) and keeps
#   pbm-agent running. If the agent stops, it is started again; the site is
#   not stopped.
# PBM_POC_MODE=restore: MongoDB and pbm-agent only, with no app and no demo
#   content, so that `pbm restore` has an empty database to restore into. Needs
#   the source site's secrets (see the results page). Afterwards, start the
#   container again in site mode.
set -euo pipefail

SECRETS=/data/secrets
MODE="${PBM_POC_MODE:-site}"

log() {
  echo "[pbm-poc] $*"
}

mongosh_local() {
  mongosh --quiet --port 27017 "$@"
}

pbm_uri() {
  echo "mongodb://pbm:$(cat "$SECRETS/mongo-pbm-password")@127.0.0.1:27017/?authSource=admin&replicaSet=rs0"
}

# The pbm user's roles, from Percona's documentation. pbmAnyAction can do
# anything in MongoDB (options paper §4.1). Passwords go through standard input.
create_pbm_user() {
  mongosh_local <<EOF > /dev/null
const admin = db.getSiblingDB("admin");
admin.auth("siteAdmin", "$(cat "$SECRETS/mongo-admin-password")");
if (!admin.getRole("pbmAnyAction")) {
  admin.createRole({
    role: "pbmAnyAction",
    privileges: [ { resource: { anyResource: true }, actions: [ "anyAction" ] } ],
    roles: []
  });
}
if (!admin.getUser("pbm")) {
  admin.createUser({
    user: "pbm",
    pwd: "$(cat "$SECRETS/mongo-pbm-password")",
    roles: [
      { db: "admin", role: "readWrite", collection: "" },
      { db: "admin", role: "backup" },
      { db: "admin", role: "clusterMonitor" },
      { db: "admin", role: "restore" },
      { db: "admin", role: "pbmAnyAction" }
    ]
  });
}
EOF
}

# Keeps pbm-agent running as the pbm OS user. Its credentials are only in its
# own environment, which the app's user cannot read.
agent_loop() {
  while true; do
    log "Starting pbm-agent"
    PBM_MONGODB_URI="$(pbm_uri)" gosu pbm pbm-agent || true
    log "pbm-agent stopped; starting it again in 5 s"
    sleep 5
  done
}

wait_for_primary() {
  until [ "$(mongosh_local --eval 'db.hello().isWritablePrimary' 2>/dev/null)" = "true" ]; do
    kill -0 "$main_pid" 2>/dev/null || { log "MongoDB stopped"; exit 1; }
    sleep 1
  done
}

shutdown() {
  log "Stopping"
  kill -TERM "${agent_pid:-}" 2>/dev/null || true
  pkill -TERM -u pbm pbm-agent 2>/dev/null || true
  kill -TERM "${main_pid:-}" 2>/dev/null || true
  wait "${main_pid:-}" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

if [ ! -s "$SECRETS/mongo-pbm-password" ]; then
  mkdir -p "$SECRETS"
  (umask 077; openssl rand -hex 24 > "$SECRETS/mongo-pbm-password")
fi

if [ "$MODE" = "restore" ]; then
  # The same steps as the demo entrypoint's first start, without the app user
  # (the restore brings it back) and without the app.
  chown mongodb:mongodb "$SECRETS/mongo-keyfile"
  chmod 400 "$SECRETS/mongo-keyfile"
  chmod 711 "$SECRETS"
  chown -R mongodb:mongodb /data/db
  gosu mongodb mongod --config /etc/assurer/mongod.conf &
  main_pid=$!
  until mongosh_local --eval 'db.hello().ok' > /dev/null 2>&1; do
    kill -0 "$main_pid" 2>/dev/null || { log "MongoDB did not start"; exit 1; }
    sleep 1
  done
  if [ ! -e "$SECRETS/.database-ready" ]; then
    log "Restore mode: creating an empty replica set"
    mongosh_local --eval 'if (!db.hello().setName) { rs.initiate({ _id: "rs0", members: [ { _id: 0, host: "127.0.0.1:27017" } ] }); }' > /dev/null
    wait_for_primary
    mongosh_local <<EOF > /dev/null
db.getSiblingDB("admin").createUser({
  user: "siteAdmin",
  pwd: "$(cat "$SECRETS/mongo-admin-password")",
  roles: [ "userAdminAnyDatabase", "clusterAdmin" ]
});
EOF
    touch "$SECRETS/.database-ready"
  fi
else
  assurer-entrypoint &
  main_pid=$!
  until [ -e "$SECRETS/.database-ready" ]; do
    kill -0 "$main_pid" 2>/dev/null || { log "The site stopped before MongoDB was ready"; exit 1; }
    sleep 1
  done
  wait_for_primary
fi

create_pbm_user
agent_loop &
agent_pid=$!

if [ ! -e "$SECRETS/.pbm-configured" ]; then
  # The agent must be running before the configuration is applied.
  sleep 5
  if [ "$MODE" = "restore" ]; then
    pbmc config --file /etc/assurer/pbm-config.yaml > /dev/null
    pbmc config --set pitr.enabled=false > /dev/null
  else
    pbmc config --file /etc/assurer/pbm-config.yaml > /dev/null
  fi
  touch "$SECRETS/.pbm-configured"
  log "PBM configured ($MODE mode)"
fi

# The site's lifetime decides the container's, not the agent's (P6).
status=0
wait "$main_pid" || status=$?
kill -TERM "$agent_pid" 2>/dev/null || true
pkill -TERM -u pbm pbm-agent 2>/dev/null || true
exit "$status"
