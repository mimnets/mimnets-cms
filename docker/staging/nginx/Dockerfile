# HTTPS proxy for staging (m1-055, hardening runbook §8). The official nginx
# image, digest pinned on 2026-11-08, plus zlib 1.4 for CVE-2026-4738
# (critical; 1.30.6-alpine ships zlib 1.3.2). Build context: docker/staging.
FROM nginx:1.30.6-alpine@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311
# The xslt and njs modules are not loaded here. They are the only users of
# libxml2, which has a high finding with no fix (D-SEC-8, m1-057).
RUN apk add --no-cache --upgrade 'zlib>=1.4-r0' \
  && apk del --no-cache nginx-module-xslt nginx-module-njs libxslt libxml2 \
  && ! apk info -e libxml2 \
  && rm /etc/nginx/conf.d/default.conf
COPY nginx/assurer.conf.template /etc/nginx/templates/assurer.conf.template
COPY --chmod=755 nginx/40-assurer-reload.sh /docker-entrypoint.d/40-assurer-reload.sh
