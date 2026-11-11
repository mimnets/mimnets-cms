#!/bin/bash
# The mongo service (m1-068, D-DB-20): MongoDB 8.0 with TLS and member
# authentication, as a one-member replica set named mongo:27017. At every
# start it checks the database itself and adds what is missing: the replica
# set, the user administrator, the app user and the PBM user. The secrets come
# from the setup job, in the read-only /secrets volume.
#
# ASSURER_RESTORE=1 (restore drill): no app user, because `pbm restore` brings
# it back with the backup.
#
# Guides: docs/runbooks/staging-container.md, docs/runbooks/pbm-backup-and-restore.md
set -euo pipefail

SECRETS=/secrets
TLS="$SECRETS/tls"
DB_NAME=assurer
MEMBER=mongo:27017
CACHE_GB="${ASSURER_MONGO_CACHE_GB:-1}"
# Removed at every start; written when the checks below are done. The health
# check needs it, so the app and PBM start only after their users exist.
READY=/tmp/assurer-mongo-ready

log() {
  echo "[assurer] $*"
}

mongosh_local() {
  mongosh --quiet --tls --tlsCAFile "$TLS/ca.pem" --host localhost --port 27017 "$@"
}

# Runs the script on standard input with --file, so that an error stops this
# entrypoint (piped input would not). The file holds passwords, so it is
# private and removed at once; they never go into the arguments.
run_js() {
  local file status=0
  file="$(umask 077; mktemp /tmp/assurer-XXXXXX.js)"
  cat > "$file"
  mongosh_local --file "$file" > /dev/null || status=$?
  rm -f "$file"
  return "$status"
}

# As run_js, logged in as the user administrator.
mongosh_admin() {
  { printf 'db.getSiblingDB("admin").auth("siteAdmin", "%s");\n' "$(cat "$SECRETS/mongo-admin-password")"; cat; } | run_js
}

wait_for_primary() {
  until [ "$(mongosh_local --eval 'db.hello().isWritablePrimary' 2> /dev/null)" = "true" ]; do
    kill -0 "$mongod_pid" 2> /dev/null || { log "MongoDB stopped"; exit 1; }
    sleep 1
  done
}

# The replica set and the first user. The first user is created through
# MongoDB's localhost exception, which closes once that user exists.
ensure_replica_set_and_admin() {
  if [ -z "$(mongosh_local --eval 'db.hello().setName || ""')" ]; then
    log "Creating the replica set ($MEMBER)"
    mongosh_local --eval "rs.initiate({ _id: 'rs0', members: [ { _id: 0, host: '$MEMBER' } ] })" > /dev/null
  fi
  wait_for_primary
  run_js <<EOF
const admin = db.getSiblingDB("admin");
let known = false;
try { known = admin.auth("siteAdmin", "$(cat "$SECRETS/mongo-admin-password")").ok === 1; } catch (e) {}
if (!known) {
  print("[assurer] Creating the user administrator");
  admin.createUser({
    user: "siteAdmin",
    pwd: "$(cat "$SECRETS/mongo-admin-password")",
    roles: [ "userAdminAnyDatabase", "clusterAdmin" ]
  });
}
EOF
}

ensure_app_user() {
  mongosh_admin <<EOF
const site = db.getSiblingDB("$DB_NAME");
if (!site.getUser("assurerApp")) {
  site.createUser({
    user: "assurerApp",
    pwd: "$(cat "$SECRETS/mongo-app-password")",
    roles: [ { role: "readWrite", db: "$DB_NAME" } ]
  });
}
EOF
}

# The pbm user's roles, from Percona's documentation. pbmAnyAction can do
# anything in MongoDB (D-DB-12, accepted by the owner).
ensure_pbm_user() {
  mongosh_admin <<EOF
const admin = db.getSiblingDB("admin");
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

mongod_pid=

shutdown() {
  log "Stopping MongoDB"
  rm -f "$READY"
  kill -TERM "$mongod_pid" 2> /dev/null || true
  wait "$mongod_pid" 2> /dev/null || true
  exit 0
}
trap shutdown TERM INT

for file in mongo-keyfile mongo-admin-password mongo-app-password mongo-pbm-password tls/mongod.pem tls/ca.pem; do
  [ -s "$SECRETS/$file" ] || { log "Missing $SECRETS/$file: the setup job has not run"; exit 1; }
done
rm -f "$READY"
chown -R mongodb:mongodb /data/db

assurer-run-as mongodb mongod --config /etc/assurer/mongod.conf --wiredTigerCacheSizeGB "$CACHE_GB" &
mongod_pid=$!

until mongosh_local --eval 'db.hello().ok' > /dev/null 2>&1; do
  kill -0 "$mongod_pid" 2> /dev/null || { log "MongoDB did not start"; exit 1; }
  sleep 1
done

ensure_replica_set_and_admin
if [ "${ASSURER_RESTORE:-0}" != 1 ]; then
  ensure_app_user
fi
ensure_pbm_user
# The certificate MongoDB loaded at this start, for deploy.sh (setup.sh).
cp "$TLS/serial" /tmp/assurer-tls-serial 2> /dev/null || true
touch "$READY"
if [ "${ASSURER_RESTORE:-0}" = 1 ]; then
  log "MongoDB ready for a restore (cache ${CACHE_GB} GB); no app user"
else
  log "MongoDB ready (cache ${CACHE_GB} GB)"
fi

wait "$mongod_pid" || true
log "MongoDB stopped; stopping the container"
exit 1
