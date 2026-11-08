# m1-055 — Staging image with PBM

| | |
|---|---|
| **Task** | m1-055 |
| **Date** | 2026-11-08 |
| **Scope** | Candidate 1 of the handoff: the staging version of the one-container image with PBM, nginx placement, certificate renewal, the number of cluster workers, a PBM runbook, and the hardening runbook §6 and §7 rewrite. Nothing deployed |
| **Prompt** | [2026-11-08-m1-055-staging-image.prompt.md](../../../prompts/2026/11/2026-11-08-m1-055-staging-image.prompt.md) |
| **Handoff** | [m1-055 start handoff](../../../../milestones/m1-055-handoff.md) · next: [m1-056 handoff](../../../../milestones/m1-056-handoff.md) |
| **Branch / commit** | `feat/m1-055-staging-image` from `origin/main` `74c3052`. Commit and push approved by the owner (D-GIT-53); merge not included |
| **Related** | ADR-0004 Decision 2 and 3 · D-DB-10 (b) · D-DB-12 · D-DB-15 (new) · D-SEC-5 · D-SEC-8 (new; direction A, not yet tried) · D-GIT-53 (new) |

All checks below are **agent-executed**. They are not human approval.

## Status

**Built and working on `linux/amd64` on the owner's PC, but not ready for a server yet.** Before any
server use: D-SEC-8 is worked through (4 critical and 30 high Go standard library findings; direction A, to be tried in m1-056), and the
items under "Not done or not verified" are closed, starting with `arm64` (the owner's rule that all
images support it is **not yet proven for this stack**).

## Approvals used

| What | Owner's words or choice |
|---|---|
| Task: staging image with PBM | "Staging image + PBM" |
| nginx in its own container; certbot container; MongoDB `requireTLS`; random first admin password in the secrets volume | The "(Recommended)" option on each question |
| PBM 2.17.0 in the image, the official `nginx` and `certbot/certbot` images, and running them on this PC on `127.0.0.1` under disposable names | "approve, go ahead with the build and local run" |

The agent treated the local check it had listed in the scope, including the PBM restore into a new,
empty, disposable container, as covered by that approval. No `apos-db-restore` was run, and no
shared database or the owner's other containers were touched.

## Change

- **`docker/staging/`** (new): `Dockerfile` (root image plus PBM, the demo entrypoint removed),
  `entrypoint.sh`, `mongod.conf`, `pbm-config.yaml`, `pbmc.sh`, `compose.yaml`, `nginx/`, `certbot/`.
  The demo `Dockerfile`, `compose.yaml` and `docker/entrypoint.sh` are unchanged.
- **Runbooks:** [staging container](../../../../runbooks/staging-container.md) (new),
  [PBM backup and restore](../../../../runbooks/pbm-backup-and-restore.md) (new),
  [hardening runbook](../../../../runbooks/server-hardening-and-patching.md) §6 and §7 rewritten, with
  §1, §8, §9 and §11 rows aligned.
- `.gitignore`, `.dockerignore`: `docker/staging/site.env`.

**Agent's defaults, adjustable and not owner decisions:** 2 web processes (the m1-054 suggestion);
1 GB MongoDB cache; `oplogSpanMin: 5` (m1-046 used 10; shorter so the 15-minute RPO has more room);
a base backup 2 minutes after each start and then every 24 hours; 8 days kept; nginx `32m` upload
limit, 30 requests a second with a burst of 60; a MongoDB server certificate of 825 days.

## Findings

1. **New decision, D-SEC-8 (direction A, not yet tried).** Docker Scout on the final images:

   | Image | Critical / high | Where | Fix |
   |---|---|---|---|
   | site | 4 / 30, Go stdlib 1.24.6 | `/usr/local/bin/gosu`, from the `mongo` base image | scanner lists fixed Go versions; needs a `gosu` rebuilt with one, or no `gosu` |
   | site | 4 / 30, Go stdlib 1.23.12 (the same CVEs) | `esbuild` in `node_modules`, a production dependency through `@apostrophecms/vite` (known since m1-048, never decided) | needs a newer `esbuild` upstream, or removing it from the final image |
   | site | 0 / 3 | PBM: D-SEC-5's `klauspost/compress`, `go-jose`, `x/net` | accepted until a fixed release; whether one exists now was **not checked** |
   | site | 0 / 7 | `js-yaml` 3.13.1 (3) and `x/net` 0.61.0 in MongoDB's tools and `apt` (base image); `async` 0.9.2 and 1.5.2 (app dependencies) | not investigated further |
   | nginx | 0 / 2 | `musl` (fixed 1.2.6-r6, not yet offered by the Alpine repository on 2026-11-08), `libxml2` (no fix) | wait, rescan |
   | certbot | 0 / 13 | `sqlite` 4, `binutils` 3 (no fix listed); `msgpack` 3, `urllib3` 2, `setuptools` 1. `pip list` shows newer `urllib3` and `setuptools`, and no `msgpack`, so these may be vendored copies; **not confirmed** | see Scout |

   Everything except D-SEC-5's three is already in the demo image's base or is unrelated to PBM: the
   base scan has 75 results, the final image 78. Neither `gosu` nor `esbuild` was in the process
   list of the running container (one reading), but **reachability of the CVEs was not analysed**,
   so this is no finding of safety.

2. **Critical CVE-2026-4738 in `zlib` 1.3.2 in the official nginx and certbot images.** Fixed here:
   both derived images require `zlib>=1.4-r0`, and both built with `zlib-1.4-r0`. Remove this when
   the official images ship it.
3. **Secure cookies cannot be tested over plain `http://localhost` in Chrome.** Chrome dropped the
   session and CSRF cookies, so login did not stick. Correct behaviour, but it shaped the browser
   check below.
4. **The self-signed certificate blocks browser testing through nginx.** The agent did not click
   through the warning or change the trust store.
5. **The site image grew to 2.59 GB** from a 1.97 GB base. The cause was not investigated.
6. **A container replaced within 2 minutes of its start takes no base backup**, because the schedule
   starts after 2 minutes. Seen during the test; PITR kept running. A deployment that restarts
   repeatedly could delay the base backup.

## Tests executed and actual results

Through nginx at `https://localhost:8443`, trusting the test certificate, on 2 web processes,
unless stated. Seeded demo content, `APOS_DEMO_SITE=1` and the admin password set to the `.env` test
value were applied **for the suites only**, because they check demo content. The "true staging"
rows ran before that.

| Check | Where | Result |
|---|---|---|
| `npm run lint` | host | **PASS** |
| `npm run test:smoke` | test stack | **PASS**, 18/18 |
| `npm run test:workflow` | test stack | **PASS**, 15/15 |
| `npm run test:persistence` after `docker restart` | test stack | **PASS**, 7/7 |
| Smoke, workflow, persistence | restored site, `:3044` | Workflow **PASS** 15/15, persistence **PASS** 7/7; smoke **17/18: FAIL** `demo notice rendered`, expected with `APOS_DEMO_SITE=0` on the drill |
| True staging: no demo notice or hero; `noindex`; HSTS 300; `Secure` cookies | test stack | **PASS** |
| True staging: `admin`/`admin` refused (400); random password logs in (200); five secret values absent from the site log | test stack | **PASS** |
| HTTP 301 keeps path and query; other host names closed on port 80 and refused at TLS | nginx | **PASS** |
| 34 MB upload | nginx | **PASS**, 413 |
| 150 concurrent requests | nginx | **PASS**, 75 passed and 75 got 429; 200 again after 3 s |
| Non-TLS, unauthenticated, untrusted CA | MongoDB | **PASS**, all refused |
| `assurerApp`: `admin.system.users`, another database, `createUser`, `$where` | MongoDB | **PASS**, all refused; its own database readable |
| Secrets permissions; CA key absent; process users `mongodb`, `pbm`, `assurer` | container | **PASS** |
| Kill one web process: 20 requests during it | container | **PASS**, no failure; replaced |
| Kill `pbm-agent` | container | **PASS**, restarted; site up |
| Base backup on schedule; PBM over TLS | container | **PASS**, 6–7 s, 71–108 KB |
| PITR restore to 11:46:30 from the 11:42 base backup; the 11:45 publish present | new, empty container | **PASS**, 60 s to a working site, demo-sized data |
| `certbot renew` (no certificates); deploy hook with a test certificate; `nginx -t` and reload | certbot, nginx | **PASS** |
| Accepted upload through nginx | nginx | **NOT VERIFIED**: the 5 MB upload call did not report an error, but the script failed on a doubled URL before printing it. The later download check printed `200, 0 bytes`, most likely `curl` failing to write to `/dev/null` (exit 23 elsewhere in the run), and the stack was removed in the same command |

`npm run test:unit` and `npm run test:ci` were not run: the change adds only Docker files and
documents, and memory was short at the end. The suites were not run on the local SQLite server, for
the same reason.

Memory, one reading, idle: site about 630 MiB, nginx 15 MiB, certbot 25 MiB, on a container with
little data. Load on this stack was not measured.

## Browser checks (agent-executed, Claude in Chrome)

Account `m1055-editor`, role `editor`, created with `@apostrophecms/user:add`; password outside the
repository, removed afterwards. Checks 2–5 ran on the staging image at `http://localhost:3045`,
published through a temporary override, **bypassing nginx with `APOS_HTTPS=0`** (see findings 3, 4).

| # | Check | Result |
|---|---|---|
| 1 | Editor in Chrome through nginx over HTTPS | **BLOCKED**, certificate warning not bypassed |
| 2 | Login through the UI; editor's admin bar | **PASS** |
| 3 | In-context edit of the hero headline; "Document saved" | **PASS** |
| 4 | Draft isolation: logged-out page and `?aposMode=draft` without the edit; draft API 403 | **PASS** (the logged-out checks ran with `curl`) |
| 5 | Publish through the UI; logged-out page shows it | **PASS** |
| 6 | Media upload in the UI | **NOT TESTED** |
| 7 | 1440, 768 and 375 px layouts | **NOT TESTED**; no template or layout changed |

## Clean-up

- Removed the test project's containers, networks and volumes (`down -v`, disposable, including the
  editor account and test content); confirmed none left. Temporary test files removed from the
  scratchpad, except the override files, which hold no secrets.
- **Left on the owner's PC:** images `assurer-site:staging-m1055test`,
  `assurer-site:staging-base-m1055test`, `assurer-nginx:staging-m1055test`,
  `assurer-certbot:staging-m1055test`, partial `arm64` images `assurer-nginx:staging-m1055arm64` and
  `assurer-certbot:staging-m1055arm64`, the pulled `nginx` and `certbot` images, and the running
  `buildx_buildkit_default` builder.

## Not done or not verified

- **`arm64`:** the build was stopped by Claude Code because the PC was critically low on memory
  (0.4 of 15.7 GB free afterwards), and was not restarted. Both base images list `arm64`.
- An accepted upload through nginx (above); Chrome through nginx.
- A real certificate, first issuance and renewal; any server, firewall or LUKS step.
- Backup removal by age; a failed backup's log line; RPO and RTO at real data sizes; off-site backups
  (S3, not approved); alerts.
- A load test on this stack, including MongoDB TLS's cost; 2 workers remain sized on m1-054's run
  without TLS, nginx or PBM.
- Trust of `X-Forwarded-For` from nginx only, end to end (unit tests cover the setting; a spoofed
  header was not tried); the secret rotation steps; x.509 for production.
- The `$S` runbook commands exactly as written (the test used its own project name, env file and
  ports). Whether PBM has a fixed release (D-SEC-5).
