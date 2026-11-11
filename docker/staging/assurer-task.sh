#!/bin/bash
# Runs an Apostrophe task (`node app <task> …`) with the site's database and
# session secret, for docker exec into the app service (m1-067, m1-068):
#   docker compose … exec app assurer-task assurer-wp-import:run
set -euo pipefail
if [ "$#" -eq 0 ]; then
  echo "Usage: assurer-task <module>:<task> [options]   e.g. assurer-task assurer-seo:seed-redirects" >&2
  exit 2
fi
. /usr/local/lib/assurer/app-env.sh
cd /app
exec node app "$@"
