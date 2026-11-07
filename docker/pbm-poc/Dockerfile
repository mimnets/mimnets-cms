# PBM proof of concept (m1-046). A disposable test image only: it adds
# Percona Backup for MongoDB to the demo image and changes nothing in it.
# Build the demo image for the same platform first (BASE_IMAGE), then build
# this one from the repository root. linux/amd64 and linux/arm64 only, the
# platforms of mongo:8.0.34.
# Guide: docs/milestones/m1-046-pbm-poc-results.md
ARG BASE_IMAGE=assurer-site:local

# The download stage uses the build image the main Dockerfile already pins,
# because the final image has no curl.
FROM node:24-bookworm@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40 AS pbm-download
# PBM 2.17.0 from Percona's noble repository, pinned by file and SHA-256
# (copied from the repository's Packages index on 2026-11-07).
ARG TARGETARCH
ARG PBM_VERSION=2.17.0-1.noble
ARG PBM_SHA256_amd64=3964c28daed342959863c8b228f0098023ce2058787e8926505fd81e4770ed31
ARG PBM_SHA256_arm64=a5e25085694c0405c9b230fb6ee5b368fafdc0c8b906f2f9842e872df5379047
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) sha="$PBM_SHA256_amd64" ;; \
      arm64) sha="$PBM_SHA256_arm64" ;; \
      *) echo "unsupported architecture $TARGETARCH"; exit 1 ;; \
    esac; \
    curl -fsSLo /tmp/pbm.deb \
      "https://repo.percona.com/pbm/apt/pool/main/p/percona-backup-mongodb/percona-backup-mongodb_${PBM_VERSION}_${TARGETARCH}.deb"; \
    echo "$sha  /tmp/pbm.deb" | sha256sum -c -

FROM ${BASE_IMAGE}
COPY --from=pbm-download /tmp/pbm.deb /tmp/pbm.deb
RUN dpkg -i /tmp/pbm.deb && rm /tmp/pbm.deb && pbm version

# pbm-agent runs as its own OS user, so the app's user cannot read its
# credentials (P7).
RUN useradd --system --uid 1002 --no-create-home --shell /usr/sbin/nologin pbm \
  && mkdir -p /backups && chown pbm:pbm /backups && chmod 700 /backups
COPY docker/pbm-poc/pbm-config.yaml /etc/assurer/pbm-config.yaml
COPY --chmod=755 docker/pbm-poc/pbm-entrypoint.sh /usr/local/bin/pbm-entrypoint
COPY --chmod=755 docker/pbm-poc/pbmc.sh /usr/local/bin/pbmc

VOLUME ["/backups"]
ENTRYPOINT ["pbm-entrypoint"]
