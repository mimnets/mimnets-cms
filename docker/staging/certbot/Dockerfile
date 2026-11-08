# ACME client for staging (m1-055, hardening runbook §8): the official certbot
# image, digest pinned on 2026-11-08, plus zlib 1.4 for CVE-2026-4738
# (critical; v5.9.0 ships zlib 1.3.2). Build context: docker/staging.
FROM certbot/certbot:v5.9.0@sha256:bc93cb710b413e6b456d622f9b0133b3e109c0a78c2ed9976af43d209b0a1805
RUN apk add --no-cache --upgrade 'zlib>=1.4-r0'
COPY --chmod=755 certbot/deploy-hook.sh /usr/local/bin/assurer-deploy-hook
