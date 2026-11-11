# App image for the stack (m1-068, D-DB-20): Apostrophe only, without MongoDB.
# The app comes from the root Dockerfile's build stage (named context
# app-build), so the build steps live in one place. linux/amd64 and
# linux/arm64. Build it with docker/staging/compose.build.yaml.
# Guide: docs/runbooks/staging-container.md

# Node 24.22.2, the same version as the build stage. Digest pinned on
# 2026-11-11 (m1-068; licence and advisory check in the m1-068 report).
FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS assembled
COPY --from=app-build /app /app

# The running site needs no package manager: npm, corepack and yarn carry the
# image's fixable high findings (undici, brace-expansion; m1-068). The esbuild
# binaries are for the build only (D-SEC-8); esbuild's JavaScript stays,
# because the vite module still loads it.
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    /usr/local/bin/docker-entrypoint.sh \
    /app/node_modules/esbuild/bin /app/node_modules/@esbuild \
  && test -z "$(find /app/node_modules -type f -name esbuild)"

# The app runs as this user. The directories are copied into new volumes with
# this owner.
RUN useradd --system --uid 1001 --no-create-home --shell /usr/sbin/nologin assurer \
  && mkdir -p /app/data /app/public/uploads \
  && chown -R assurer:assurer /app/data /app/public/uploads
COPY docker/staging/app-env.sh /usr/local/lib/assurer/app-env.sh
COPY --chmod=755 docker/staging/app-entrypoint.sh /usr/local/bin/assurer-app
COPY --chmod=755 docker/staging/assurer-task.sh /usr/local/bin/assurer-task

# One layer, so the removed files are not left in the base image's layers
# (m1-056). Every setting the image needs is declared here.
FROM scratch
COPY --from=assembled / /
ARG APOS_RELEASE_ID=docker-local
WORKDIR /app
# No demonstration notice (lib/demo-site.js). Two web processes (m1-054).
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    NODE_ENV=production \
    APOS_RELEASE_ID=$APOS_RELEASE_ID \
    APOS_DEMO_SITE=0 \
    APOS_CLUSTER_PROCESSES=2 \
    PORT=3000 \
    ADDRESS=0.0.0.0
USER assurer
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.status === 200 ? 0 : 1), () => process.exit(1))"
ENTRYPOINT ["assurer-app"]
