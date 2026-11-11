# m1-068: release pipeline and one container per service (design)

| | |
|---|---|
| **Task** | m1-068 |
| **Date** | 2026-11-11 |
| **Author** | The agent (agent-executed; not a human approval) |
| **Status** | **D-DB-22 decided 2026-11-11 by the owner: approved with every recommended answer in §11** ("Approve all (Recommended)"). Built in m1-068 |
| **Related** | D-DB-20 · D-DB-21 · D-DB-4 · D-DB-12 · D-DB-15 · D-DB-17 · D-DB-19 · D-SEC-5 · D-SEC-8 · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) Decision 2 · [staging container runbook](../runbooks/staging-container.md) · [PBM runbook](../runbooks/pbm-backup-and-restore.md) · [m1-068 handoff](m1-068-handoff.md) |

This is a paper task. No server and no container were used. The facts about the stack come from
`docker/staging/` and `.github/workflows/` on `origin/main` (`528e4ef`).

## 1. The request and the limits

- **D-DB-21:** test locally and in CI, build the images in GitHub Actions, push them to `ghcr.io` as
  private packages, and pull them on the OCI server instead of building there.
- **D-DB-20:** every service in its own container, all in one Compose stack.
- **Limits:** every image supports `arm64`; everything runs through Docker Compose. No change to
  WordPress. No wipe of the OCI database. Commit, push and PR only with the owner's approval.

## 2. Summary

1. **Six long-running containers in one Compose project, `mimnets-cms`** (the owner's name, §11 question 2): `app`, `mongo`, `pbm`,
   `backup`, `nginx` and `certbot`. Two one-shot jobs run at each start: `setup` (secrets and
   certificates) and `cert-bootstrap`. Each container runs one process, as a non-root user where
   possible.
2. **Four images** on `ghcr.io/mimnets/`: `assurer-app`, `assurer-mongo`, `assurer-nginx` and
   `assurer-certbot`. Each image is for `amd64` and `arm64` and is tagged with the full commit SHA.
   The nginx and certbot images are today's images under new names.
3. **One new CI job, `release`**, in `ci.yml`. It runs on a push to `main` after the five checks
   pass. It builds on native runners (no emulation), starts the stack and runs short checks, then
   pushes. **A tag exists only for images that passed the checks.** It needs no new third-party
   action: it uses `docker buildx` and `docker login`, which the runners already have.
4. **The server stops building.** `bash docker/staging/deploy.sh [<commit>]` moves the clone to that
   commit, pulls the images, takes a PBM base backup, then runs `up -d`. Rolling back means running
   `deploy.sh` with the previous commit. A release restarts only the containers whose image changed:
   **an app release does not restart MongoDB.**
5. **On the OCI site, the switch is a fresh start on new volumes.** The old one-container stack is
   stopped. Its volumes are kept, not deleted, so this is not a wipe. The WordPress import is run
   again (§8).

## 3. The stack

```
 Internet ─► nginx ──edge──► app ──db (internal)──► mongo ◄── pbm ◄── backup
              ▲                                       (TLS, key file)
           certbot                 one-shot jobs before the start: setup, cert-bootstrap
```

| Service | Image | Process and user | Networks | Volumes | Host ports |
|---|---|---|---|---|---|
| `setup` (one-shot) | `assurer-mongo` | Writes any missing secret and the MongoDB TLS files, then exits; root | none | all `*-secrets` | none |
| `mongo` | `assurer-mongo` | `mongod`, `requireTLS`, key-file member authentication, replica set `rs0` with the member `mongo:27017`; user `mongodb` | `db` | `mongo-db`, `mongo-secrets` (read-only) | none |
| `pbm` | `assurer-mongo` | `pbm-agent`; user `pbm` | `db` | `pbm-backups`, `pbm-secrets` (read-only) | none |
| `backup` | `assurer-mongo` | The base-backup schedule and clean-up (today's `backup_loop`); user `pbm` | `db` | `pbm-secrets` (read-only) | none |
| `app` | `assurer-app` | Apostrophe in cluster mode (`APOS_CLUSTER_PROCESSES`, default 2); runs the migrations, then `node app`; user `assurer` | `db`, `edge` | `media` (uploads), `app-data`, `app-secrets` | none (IP mode: one port) |
| `cert-bootstrap` (one-shot) | `assurer-mongo` | A 30-day self-signed certificate if there is none, as today | none | `certs` | none |
| `nginx` | `assurer-nginx` | As today | `edge` (fixed IP, the only trusted proxy) | `certs`, `acme-webroot` | 80, 443 (NPM mode: none) |
| `certbot` | `assurer-certbot` | As today | default | `certs`, `acme-webroot` | none |

**Networks.** `edge` connects nginx and the app, as today. `db` is `internal: true`, so it has no
route out. Only the app, MongoDB and the two PBM services are on it. MongoDB never publishes a port.

**Secrets: one volume per service.** Today every secret is in one volume, inside the one container.
After the split, each container gets only what it needs:

| Volume | Holds | Mounted in |
|---|---|---|
| `mongo-secrets` | key file, server certificate and key, CA certificate, the three database user passwords (MongoDB creates the users at its first start) | `mongo` |
| `app-secrets` | the app's database password, the session secret, the CA certificate | `app` |
| `pbm-secrets` | the PBM user's password, the CA certificate | `pbm`, `backup` |

The site administrator password stays in `mongo-secrets` only. The first admin password for
Apostrophe is written to `app-data`, so that the owner can read it and then delete it, as today.

**Start order** (`depends_on`):

1. `setup` must complete.
2. `mongo` must be **healthy**: it is the writable primary, which happens only after its first-start
   initialisation.
3. Then `app` and `pbm` start.
4. `backup` starts after `pbm`.
5. `nginx` starts after `cert-bootstrap` completes. It does not wait for the app, as today.

**Health checks:**

| Container | Health check |
|---|---|
| `mongo` | `db.hello().isWritablePrimary` over TLS |
| `app` | `GET /` returns 200, as today |
| `pbm` | The agent process is running. `pbmc status` stays a deploy-time check, because running it every 30 s would be heavy |
| `nginx` | As today |

Every long-running service has `restart: unless-stopped`.

**Limits** (memory). Each limit is a setting in `docker/staging/.env`, so it can be fitted to the
server:

| Service | Default limit |
|---|---|
| `mongo` | `2g` (cache 1 GB, as today) |
| `app` | `2g` (2 workers; m1-054 measured about 0.6 GiB per worker) |
| `pbm` | `1g` |
| `backup` | `256m` |
| `nginx` | `256m` |
| `certbot` | `256m` |

Also `stop_grace_period: 60s` on `mongo` and `app`, as today.

**MongoDB across containers.** Today `bindIp` is `127.0.0.1`, the replica set member is
`127.0.0.1:27017` and the certificate is for `127.0.0.1`. After the split:

- `mongod` listens on its container's address on the `db` network.
- The member is `mongo:27017`.
- The certificate names `mongo` and `localhost`.
- `requireTLS`, the key file and `javascriptEnabled: false` do not change.

x.509 member authentication is still a production item (runbook §9.2), as before. The first user is
still created through MongoDB's localhost exception, inside the `mongo` container. The certificate
lasts 825 days. When fewer than 30 days are left, `setup` writes a new certificate at the next start.
MongoDB 8.0 then loads it with `rotateCertificates`, without a restart.

## 4. What moves where

The 287-line `entrypoint.sh` does seven jobs in one process tree. Each job goes to the container that
owns it, and the old file is removed:

| Today (one container) | After the split |
|---|---|
| `ensure_secret`, `ensure_tls` | `setup` job (`docker/staging/setup.sh`) |
| Start `mongod`; `init_database`; `ensure_pbm_user` | `mongo` entrypoint (`mongo-entrypoint.sh`). It checks the database itself (is the replica set initiated? does the user exist?), not the `.database-ready` marker file. Marker files can disagree with the data after a restore |
| `agent_loop` | `pbm` container: `pbm-agent` is the process, and Docker restarts it |
| PBM configuration (`.pbm-configured`) and `backup_loop` | `backup` container (`backup-schedule.sh`) |
| Migrations, first admin, `node app` | `app` entrypoint (`app-entrypoint.sh`). It builds `APOS_DB_URI` for `mongo:27017` from `app-secrets`, runs `@apostrophecms/migration:migrate`, then `exec node app` |
| `ASSURER_MODE=restore` | Removed. The restore drill gets its own services (below) |
| `run-as.sh` (`setpriv`) | Not needed by `app`, `pbm` or `backup`: they start as their own user. Only `mongo` keeps it, to take ownership of its volume first |

**Commands for the owner:**

- `assurer-task` moves to the `app` container: `$S exec app assurer-task <task>` (runbook §4.1).
- `pbmc` moves to the `pbm` container: `$S exec pbm pbmc status`.
- The first admin password: `$S exec app cat /app/data/admin-initial-password`.

**Restore drill** (PBM runbook §3, and the CI drill in `staging-arm64.yml`). The `restore` profile
gets `restore-mongo`, `restore-pbm` and `restore-app`, on their own internal network. On that network
`restore-mongo` has the alias `mongo`, so the same addresses and certificate work. `restore-copy`
copies the secrets, media and backups into the restore volumes, as today. The restored app answers
on `127.0.0.1:3044` only, as today.

## 5. The images

| Image | Built from | Notes |
|---|---|---|
| `assurer-app` | The root `Dockerfile`'s `build` stage (`npm ci`, `npm run build`, prune), copied onto **`node:24-bookworm-slim`**, digest pinned | **New base image: gate** (§9). The image holds no MongoDB, `gosu`, `js-yaml` or `apt` fix, so most D-SEC-8 work is no longer needed for it. The esbuild binaries are still removed |
| `assurer-mongo` | `mongo:8.0.34`, the digest pinned today, plus PBM 2.17.0 from today's pinned `.deb`, today's `apt` upgrade, `gosu`, `js-yaml` and the base entrypoint removed, and our scripts and configuration | No new download. A thin layer on the official image rather than the image as it is, because the official entrypoint cannot set up a TLS replica set with a key file, and it brings back the D-SEC-8 findings that `gosu` and `js-yaml` caused. Still one layer (m1-056) |
| `assurer-nginx` | Today's `nginx/Dockerfile` | No change except the name |
| `assurer-certbot` | Today's `certbot/Dockerfile` | No change except the name |

The demonstration image (root `Dockerfile`, root `compose.yaml`, D-DB-11) stays as it is. The staging
build only uses its `build` stage.

`compose.yaml` names each image as `ghcr.io/mimnets/assurer-<name>:${ASSURER_IMAGE_TAG}`, with no
`build:` sections, so the server cannot build by mistake. A new `compose.build.yaml` adds the
`build:` sections for local and CI builds:

```sh
docker compose -f docker/staging/compose.yaml -f docker/staging/compose.build.yaml build
```

## 6. The release job

A `release` job in `ci.yml`:

```yaml
needs: [lint, build, test, secrets, audit]
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
permissions: { contents: read, packages: write }   # this job only; the workflow stays read-only
```

1. **Two parallel runs:** `amd64` on `ubuntu-24.04` and `arm64` on `ubuntu-22.04-arm`. The `arm64`
   runner is the one already used in `staging-arm64.yml`, because of the kernel limit, D-DB-16. Each
   run builds the four images natively, with `APOS_RELEASE_ID` set to the commit.
2. **Short checks on each architecture**, before anything is pushed:
   - the stack becomes healthy;
   - HTTP redirects to HTTPS and HTTPS returns 200 through nginx;
   - `pbmc status` shows the agent running.

   The full drill (upload, PITR restore) stays in `staging-arm64.yml` on pull requests that change
   the stack.
3. **Push by digest.** Each run logs in with `GITHUB_TOKEN` and pushes its images by digest only,
   with no tag. A final step joins the two digests into one image for both architectures, tagged
   with the commit SHA (`docker buildx imagetools create`). If any check fails, no tag is written.
4. **No `latest` tag.** The server always names a commit.

**Private packages.** On GitHub a new package is private by default. The job never changes that. The
owner checks the visibility on the package page after the first run.

**Repository settings: probably no change.** A job that asks for `packages: write` gets it even when
the repository's default token is read-only. If an account policy blocks it, the first run fails at
the login step, and the setting goes to the owner as a gate.

**Storage: a fact to check before the first push.** Each release adds layers for four images and
two architectures. The `mongo` layers repeat, so they are stored once; the app layers change each
release. GitHub's storage and transfer allowance for private packages depends on the account plan,
and GitHub has changed its Container registry billing before. **The owner checks the current terms
for the account before the first push.** Proposal: keep the last 10 commit tags and remove older
ones by hand from the package page. Automating the removal can come later.

## 7. The server side

**`deploy.sh`** is a new script. It prints its next steps, like `ip-setup.sh`. It is safe to run
again, and it runs as root in the clone:

```sh
bash docker/staging/deploy.sh             # the newest commit on origin/main
bash docker/staging/deploy.sh 1a2b3c4     # a given commit (also the rollback)
```

1. It runs `git fetch`, then moves the clone to the commit (detached). The Compose files and scripts
   then always match the images.
2. It writes `ASSURER_IMAGE_TAG=<full SHA>` to `.env`, and keeps the old value as
   `ASSURER_PREVIOUS_TAG`.
3. It runs `$S pull`. If the tag does not exist, it stops: CI did not pass, or did not finish.
4. If the stack is running, it runs `pbmc backup --wait`. This gives a base backup from just before
   the release (D-DB-4).
5. It runs `$S up -d`, which recreates only the containers whose image or settings changed.
6. It waits until the app is healthy and `pbmc status` shows the agent running.
7. It prints the image digests and the rollback command.

The mode does not change. IP, NPM and standalone mode stay as `ip-setup.sh`, `npm-setup.sh` and
`install.sh` set them. Those scripts call `deploy.sh` instead of `build`.

**Rollback** is `deploy.sh <ASSURER_PREVIOUS_TAG>`. **Limit: Apostrophe migrations only go
forward.** If the bad release ran a new migration, the older code meets data it did not write. Rule:

- The release notes (the PR) say when a migration is new.
- Rolling back across a release with a new migration also needs a PITR restore to the backup from
  step 4 (PBM runbook §4).
- `deploy.sh` prints this warning on every rollback.

**Pull token.** The owner creates a GitHub token that can only read packages. At the time of writing,
GitHub's documentation says the registry accepts only a *classic* personal access token: scope
`read:packages` only, with an expiry date (proposal: one year, with a reminder). The owner signs in
once, on the server:

```sh
docker login ghcr.io -u <github user> --password-stdin
```

Docker keeps the token in `/root/.docker/config.json`, mode `0600`. That is the same protection as
`.env`. The token never goes into the clone, a script, a log or this repository. Replacing the token
means signing in again.

## 8. Switching the OCI site

The compose project name changes from `assurer-staging` to **`mimnets-cms`**. The OCI install is
production, so it should not carry a "staging" name. With a new project name, every new volume gets
a new name (`mimnets-cms_mongo-db` and so on). **Nothing old is reused or deleted.** (The agent first
proposed `assurer`, but the demonstration stack, D-DB-11, already uses that name and a volume called
`app-data`; the owner then chose `mimnets-cms`.)

1. In the old stack: `exec site pbmc backup --wait`, as an extra fallback.
2. `deploy.sh --switch-from assurer-staging` stops the old stack. It does not remove its volumes.
   Port 8090 is then free.
3. `deploy.sh` starts the new stack. `ip-setup.sh` keeps the IP-mode port.
4. A new admin password. Then the WordPress import again: a dry run, then `--execute` (runbook §4.1).
5. The old volumes stay as the fallback. Removing them is a later step, needs the owner's own
   approval, and comes after the new site is checked.

**Data:** D-CONTENT-17 wipes the OCI database before the final import anyway, and the import is
automated. A fresh start therefore needs no data migration. **If the owner has edited content by
hand on the OCI site**, those edits would not come across. The alternative is to move the data with
a PBM backup and restore from the old stack into the new one. That costs about half a day more, and
it proves a restore across the two layouts. Question 3 below.

## 9. Changes, gates and proof

**Files:**

| File | Change |
|---|---|
| `docker/staging/compose.yaml` | Rewritten: the services, networks and volumes of §3; images from `ghcr.io` |
| `docker/staging/compose.build.yaml` | New: the `build:` sections |
| `docker/staging/compose.ip.yaml`, `compose.npm.yaml` | `site` becomes `app`; the rest is the same |
| `docker/staging/app/Dockerfile`, `docker/staging/mongo/Dockerfile` | New, in place of `docker/staging/Dockerfile` |
| `docker/staging/setup.sh`, `mongo-entrypoint.sh`, `app-entrypoint.sh`, `backup-schedule.sh`, `deploy.sh` | New, in place of `entrypoint.sh` |
| `docker/staging/assurer-task.sh`, `pbmc.sh`, `mongod.conf` | Host `mongo`; secret paths |
| `docker/staging/ip-setup.sh`, `npm-setup.sh`, `install.sh` | `deploy.sh` instead of `build`; `site` becomes `app`; container names; project `mimnets-cms` |
| `.github/workflows/ci.yml` | The `release` job |
| `.github/workflows/staging-arm64.yml` | The split stack and the new restore services |
| Staging container runbook, PBM runbook | §1 layout, §3, §4, §4.1, §11, the new deploy and rollback section; PBM §2 and §3 |
| ADR-0004 | Amendment to Decision 2 (gate) |
| Decision register, INDEX, report, m1-069 handoff | Records |

**Gates, in the order they come:**

1. **This design** (questions 1 to 4 below).
2. **The ADR-0004 amendment** (architecture gate). The agent drafts it with the build and asks for
   acceptance before the commit.
3. **Licence and advisory check for `node:24-bookworm-slim`** (new base image). No new action and no
   other new image are needed.
4. **Commit, push and PR**, then the first release run on `main`. The owner checks that the packages
   are private and checks the storage terms (§6).
5. **The pull token on the server and the switch (§8)**. The owner runs these steps.

**Proof before the PR:**

- A local Compose run on `amd64` from `compose.build.yaml`, in IP mode and in standalone mode.
- A PBM backup and PITR restore with the new restore services.
- The four suites against the split stack.
- `staging-arm64.yml` on the PR (the hosted `arm64` run, with its restore drill).
- The Chrome checks as an editor who is not an administrator, at 1440, 768 and 375 px.
- The implicit state review (STANDARDS.md).

The `release` job itself can only be shown working after the merge, on `main`.

## 10. Risks

| Risk | Mitigation |
|---|---|
| The images on the server and the files in the clone do not match | `deploy.sh` moves the clone to the same commit as the tag |
| A rollback across a migration | The warning, and a PITR restore to the backup taken before the deploy (§7) |
| GitHub storage or transfer costs for private packages | Check before the first push; keep 10 tags |
| A leaked pull token | It can only read packages, it expires, and it is in a root-only file |
| MongoDB now listens on a network, not on loopback | An internal network, no port, TLS required, member authentication |
| Release builds take longer on `main` | Native runners, in parallel. No build cache at first, to keep the setup simple; a registry cache can come later |

## 11. Questions for the owner

1. **Approve this design** as written? (Recommended)
2. **The project name `assurer`** in place of `assurer-staging`, so every volume is new and nothing
   old is touched? (Recommended. Changed after approval to `mimnets-cms`, because the demonstration
   stack already uses `assurer`.)
3. **The data on the OCI site:** a fresh start and the import again (Recommended), or move it with a
   PBM backup and restore (about half a day more)?
4. **`node:24-bookworm-slim` as the app's base image**, subject to the licence and advisory check?
   (Recommended. The alternative is the full `node:24-bookworm` already pinned: no new image, but
   much larger and with more findings.)

## 12. Changes during the build (m1-068)

Found while building; none changes the approved design's intent.

| Point | Design said | Built | Why |
|---|---|---|---|
| Project name | `assurer` | `mimnets-cms` | The demonstration stack already uses `assurer` and a volume called `app-data`; the owner chose the name |
| `pbm` health check | the agent process is running | none: `pbm-agent` is the container's main process, so Docker restarts the container when it stops | A process check on the main process adds nothing |
| Tags | push by digest only | each architecture is pushed as `<sha>-amd64` and `<sha>-arm64` after its checks; `release-tag` then writes `<sha>` from both | `docker push` needs a tag; no extra tool or action. The server pulls only `<sha>`, which exists only when both passed |
| `amd64` runner | `ubuntu-24.04` | `ubuntu-22.04` | MongoDB 8.0.34 refuses some newer kernels (D-DB-16); the runner's kernel may move |
| `edge` subnet | as today, `172.30.55.0/24` | `172.30.57.0/24` (`ASSURER_EDGE_SUBNET`) | The one-container stack's network keeps `172.30.55.0/24` while its stopped containers exist, so the new stack could not create its own |
| Mode for `deploy.sh` | the mode as set by the scripts | `ASSURER_PROXY_MODE` (`ip`, `npm`, `standalone`) in `.env`, written by all three setup scripts; `deploy.sh` stops if it is missing | Before, IP mode left `ASSURER_UPSTREAM_PROXY_IP` in `.env`, so the route could not be inferred safely |
| First admin password | — | written with a newline | `user:add` waits for a whole line |
| nginx and certbot images | unchanged apart from the name | flattened into layers of our own, like app and mongo; pushes tried up to 3 times | The first release push failed at nginx with `unknown blob` after app and mongo went through (report, follow-up) |
