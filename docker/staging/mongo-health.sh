#!/bin/bash
# Health check of the mongo service (m1-068): the entrypoint has finished its
# checks at this start, and this member is the writable primary.
set -euo pipefail
[ -e /tmp/assurer-mongo-ready ]
[ "$(mongosh --quiet --tls --tlsCAFile /secrets/tls/ca.pem --host localhost --port 27017 \
  --eval 'db.hello().isWritablePrimary')" = "true" ]
