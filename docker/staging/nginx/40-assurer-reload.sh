#!/bin/sh
# Reloads nginx every 6 hours, so a certificate that certbot renewed is used
# without a restart (m1-055). Runs in the background under the container's
# init (compose: init: true).
(
  while sleep 21600; do
    nginx -s reload
  done
) &
