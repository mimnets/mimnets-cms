#!/bin/sh
# certbot deploy hook (m1-055): copies a newly issued or renewed certificate to
# the fixed path nginx reads (/etc/letsencrypt/current, mounted in nginx as
# /etc/nginx/certs/current). nginx picks it up at its next reload (6 hours at
# most). certbot sets RENEWED_LINEAGE to the certificate's live directory.
set -eu
dest=/etc/letsencrypt/current
mkdir -p "$dest"
cp -L "$RENEWED_LINEAGE/fullchain.pem" "$dest/fullchain.pem.new"
(umask 077; cp -L "$RENEWED_LINEAGE/privkey.pem" "$dest/privkey.pem.new")
mv "$dest/privkey.pem.new" "$dest/privkey.pem"
mv "$dest/fullchain.pem.new" "$dest/fullchain.pem"
echo "[certbot] Certificate copied to $dest"
