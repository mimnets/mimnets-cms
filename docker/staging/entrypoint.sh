#!/bin/bash
# Staging entrypoint (m1-055): MongoDB with TLS, the Apostrophe app in cluster
# mode, pbm-agent and the base-backup schedule, in one container (D-DB-10 (b)).
# No demo content and no default password: the first start creates a random
# admin password in the secrets volume and never logs it.
#
# ASSURER_MODE=site (default): everything above.
# ASSURER_MODE=restore: MongoDB and pbm-agent only, with no app, so that
#   `pbm restore` has an empty database to restore into. Needs the source
#   site's secrets. Afterwards, start the container again in site mode.
#
# Guides: docs/runbooks/staging-container.md, docs/runbooks/pbm-backup-and-restore.md
set -euo pipefail

SECRETS=/data/secrets
TLS="$SECRETS/tls"
DB_NAME=assurer
MODE="${ASSURER_MODE:-site}"
CACHE_GB="${ASSURER_MONGO_CACHE_GB:-1}"
BACKUP_HOURS="${ASSURER_BACKUP_INTERVAL_HOURS:-24}"
BACKUP_RETENTION="${ASSURER_BACKUP_RETENTION:-8d}"

log() {
  echo "[assurer] $*"
}

case "$MODE" in
  site|restore) ;;
  *) log "ASSURER_MODE must be site or restore"; exit 1 ;;
esac
if ! [[ "$BACKUP_HOURS" =~ ^[0-9]+$ ]]; then
  log "ASSURER_BACKUP_INTERVAL_HOURS must be a whole number (0 turns the schedule off)"
  exit 1
fi

# Writes a random secret once. The value is hex, so it is safe in a URI and in
# the mongosh commands below.
ensure_secret() {
  local file="$SECRETS/$1"
  if [ ! -s "$file" ]; then
    (umask 077; openssl rand -hex "$2" > "$file")
  fi
}

# A private CA and a server certificate for MongoDB on 127.0.0.1. The CA key
# is deleted once the certificate is signed, so nothing can sign another one
# (hardening runbook §6 step 2). Both are made again when the certificate has
# less than 30 days left; a restart (for example an image update) does that.
ensure_tls() {
  if [ -s "$TLS/mongod.pem" ] && [ -s "$TLS/ca.pem" ] \
    && openssl x509 -checkend 2592000 -noout -in "$TLS/mongod.pem" > /dev/null; then
    return
  fi
  log "Creating the MongoDB TLS certificate"
  local work
  work="$(mktemp -d)"
  mkdir -p "$TLS"
  (
    umask 077
    openssl req -x509 -newkey rsa:3072 -nodes -days 3650 -subj "/CN=assurer-mongodb-ca" \
      -keyout "$work/ca.key" -out "$work/ca.pem" 2> /dev/null
    openssl req -newkey rsa:3072 -nodes -subj "/CN=127.0.0.1" \
      -keyout "$work/server.key" -out "$work/server.csr" 2> /dev/null
    printf 'subjectAltName=IP:127.0.0.1,DNS:localhost\nextendedKeyUsage=serverAuth,clientAuth\n' > "$work/ext"
    openssl x509 -req -in "$work/server.csr" -CA "$work/ca.pem" -CAkey "$work/ca.key" \
      -CAcreateserial -days 825 -extfile "$work/ext" -out "$work/server.crt" 2> /dev/null
    cat "$work/server.key" "$work/server.crt" > "$TLS/mongod.pem.new"
  )
  install -m 644 "$work/ca.pem" "$TLS/ca.pem"
  mv "$TLS/mongod.pem.new" "$TLS/mongod.pem"
  rm -rf "$work"
}

mongosh_local() {
  mongosh --quiet --tls --tlsCAFile "$TLS/ca.pem" --host 127.0.0.1 --port 27017 "$@"
}

as_app() {
  gosu assurer "$@"
}

pbm_uri() {
  echo "mongodb://pbm:$(cat "$SECRETS/mongo-pbm-password")@127.0.0.1:27017/?authSource=admin&replicaSet=rs0&tls=true&tlsCAFile=$TLS/ca.pem"
}

wait_for_primary() {
  until [ "$(mongosh_local --eval 'db.hello().isWritablePrimary' 2> /dev/null)" = "true" ]; do
    kill -0 "$mongod_pid" 2> /dev/null || { log "MongoDB stopped"; exit 1; }
    sleep 1
  done
}

# The first user is created through MongoDB's localhost exception, which closes
# once that user exists. Passwords go through standard input, not the arguments.
init_database() {
  log "First start: creating the replica set and the user administrator"
  mongosh_local --eval 'if (!db.hello().setName) { rs.initiate({ _id: "rs0", members: [ { _id: 0, host: "127.0.0.1:27017" } ] }); }' > /dev/null
  wait_for_primary
  mongosh_local <<EOF > /dev/null
db.getSiblingDB("admin").createUser({
  user: "siteAdmin",
  pwd: "$(cat "$SECRETS/mongo-admin-password")",
  roles: [ "userAdminAnyDatabase", "clusterAdmin" ]
});
EOF
  if [ "$MODE" = "site" ]; then
    # A restore brings the app user back with the backup.
    mongosh_local <<EOF > /dev/null
db.getSiblingDB("admin").auth("siteAdmin", "$(cat "$SECRETS/mongo-admin-password")");
db.getSiblingDB("$DB_NAME").createUser({
  user: "assurerApp",
  pwd: "$(cat "$SECRETS/mongo-app-password")",
  roles: [ { role: "readWrite", db: "$DB_NAME" } ]
});
EOF
  fi
  touch "$SECRETS/.database-ready"
}

# The pbm user's roles, from Percona's documentation. pbmAnyAction can do
# anything in MongoDB (D-DB-12, accepted by the owner).
ensure_pbm_user() {
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
# own environment, which the app's user cannot read. If the agent stops, it
# is started again; the site keeps running.
agent_loop() {
  while true; do
    log "Starting pbm-agent"
    PBM_MONGODB_URI="$(pbm_uri)" gosu pbm pbm-agent > /dev/null 2>&1 || true
    log "pbm-agent stopped; starting it again in 5 s"
    sleep 5
  done
}

# A base backup soon after each start, then every BACKUP_HOURS, followed by
# removing backups and oplog slices older than BACKUP_RETENTION. PITR needs a
# base backup older than the point it restores to, so the retention is one day
# longer than the 7-day PITR target (D-DB-4).
backup_loop() {
  sleep 120
  while true; do
    if pbmc backup --wait > /dev/null 2>&1; then
      log "Base backup finished"
    else
      log "ERROR: base backup failed; see 'pbmc status' and 'pbmc logs'"
    fi
    if ! pbmc cleanup --older-than "$BACKUP_RETENTION" --yes --wait > /dev/null 2>&1; then
      log "ERROR: removing old backups failed"
    fi
    sleep $((BACKUP_HOURS * 3600))
  done
}

mongod_pid=
app_pid=
agent_pid=
backup_pid=

stop_all() {
  for pid in "$backup_pid" "$agent_pid"; do
    [ -n "$pid" ] && kill -TERM "$pid" 2> /dev/null || true
  done
  pkill -TERM -u pbm pbm-agent 2> /dev/null || true
  if [ -n "$app_pid" ]; then
    kill -TERM "$app_pid" 2> /dev/null || true
    wait "$app_pid" 2> /dev/null || true
  fi
  kill -TERM "$mongod_pid" 2> /dev/null || true
  wait "$mongod_pid" 2> /dev/null || true
}

shutdown() {
  log "Stopping"
  stop_all
  exit 0
}
trap shutdown TERM INT

mkdir -p "$SECRETS"
chown root:root "$SECRETS"
chmod 700 "$SECRETS"
ensure_secret mongo-keyfile 512
ensure_secret mongo-admin-password 24
ensure_secret mongo-app-password 24
ensure_secret mongo-pbm-password 24
ensure_secret session-secret 48
ensure_tls
chown mongodb:mongodb "$SECRETS/mongo-keyfile" "$TLS/mongod.pem"
chmod 400 "$SECRETS/mongo-keyfile" "$TLS/mongod.pem"
chmod 755 "$TLS"
# Other users may enter the secrets directory but not list it: mongod reads
# its key file and certificate, the app and pbm-agent read the CA certificate.
chmod 711 "$SECRETS"
chown -R mongodb:mongodb /data/db
chown -R assurer:assurer /app/public/uploads /app/data

gosu mongodb mongod --config /etc/assurer/mongod.conf --wiredTigerCacheSizeGB "$CACHE_GB" &
mongod_pid=$!

until mongosh_local --eval 'db.hello().ok' > /dev/null 2>&1; do
  kill -0 "$mongod_pid" 2> /dev/null || { log "MongoDB did not start"; exit 1; }
  sleep 1
done

[ -e "$SECRETS/.database-ready" ] || init_database
wait_for_primary
ensure_pbm_user
agent_loop &
agent_pid=$!

if [ ! -e "$SECRETS/.pbm-configured" ]; then
  # The agent must be running before the configuration is applied.
  sleep 5
  pbmc config --file /etc/assurer/pbm-config.yaml > /dev/null
  if [ "$MODE" = "restore" ]; then
    pbmc config --set pitr.enabled=false > /dev/null
  fi
  touch "$SECRETS/.pbm-configured"
  log "PBM configured ($MODE mode)"
fi

if [ "$MODE" = "restore" ]; then
  log "Restore mode: MongoDB and pbm-agent only. Run 'pbmc restore', then start in site mode"
  wait "$mongod_pid" || true
  log "MongoDB stopped; stopping the container"
  stop_all
  exit 1
fi

APOS_DB_URI="mongodb://assurerApp:$(cat "$SECRETS/mongo-app-password")@127.0.0.1:27017/$DB_NAME?replicaSet=rs0&authSource=$DB_NAME&tls=true&tlsCAFile=$TLS/ca.pem"
APOS_SESSION_SECRET="$(cat "$SECRETS/session-secret")"
export APOS_DB_URI APOS_SESSION_SECRET

as_app node app @apostrophecms/migration:migrate

if [ ! -e "$SECRETS/.admin-ready" ]; then
  log "First start: creating the admin account with a random password"
  ensure_secret admin-initial-password 16
  # The prompt echoes what it reads, so its output must stay out of the logs.
  as_app node app @apostrophecms/user:add admin admin < "$SECRETS/admin-initial-password" > /dev/null
  touch "$SECRETS/.admin-ready"
  log "Admin login: user 'admin', password in $SECRETS/admin-initial-password (root only)."
  log "Change it in the admin UI, then delete that file"
fi

# Apostrophe's cluster mode when APOS_CLUSTER_PROCESSES is set (m1-054). The
# primary restarts a worker that exits; the container stops if the primary does.
as_app node app &
app_pid=$!

if [ "$BACKUP_HOURS" -gt 0 ]; then
  backup_loop &
  backup_pid=$!
fi
log "Started ($MODE mode, ${APOS_CLUSTER_PROCESSES:-1} web process(es), MongoDB cache ${CACHE_GB} GB)"

# Stop when MongoDB or the app ends. shutdown() handles a stop request.
wait -n "$mongod_pid" "$app_pid" || true
log "A process stopped; stopping the container"
stop_all
exit 1
