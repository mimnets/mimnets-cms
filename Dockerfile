# One container with the whole project: the Apostrophe app and MongoDB (m1-043).
# Demo and test use only: D-DB-10 (b) on staging and production is still open.
# Guide: docs/runbooks/docker-single-container.md

# Digests pinned on 2026-11-06. MongoDB stays on 8.0.30 or newer (CVE-2026-82067)
# and on 8.2 at most, the driver limit (D-DB-9).
FROM node:24-bookworm@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APOS_RELEASE_ID=docker-local
# The build needs a session secret and a database, but keeps neither: both are
# throwaway, and this stage is not part of the final image.
RUN APOS_SESSION_SECRET="$(openssl rand -hex 32)" \
    APOS_DB_URI="sqlite:///tmp/build.sqlite" \
    APOS_RELEASE_ID="$APOS_RELEASE_ID" \
    npm run build \
  && npm prune --omit=dev

FROM mongo:8.0.34@sha256:b9924c330a8bbc5800fe9c69f04a84e221eca7b28fd049a0354147d9908fa142
ARG APOS_RELEASE_ID=docker-local
COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build /app /app
COPY docker/mongod.conf /etc/assurer/mongod.conf
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/assurer-entrypoint
RUN useradd --system --uid 1001 --no-create-home --shell /usr/sbin/nologin assurer

WORKDIR /app
ENV NODE_ENV=production \
    APOS_RELEASE_ID=$APOS_RELEASE_ID \
    APOS_DEMO_SITE=1 \
    PORT=3000 \
    ADDRESS=0.0.0.0
EXPOSE 3000

VOLUME ["/data/secrets", "/app/public/uploads", "/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.status === 200 ? 0 : 1), () => process.exit(1))"

ENTRYPOINT ["assurer-entrypoint"]
