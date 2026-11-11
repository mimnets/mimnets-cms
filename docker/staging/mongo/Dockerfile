# Database image for the stack (m1-068, D-DB-20): the official MongoDB 8.0.34
# image with Percona Backup for MongoDB and this project's scripts. One image
# for the mongo, pbm, backup, setup and cert-bootstrap services; each runs
# one process. linux/amd64 and linux/arm64 only, the platforms of mongo:8.0.34.
# Build it with docker/staging/compose.build.yaml.
# Guide: docs/runbooks/staging-container.md

# The download stage uses the build image the root Dockerfile already pins,
# because the final image has no curl.
FROM node:24-bookworm@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40 AS pbm-download
# PBM 2.17.0 from Percona's noble repository, pinned by file and SHA-256
# (the same package as the m1-046 proof of concept). Three high findings in
# its Go libraries are accepted until a fixed release (D-SEC-5).
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

# Digest pinned on 2026-11-06. MongoDB stays on 8.0.30 or newer (CVE-2026-82067)
# and on 8.2 at most, the driver limit (D-DB-9).
FROM mongo:8.0.34@sha256:b9924c330a8bbc5800fe9c69f04a84e221eca7b28fd049a0354147d9908fa142 AS assembled
COPY --from=pbm-download /tmp/pbm.deb /tmp/pbm.deb
RUN dpkg -i /tmp/pbm.deb && rm /tmp/pbm.deb && pbm version

# apt 2.8.3 in the pinned mongo image has a high finding (CVE-2026-109518,
# D-SEC-8, m1-057). Nothing here runs apt. Remove this once the base image
# ships the fix. If Ubuntu replaces this version, the build fails here: pin the
# new one.
RUN apt-get update \
  && apt-get install -y --no-install-recommends --only-upgrade \
    apt=2.8.4ubuntu0.1 libapt-pkg6.0t64=2.8.4ubuntu0.1 \
  && rm -rf /var/lib/apt/lists/*

# pbm-agent and the backup schedule run as their own OS user. /backups is
# copied into a new pbm-backups volume with this owner and mode.
RUN useradd --system --uid 1002 --no-create-home --shell /usr/sbin/nologin pbm \
  && mkdir -p /backups && chown pbm:pbm /backups && chmod 700 /backups

# What the stack does not need, because of the critical and high findings in
# it (D-SEC-8): gosu (see run-as.sh) and the mongo image's entrypoint with its
# js-yaml. The project's entrypoints replace them.
RUN rm -rf /usr/local/bin/gosu /usr/local/bin/docker-entrypoint.sh /opt/js-yaml /js-yaml.js
COPY docker/staging/mongod.conf /etc/assurer/mongod.conf
COPY docker/staging/pbm-config.yaml /etc/assurer/pbm-config.yaml
COPY docker/staging/pbm-env.sh /usr/local/lib/assurer/pbm-env.sh
COPY --chmod=755 docker/staging/setup.sh /usr/local/bin/assurer-setup
COPY --chmod=755 docker/staging/mongo-entrypoint.sh /usr/local/bin/assurer-mongo
COPY --chmod=755 docker/staging/mongo-health.sh /usr/local/bin/assurer-mongo-health
COPY --chmod=755 docker/staging/pbm-agent.sh /usr/local/bin/assurer-pbm-agent
COPY --chmod=755 docker/staging/backup-schedule.sh /usr/local/bin/assurer-backup-schedule
COPY --chmod=755 docker/staging/pbmc.sh /usr/local/bin/pbmc
COPY --chmod=755 docker/staging/run-as.sh /usr/local/bin/assurer-run-as

# One layer, because a file removed above otherwise stays in the base image's
# layers, where a scanner still finds it (m1-056). Nothing is inherited from
# the stages above, so every setting the image needs is declared here. No
# VOLUME: the one-shot services would otherwise leave anonymous volumes.
FROM scratch
COPY --from=assembled / /
# GLIBC_TUNABLES and HOME as in the mongo base image; update them if it changes.
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    HOME=/data/db \
    GLIBC_TUNABLES=glibc.pthread.rseq=0
ENTRYPOINT ["assurer-mongo"]
