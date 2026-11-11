# ACME client for staging (m1-055, hardening runbook §8): the official certbot
# image, digest pinned on 2026-11-08, plus zlib 1.4 for CVE-2026-4738
# (critical; v5.9.0 ships zlib 1.3.2). Build context: docker/staging.
FROM certbot/certbot:v5.9.0@sha256:bc93cb710b413e6b456d622f9b0133b3e109c0a78c2ed9976af43d209b0a1805 AS assembled
RUN apk add --no-cache --upgrade 'zlib>=1.4-r0'
COPY --chmod=755 certbot/deploy-hook.sh /usr/local/bin/assurer-deploy-hook

# One layer of our own, for the same reason as nginx/Dockerfile (m1-068). The
# base image's settings, declared again; update them with the pinned digest.
FROM scratch
COPY --from=assembled / /
ENV PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin     LANG=C.UTF-8     PYTHON_VERSION=3.14.10     PYTHON_SHA256=de414a57119abef52784d8993e341d53aed635fc2b05c2607d9f98a2c5b72032
WORKDIR /opt/certbot
EXPOSE 80 443
VOLUME ["/etc/letsencrypt", "/var/lib/letsencrypt"]
ENTRYPOINT ["certbot"]
