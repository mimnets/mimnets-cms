# Staging image (m1-055): the one-container image (app and MongoDB 8.0,
# D-DB-10 (b)) with Percona Backup for MongoDB, MongoDB TLS, no demo content
# and no default password. Built from the root Dockerfile's image (BASE_IMAGE),
# whose demo entrypoint it removes. linux/amd64 and linux/arm64 only, the
# platforms of mongo:8.0.34. Build it with docker/staging/compose.yaml.
# Guide: docs/runbooks/staging-container.md
ARG BASE_IMAGE=assurer-site:staging-base

# The download stage uses the build image the main Dockerfile already pins,
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

FROM ${BASE_IMAGE} AS assembled
COPY --from=pbm-download /tmp/pbm.deb /tmp/pbm.deb
RUN dpkg -i /tmp/pbm.deb && rm /tmp/pbm.deb && pbm version

# apt 2.8.3 in the pinned mongo image has a high finding (CVE-2026-109518,
# D-SEC-8, m1-057). The site never runs apt. Remove this once the base image
# ships the fix. If Ubuntu replaces this version, the build fails here: pin the
# new one.
RUN apt-get update \
  && apt-get install -y --no-install-recommends --only-upgrade \
    apt=2.8.4ubuntu0.1 libapt-pkg6.0t64=2.8.4ubuntu0.1 \
  && rm -rf /var/lib/apt/lists/*

# pbm-agent runs as its own OS user, so the app's user cannot read its
# credentials.
RUN useradd --system --uid 1002 --no-create-home --shell /usr/sbin/nologin pbm \
  && mkdir -p /backups && chown pbm:pbm /backups && chmod 700 /backups \
  && rm /usr/local/bin/assurer-entrypoint /etc/assurer/mongod.conf

# What the running site does not need, because of the critical and high findings
# in it (D-SEC-8): gosu (see run-as.sh), the mongo image's entrypoint with its
# js-yaml, and the esbuild binaries, which only the build stage uses. esbuild's
# JavaScript stays, because the vite module still loads it.
RUN rm -rf /usr/local/bin/gosu /usr/local/bin/docker-entrypoint.sh /opt/js-yaml /js-yaml.js \
    /app/node_modules/esbuild/bin /app/node_modules/@esbuild \
  && test -z "$(find /app/node_modules -type f -name esbuild)"
COPY docker/staging/mongod.conf /etc/assurer/mongod.conf
COPY docker/staging/pbm-config.yaml /etc/assurer/pbm-config.yaml
COPY --chmod=755 docker/staging/entrypoint.sh /usr/local/bin/assurer-staging-entrypoint
COPY --chmod=755 docker/staging/pbmc.sh /usr/local/bin/pbmc
COPY --chmod=755 docker/staging/assurer-task.sh /usr/local/bin/assurer-task
COPY --chmod=755 docker/staging/run-as.sh /usr/local/bin/assurer-run-as

# One layer, because a file removed above otherwise stays in the base image's
# layers, where a scanner still finds it (m1-056). Nothing is inherited from
# the stages above, so every setting the image needs is declared here.
FROM scratch
COPY --from=assembled / /
ARG APOS_RELEASE_ID=docker-local
WORKDIR /app
# GLIBC_TUNABLES and HOME as in the mongo base image; update them if it changes.
# No demonstration notice (lib/demo-site.js). Two web processes (m1-054).
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    HOME=/data/db \
    GLIBC_TUNABLES=glibc.pthread.rseq=0 \
    NODE_ENV=production \
    APOS_RELEASE_ID=$APOS_RELEASE_ID \
    APOS_DEMO_SITE=0 \
    APOS_CLUSTER_PROCESSES=2 \
    PORT=3000 \
    ADDRESS=0.0.0.0
EXPOSE 3000
VOLUME ["/data/db", "/data/configdb", "/data/secrets", "/app/public/uploads", "/app/data", "/backups"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.status === 200 ? 0 : 1), () => process.exit(1))"
ENTRYPOINT ["assurer-staging-entrypoint"]
