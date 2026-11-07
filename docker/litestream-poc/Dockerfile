# Litestream proof of concept (m1-048). A disposable test image only: the app on
# SQLite with Litestream 0.5.18 replicating to a local directory. It does not
# use the demo image (that one runs MongoDB) and changes nothing in it.
# Build from the repository root. linux/amd64 and linux/arm64 only.
# Guide: docs/milestones/m1-048-litestream-poc-results.md

# Same pinned base as the root Dockerfile's build stage.
FROM node:24-bookworm@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APOS_RELEASE_ID=litestream-poc
RUN APOS_SESSION_SECRET="$(openssl rand -hex 32)" \
    APOS_DB_URI="sqlite:///tmp/build.sqlite" \
    APOS_RELEASE_ID="$APOS_RELEASE_ID" \
    npm run build \
  && npm prune --omit=dev

# Litestream 0.5.18 from the GitHub release, pinned by SHA-256 (from the
# release's checksums.txt, 2026-11-07).
FROM node:24-bookworm@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40 AS litestream-download
ARG TARGETARCH
ARG LITESTREAM_VERSION=0.5.18
ARG LITESTREAM_SHA256_amd64=d3687b9fd0f2e9426bbd3da828429ff3f1dfc5c9b74d54fdf028e4ee510e7dea
ARG LITESTREAM_SHA256_arm64=922a09e6a7ac67f2095571894dc6382e94e1dd4cdd9674883ddf1a8e74ab982d
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) arch=x86_64; sha="$LITESTREAM_SHA256_amd64" ;; \
      arm64) arch=arm64; sha="$LITESTREAM_SHA256_arm64" ;; \
      *) echo "unsupported architecture $TARGETARCH"; exit 1 ;; \
    esac; \
    curl -fsSLo /tmp/litestream.tar.gz \
      "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-${arch}.tar.gz"; \
    echo "$sha  /tmp/litestream.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/litestream.tar.gz -C /usr/local/bin litestream; \
    /usr/local/bin/litestream version

FROM node:24-bookworm@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40
ARG APOS_RELEASE_ID=litestream-poc
COPY --from=litestream-download /usr/local/bin/litestream /usr/local/bin/litestream
COPY --from=build --chown=node:node /app /app
COPY docker/litestream-poc/litestream.yml /etc/litestream.yml
COPY --chmod=755 docker/litestream-poc/entrypoint.sh /usr/local/bin/litestream-poc-entrypoint

# The app and Litestream run as the image's unprivileged "node" user. The
# directories exist before VOLUME, so new named volumes get this owner.
RUN mkdir -p /data/db /data/secrets /replica /replica-source /app/public/uploads \
  && chown node:node /data/db /data/secrets /replica /app/public/uploads \
  && chmod 700 /data/secrets
USER node

WORKDIR /app
ENV NODE_ENV=production \
    APOS_RELEASE_ID=$APOS_RELEASE_ID \
    APOS_DEMO_SITE=1 \
    APOS_DB_URI=sqlite:///data/db/assurer.sqlite \
    PORT=3000 \
    ADDRESS=0.0.0.0
EXPOSE 3000

VOLUME ["/data/db", "/data/secrets", "/replica", "/app/public/uploads"]

ENTRYPOINT ["litestream-poc-entrypoint"]
