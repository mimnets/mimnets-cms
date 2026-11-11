#!/bin/bash
# Runs an Apostrophe task (`node app <task> …`) as the app user with the
# site's database and session secret, for docker exec (m1-067). The secrets
# go through the environment, not the arguments, as in pbmc.
#   docker compose … exec site assurer-task assurer-wp-import:run
set -euo pipefail
if [ "$#" -eq 0 ]; then
  echo "Usage: assurer-task <module>:<task> [options]   e.g. assurer-task assurer-seo:seed-redirects" >&2
  exit 2
fi
SECRETS=/data/secrets
APOS_DB_URI="mongodb://assurerApp:$(cat "$SECRETS/mongo-app-password")@127.0.0.1:27017/assurer?replicaSet=rs0&authSource=assurer&tls=true&tlsCAFile=$SECRETS/tls/ca.pem"
APOS_SESSION_SECRET="$(cat "$SECRETS/session-secret")"
export APOS_DB_URI APOS_SESSION_SECRET
cd /app
exec assurer-run-as assurer node app "$@"
