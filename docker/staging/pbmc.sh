#!/bin/bash
# Runs the pbm CLI with the pbm user's credentials (m1-055), for docker exec
# into the pbm service: `$S exec pbm pbmc status` (m1-068).
set -euo pipefail
. /usr/local/lib/assurer/pbm-env.sh
exec pbm "$@"
