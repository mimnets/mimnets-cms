#!/bin/bash
# Starts MongoDB and the Apostrophe app in one container (m1-043). The first
# start creates the secrets, replica set, database users, demo content and an
# admin account. Later starts reuse them. If either process stops, the container
# stops, so the restart policy brings both back together.
set -euo pipefail

SECRETS=/data/secrets
DB_NAME=assurer

log() {
  echo "[assurer] $*"
}

# Writes a random secret once. The value is hex, so it is safe in a URI and in
# the mongosh commands below.
ensure_secret() {
  local file="$SECRETS/$1"
  if [ ! -s "$file" ]; then
    (umask 077; openssl rand -hex "$2" > "$file")
  fi
}

mongosh_local() {
  mongosh --quiet --port 27017 "$@"
}

as_app() {
  gosu assurer "$@"
}

mkdir -p "$SECRETS"
chown root:root "$SECRETS"
chmod 700 "$SECRETS"
ensure_secret mongo-keyfile 512
ensure_secret mongo-admin-password 24
ensure_secret mongo-app-password 24
ensure_secret session-secret 48
chown mongodb:mongodb "$SECRETS/mongo-keyfile"
chmod 400 "$SECRETS/mongo-keyfile"
# mongod reads its key file as the mongodb user.
chmod 711 "$SECRETS"
chown -R mongodb:mongodb /data/db
chown -R assurer:assurer /app/public/uploads /app/data

gosu mongodb mongod --config /etc/assurer/mongod.conf &
mongod_pid=$!
app_pid=

shutdown() {
  log "Stopping"
  if [ -n "$app_pid" ]; then
    kill -TERM "$app_pid" 2>/dev/null || true
    wait "$app_pid" 2>/dev/null || true
  fi
  kill -TERM "$mongod_pid" 2>/dev/null || true
  wait "$mongod_pid" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

until mongosh_local --eval 'db.hello().ok' > /dev/null 2>&1; do
  kill -0 "$mongod_pid" 2>/dev/null || { log "MongoDB did not start"; exit 1; }
  sleep 1
done

# The first user is created through MongoDB's localhost exception, which closes
# once that user exists. Passwords go through standard input, not the arguments.
if [ ! -e "$SECRETS/.database-ready" ]; then
  log "First start: creating the replica set and database users"
  mongosh_local <<'EOF' > /dev/null
if (!db.hello().setName) {
  rs.initiate({ _id: "rs0", members: [ { _id: 0, host: "127.0.0.1:27017" } ] });
}
EOF
  until [ "$(mongosh_local --eval 'db.hello().isWritablePrimary')" = "true" ]; do
    sleep 1
  done
  mongosh_local <<EOF > /dev/null
db.getSiblingDB("admin").createUser({
  user: "siteAdmin",
  pwd: "$(cat "$SECRETS/mongo-admin-password")",
  roles: [ "userAdminAnyDatabase", "clusterAdmin" ]
});
db.getSiblingDB("admin").auth("siteAdmin", "$(cat "$SECRETS/mongo-admin-password")");
db.getSiblingDB("$DB_NAME").createUser({
  user: "assurerApp",
  pwd: "$(cat "$SECRETS/mongo-app-password")",
  roles: [ { role: "readWrite", db: "$DB_NAME" } ]
});
EOF
  touch "$SECRETS/.database-ready"
fi

APOS_DB_URI="mongodb://assurerApp:$(cat "$SECRETS/mongo-app-password")@127.0.0.1:27017/$DB_NAME?replicaSet=rs0&authSource=$DB_NAME"
APOS_SESSION_SECRET="$(cat "$SECRETS/session-secret")"
export APOS_DB_URI APOS_SESSION_SECRET

as_app node app @apostrophecms/migration:migrate

if [ ! -e "$SECRETS/.content-ready" ]; then
  log "First start: loading demo content and creating the admin account"
  as_app node app assurer-demo:seed
  # The prompt echoes what it reads, so its output must stay out of the logs.
  echo "${ASSURER_ADMIN_PASSWORD:-admin}" | as_app node app @apostrophecms/user:add admin admin > /dev/null
  touch "$SECRETS/.content-ready"
fi

as_app node app &
app_pid=$!
log "Started. Admin login: user 'admin', default password unless ASSURER_ADMIN_PASSWORD was set"

# Stop when either process ends. shutdown() handles a stop request.
wait -n "$mongod_pid" "$app_pid" || true
log "A process stopped; stopping the container"
kill -TERM "$app_pid" "$mongod_pid" 2>/dev/null || true
wait "$app_pid" 2>/dev/null || true
wait "$mongod_pid" 2>/dev/null || true
exit 1
