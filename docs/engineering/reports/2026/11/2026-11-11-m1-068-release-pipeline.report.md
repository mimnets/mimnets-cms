# m1-068 — Release pipeline and one container per service

| | |
|---|---|
| **Task** | m1-068 (the item of the [m1-068 handoff](../../../../milestones/m1-068-handoff.md)) |
| **Date** | 2026-11-11 |
| **Scope** | Design note, then the stack split into one container per service in one Compose stack (D-DB-20), images built in CI and pulled from `ghcr.io` (D-DB-21), `deploy.sh` with rollback, the scripts and runbooks, local tests on `amd64`. Server steps are the owner's |
| **Prompt** | [2026-11-11-m1-068-release-pipeline.prompt.md](../../../prompts/2026/11/2026-11-11-m1-068-release-pipeline.prompt.md) |
| **Design** | [m1-068 design note](../../../../milestones/m1-068-release-pipeline-design.md) (approved, D-DB-22; changes while building in its §12) |
| **Branch / commits** | `feat/m1-068-release-pipeline` from `origin/main` (`528e4ef`); one commit, pushed with the owner's approval (D-GIT-72) |

Checks marked agent-executed were run by the agent. They are not human approval.

## Decisions in this task

| ID | Decision | By |
|---|---|---|
| D-DB-22 | Design approved with every recommended answer: fresh start on the OCI site with the import run again, old volumes kept; `node:24-bookworm-slim` for the app after the check | Owner ("Approve all (Recommended)") |
| D-DB-22 | Compose project name `mimnets-cms` (the demo stack already uses `assurer`) | Owner ("mimnets-cms") |
| D-DB-23 | ADR-0004 Amendment 1 accepted: Decision 2, one container per service | Owner ("Accept (Recommended)") |
| D-SEC-10 | High findings in the app image's Debian base: accepted until fixed, rescan at each base update | Owner ("Accept until fixed (Recommended)") |

## What was built

- **Images.** `docker/staging/mongo/Dockerfile`: the pinned official `mongo:8.0.34` image with PBM
  2.17.0 (the same pinned `.deb`), the `apt` fix, without `gosu`, `js-yaml` and the base
  entrypoint, in one layer. `docker/staging/app/Dockerfile`: the root `Dockerfile`'s build stage on
  `node:24-bookworm-slim` (digest pinned, Node 24.22.2 as the build), without npm, corepack, yarn or
  esbuild's binaries, as the `assurer` user, in one layer. nginx and certbot unchanged apart from
  the image name. The old `docker/staging/Dockerfile` and `entrypoint.sh` are removed.
- **Services** (`compose.yaml`, project `mimnets-cms`): `setup` (one-shot secrets and TLS),
  `mongo`, `pbm`, `backup`, `app`, `cert-bootstrap`, `nginx`, `certbot`; the `restore` and
  `restore-site` profiles for the drill. Internal `db` network; one secrets volume per service,
  mounted read-only; memory limits as settings; health checks on `mongo` and `app`.
- **Scripts.** `setup.sh`, `mongo-entrypoint.sh`, `mongo-health.sh`, `app-entrypoint.sh`,
  `app-env.sh`, `pbm-agent.sh`, `pbm-env.sh`, `backup-schedule.sh`; `assurer-task` and `pbmc` use
  the shared env files. `deploy.sh`: pull a commit's images, back up, start, check, roll back.
  `ip-setup.sh`, `npm-setup.sh` and `install.sh` call `deploy.sh --here` instead of building, and
  write `ASSURER_PROXY_MODE`.
- **CI.** `ci.yml`: `release` (per architecture: build, start, check, push `<sha>-<arch>`) and
  `release-tag` (writes `<sha>` from both), on a push to `main` after the five checks, with
  `packages: write` for those jobs only and the run's own token. `staging-arm64.yml` updated for the
  split stack and the new restore services.
- **Docs.** Staging container runbook (§1 to §8, §9 to §11 commands, new §12: releases, the pull
  token, rollback, the switch from one container), PBM runbook (§1 to §6), hardening runbook (§1,
  §6), ADR-0004 Amendment 1 (proposed), the decision register.

## Results (agent-executed, owner's PC, `linux/amd64`, Docker Desktop, stack on `127.0.0.1`)

| Check | Result |
|---|---|
| Base image check: `node:24-bookworm-slim` (official Node image, MIT; Debian packages as in the current bases), `amd64` and `arm64`, 333 MB against 2.05 GB | 0 critical, 13 high as published; the 6 fixable ones are in npm, which the image removes |
| `npm run lint` | PASS |
| `npm run test:smoke` | PASS, 18/18 (through nginx over HTTPS, demo content seeded and `APOS_DEMO_SITE=1` for the test only, as in m1-055) |
| `npm run test:workflow` | PASS, 15/15 (same) |
| `npm run test:persistence` | PASS, 7/7, after restarting `mongo`, then the app, `pbm` and `backup` |
| First start: secrets, replica set `mongo:27017`, users, PBM configured, first base backup, app healthy | PASS |
| No demo notice, `noindex`; `admin`/`admin` 400; random password 200; none of five secret values in any log; no CA key; each secrets volume owned by its service, mode 0700 | PASS |
| HTTP 301 to HTTPS; HTTPS 200 with HSTS; 413 at 34 MB; 194 of 300 parallel requests 429; `pbmc status` OK | PASS |
| MongoDB: non-TLS refused, unauthenticated `listDatabases` refused, no published port, `db` internal; `mongod` runs as `mongodb` | PASS |
| App recreated: MongoDB not restarted; web worker killed: respawned, 0 of 20 requests failed; `pbm-agent` exits: Docker restarts it, agent OK | PASS |
| PITR restore drill with the restore services: page published at 10:57:45 after the newest base backup (10:57:28), restored to 10:58:23; the page and a 1 MB upload (SHA-256 identical) are back; 35 s from the copy to a working site | PASS |
| `deploy.sh` guards: kernel (with a stub), no `.env`, no route, local changes, unknown commit, commit not on `main`, older commit without `--rollback`; with `--rollback`, a failed pull leaves the clone on `main` and `.env` unchanged | PASS (throwaway clone, no commit) |
| Docker Scout, critical and high: `assurer-app` 0/9, `assurer-mongo` 0/4, `assurer-nginx` 0/1, `assurer-certbot` 0/13 | No critical. App: 7 Debian highs without a fix (D-SEC-10) and the known `async` pair. Mongo: D-SEC-5 and `x/net`, known. nginx and certbot as before |

## Browser checks (Chrome, agent-executed)

Disposable editor `m1068-editor` (role editor, not an administrator), through nginx over HTTPS on
`https://localhost`. The owner clicked through Chrome's certificate warning, which the extension
cannot operate.

| Check | Result |
|---|---|
| Login as the editor | PASS |
| In-context edit of the home hero headline; "Document saved" | PASS |
| Draft hidden: logged-out `curl` of `/` and `/?aposMode=draft` do not contain the change | PASS |
| Publish with **Update**: "Your changes have been published"; logged-out `curl` shows it | PASS |
| Image upload in **Media → Images** (1600×900 PNG) | PASS |
| Session kept after the app container was recreated | PASS |
| Logged-out request to the user API: `notfound`, no user data | PASS |
| Desktop, tablet, mobile layouts | NOT REQUIRED (no template or layout change) |

## Implicit state review

| State | Where | Decision | Reason |
|---|---|---|---|
| Database set up (replica set, admin, app and PBM users) | `mongo-entrypoint.sh` | **Made explicit, derived from the database** | Was the `.database-ready` marker file, which could disagree with the data after a restore. Now each start asks MongoDB (`setName`, a login, `getUser`) and adds what is missing |
| PBM configured | `backup-schedule.sh` | **Derived from the database** | Was `.pbm-configured`; a new or restored database is now configured again by itself |
| MongoDB ready for clients | `mongo-health.sh` | Explicit, per container life | Health needs the entrypoint's "ready" mark (in `/tmp`, gone at each restart) and a writable primary, so the app never meets a database without its user |
| Secrets: source and copies | `setup.sh` | One source | `mongo-secrets` is the source; the app and PBM copies are rewritten when they differ |
| MongoDB certificate loaded versus on disk | `setup.sh`, `deploy.sh` | Made observable | `tls/serial` against what MongoDB loaded; `deploy.sh` restarts MongoDB and its clients when they differ |
| Route of a server (IP, NPM, standalone) | `.env` `ASSURER_PROXY_MODE` | **Made explicit** | Before, `install.sh` inferred it, and IP mode leaves `ASSURER_UPSTREAM_PROXY_IP` in `.env`, so the guess could be wrong. All setup scripts write it; `deploy.sh` stops without it |
| Release: clone, images and `.env` | `deploy.sh` | One transition | The clone moves to the commit before the pull; a failed pull moves it back and leaves `.env` alone; the tag is written only after the pull |
| Going back a release | `deploy.sh` | Explicit flag | An older commit needs `--rollback` and prints the migration warning |
| One-container stack still running | `deploy.sh` | Explicit flag | Needs `--switch-from-one-container`; backs up, then stops it, volumes kept |
| First admin created | `app-data/.admin-ready` | Kept as a marker | Apostrophe has no read-only command to list users; the restore app skips it with `ASSURER_CREATE_ADMIN=0` |
| Clone detached after a deploy | runbook §12 | Documented | `deploy.sh` moves the clone; `git pull` is not needed |

## For the owner

1. ADR-0004 Amendment 1: accepted (D-DB-23).
2. D-SEC-10: accepted until fixed.
3. **Before the merge:** check GitHub's current storage terms for private packages on the account
   (design §6).
4. **Approve commit and push**; you open and merge the PR. CI's `staging-arm64` runs on the PR; the
   `release` jobs run on the merge to `main`. After that run: check that the four packages are
   private (GitHub → your profile → Packages).
5. **On the server** (your steps, runbook §12.1 and §12.3): the read-only token and
   `docker login ghcr.io`; then `git pull` and
   `bash docker/staging/ip-setup.sh <public-ip> 8090 --switch-from-one-container`; new admin password;
   the WordPress import again.

## Not done or not verified

- `deploy.sh` pulling from `ghcr.io` and starting; the setup scripts through it; the `release` and
  `release-tag` jobs; GitHub's package permission. All need the first release on `main`.
- The split stack on `arm64`: `staging-arm64.yml` runs it on the PR.
- A MongoDB certificate renewal (825 days) end to end: only the "unchanged" path ran.
- The switch from the one-container stack (§12.3): no such stack was running locally.
- The real-recovery path of the PBM runbook §4 (written, not rehearsed).

## Left over

- Local Docker project `mimnets-cms` (images `ghcr.io/mimnets/assurer-*:local`,
  `assurer-app-build:local`), removed with its volumes by the agent at the end of the task; the
  images stay until removed (`docker image rm`).
- The disposable editor `m1068-editor` existed only in that local database.
- Scratch files outside the repository: drill scripts, the editor password, a `uname` stub.
- `m1-067-test_edge` network and the `m1-067-test` project from m1-067: not touched.

## Follow-up: the first release push (2026-11-11, branch `fix/m1-068-ghcr-push`)

The first `release` run on `main` (merge `44ffb1b`, PR #81) built and checked the stack on `arm64`,
logged in to `ghcr.io` and pushed `assurer-app` and `assurer-mongo` (tag `<sha>-arm64`), then
stopped at `assurer-nginx` with `unknown blob`. The `amd64` job was cancelled with it, and
`release-tag` did not run, so no `<sha>` tag exists and nothing can be deployed from that run. The
`staging-arm64` run on the PR built, saved and ran the same images, so they were complete on the
runner. The two images that went through are single layers of our own; nginx and certbot kept the
official images' layers.

Fix (the owner chose "Flatten + retry"): nginx and certbot are flattened like app and mongo, with
the base images' settings declared again (environment, entrypoint, command, stop signal, working
directory, ports, volumes), and each push is tried up to 3 times.

| Check (agent-executed, owner's PC, `amd64`) | Result |
|---|---|
| nginx: 1 layer; entrypoint, command, `SIGQUIT` as the base; `/docker-entrypoint.d` scripts run; `nginx -t`; reload; stop exits 0; start again 200 | PASS |
| Through the stack: 301 to HTTPS, 200 with HSTS, 413 at 34 MB, 201 of 300 parallel requests 429, other host name refused (HTTP: connection closed; HTTPS with its SNI: handshake rejected) | PASS |
| certbot: 2 layers of our own; `certbot --version` 5.9.0; `certbot renew` with no certificate | PASS |
| Docker Scout: nginx 0 critical, 1 high; certbot 0 critical, 13 high | Unchanged |
| The push to `ghcr.io` | NOT TESTED: runs on the merge to `main` |

## End of day (2026-11-11, 13:00 UTC)

- The release run for `ea9c81d` passed: all four images on `ghcr.io` for `amd64` and `arm64`, tag
  `ea9c81df00dd3d227fa42d8b8c63adba45cf6d58`. Runbook §12.3 fixed (PR #83, D-GIT-74).
- **The PITR restore drill hangs on `arm64` in CI**: both `staging-arm64` PR runs stayed in "PITR
  restore into new, empty containers" (from 12:30 and 12:52 UTC). Cause not known; the next task
  ([m1-069 handoff](../../../../milestones/m1-069-handoff.md)).
- The server switch (runbook §12.3) had not been reported as run.

