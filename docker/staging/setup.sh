#!/bin/bash
# One-shot job before every start of the stack (m1-068): writes each secret
# that is missing, and the MongoDB TLS files, into the secrets volume of the
# service that needs them. Each service mounts only its own volume. Values
# already there are never changed. No network.
#
#   /secrets/mongo  key file, TLS, the database users' passwords (mongo)
#   /secrets/app    the app's database password, session secret, CA (app)
#   /secrets/pbm    the PBM user's password, CA (pbm, backup)
#
# The mongo volume is the source; the app and pbm volumes get copies, renewed
# when the source changes.
# Guide: docs/runbooks/staging-container.md
set -euo pipefail

MONGO=/secrets/mongo
APP=/secrets/app
PBM=/secrets/pbm
TLS="$MONGO/tls"
# Owners: mongodb from the base image; assurer (app image) and pbm (this image).
MONGO_UID=999
APP_UID=1001
PBM_UID=1002

log() {
  echo "[assurer-setup] $*"
}

# Writes a random secret once. The value is hex, so it is safe in a URI and in
# the mongosh commands of the mongo entrypoint.
ensure_secret() {
  local file="$1"
  if [ ! -s "$file" ]; then
    (umask 077; openssl rand -hex "$2" > "$file")
    log "Created $(basename "$file") in $(dirname "$file")"
  fi
}

# Copies a file to another service's volume when it is missing or different.
copy_to() {
  if ! cmp -s "$1" "$2"; then
    install -m 400 "$1" "$2"
  fi
}

# A private CA and a server certificate for MongoDB under its service name.
# The CA key is deleted once the certificate is signed, so nothing can sign
# another one (hardening runbook §6 step 2). Both are made again when the
# certificate has less than 30 days left. tls/serial then changes, which
# deploy.sh compares with what MongoDB loaded, and restarts the database and
# its clients.
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
    openssl req -newkey rsa:3072 -nodes -subj "/CN=mongo" \
      -keyout "$work/server.key" -out "$work/server.csr" 2> /dev/null
    printf 'subjectAltName=DNS:mongo,DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth,clientAuth\n' > "$work/ext"
    openssl x509 -req -in "$work/server.csr" -CA "$work/ca.pem" -CAkey "$work/ca.key" \
      -CAcreateserial -days 825 -extfile "$work/ext" -out "$work/server.crt" 2> /dev/null
    cat "$work/server.key" "$work/server.crt" > "$TLS/mongod.pem.new"
  )
  install -m 644 "$work/ca.pem" "$TLS/ca.pem"
  mv "$TLS/mongod.pem.new" "$TLS/mongod.pem"
  openssl x509 -noout -serial -in "$TLS/mongod.pem" > "$TLS/serial"
  rm -rf "$work"
}

mkdir -p "$MONGO" "$APP" "$PBM"
chmod 700 "$MONGO" "$APP" "$PBM"

ensure_secret "$MONGO/mongo-keyfile" 512
ensure_secret "$MONGO/mongo-admin-password" 24
ensure_secret "$MONGO/mongo-app-password" 24
ensure_secret "$MONGO/mongo-pbm-password" 24
ensure_secret "$APP/session-secret" 48
ensure_tls

copy_to "$MONGO/mongo-app-password" "$APP/mongo-password"
copy_to "$TLS/ca.pem" "$APP/ca.pem"
copy_to "$MONGO/mongo-pbm-password" "$PBM/mongo-password"
copy_to "$TLS/ca.pem" "$PBM/ca.pem"

# mongod refuses a key file that others can read.
chown -R "$MONGO_UID:$MONGO_UID" "$MONGO"
chmod 400 "$MONGO/mongo-keyfile" "$TLS/mongod.pem"
chown -R "$APP_UID:$APP_UID" "$APP"
chown -R "$PBM_UID:$PBM_UID" "$PBM"
log "Secrets ready"
