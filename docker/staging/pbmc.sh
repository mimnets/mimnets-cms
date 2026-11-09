#!/bin/bash
# Runs the pbm CLI as the pbm user with its credentials, for docker exec
# (m1-055). The credentials go through the environment, not the arguments.
set -euo pipefail
PBM_MONGODB_URI="mongodb://pbm:$(cat /data/secrets/mongo-pbm-password)@127.0.0.1:27017/?authSource=admin&replicaSet=rs0&tls=true&tlsCAFile=/data/secrets/tls/ca.pem"
export PBM_MONGODB_URI
exec assurer-run-as pbm pbm "$@"
