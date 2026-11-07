# m1-048 results: local proof of concept for SQLite with Litestream

| | |
|---|---|
| **Status** | Agent-executed test, 2026-11-07, on the owner's Windows PC (Docker Desktop, `linux/amd64` native; `linux/arm64` under emulation). Local and disposable: replicas in a local directory (`file://`), no account, no spending, no server. **Not a human approval.** Owner's decisions on the results: §6 |
| **Tests** | P1–P7 from the [m1-047 options paper §7](./m1-047-sqlite-production-options.md#7-proposed-proof-of-concept-needs-separate-approval), with the settings checks of §4.5 |
| **Files** | [`docker/litestream-poc/`](../../docker/litestream-poc/): `Dockerfile`, `compose.yaml`, `entrypoint.sh`, `litestream.yml`. The demo image files are unchanged |
| **Related** | D-DB-4 · D-DB-13 · D-SEC-5 · [m1-048 report](../engineering/reports/2026/11/2026-11-07-m1-048-litestream-poc.report.md) |

## 1. Summary

Litestream 0.5.18 replicated the app's SQLite file continuously, survived `kill -9` of the app and of
itself with no gap, and a point-in-time restore into a new, empty container brought back the right
moment. All suites passed on the restored site. Replication lag was about half a second.

Four results matter for D-DB-13:

1. **`apos-db-dump` fails on a database that Litestream replicates** (§3.1). Litestream adds two
   tables, and the dump tool stops at the first one with exit code 1. The portable dumps that D-DB-4
   asks for (at each release and monthly) do not work as they are.
2. **Page loads slow down sharply with about 1,000 pages** (§3.2). The cause is the SQLite adapter's
   queries (no index can be used) together with the two-level main menu. Litestream is not the cause:
   pausing it changed nothing.
3. **Litestream adds the same three high findings that PBM had** (§3.3): the Go libraries of D-SEC-5,
   in older versions. No fixed Litestream release exists yet.
4. **Media is not in Litestream** (§3.4). The restored site had its content but no uploaded files, as
   expected; the media backup (D-DB-4, 24-hour RPO) is a separate job.

## 2. Results

| # | Check | Pass when (paper §7) | Actual result | Status |
|---|---|---|---|---|
| P1 | App on SQLite with Litestream to a local directory; lint and suites | All pass; lag in seconds | Lint clean; smoke 18/18; workflow 15/15; persistence 7/7 (source site, `amd64`). Lag from the HTTP response of a save to its new LTX file in the replica, 20 saves: min 0.35 s, median 0.47 s, max 1.49 s | PASS |
| P2 | Writes, then `kill -9` of the app and of Litestream, restart | No error; replication resumes with no gap | During a 300-save burst: `kill -9` of `node app` at 16:06:45Z, the container restarted and the site answered 200 after 4 s; `kill -9` of Litestream at 16:06:59Z, the same, 200 after 3 s. LTX transaction IDs continue with no gap (…`2c`, then `2d`–`47`). No warning or error in Litestream's log. A restore of the latest replica matches the live file in all 14 tables (row counts and a hash of every row), integrity check `ok` | PASS |
| P3 | `litestream restore -timestamp` between two edits, into a new path | First edit there, second not; integrity ok; all suites pass | First edit 16:07:36Z, target 16:07:42Z, second edit 16:07:49Z. Restore into a new container with new, empty volumes; HTTP 200 after 8 s (restore, migrations, start). The first edit is there and the second is not. Integrity `ok`. Smoke 17/18 on the first run, then 13/18 on a rerun, all failures HTTP 429 from the form rate limit (§3.5); after `assurer-security:clear-form-rate-limit`, 18/18. Workflow 15/15; container restart, then persistence 7/7 | PASS (see §3.5) |
| P4 | WAL and checkpoints under 500 saves, and during `apos-db-dump` / `apos-db-restore` | WAL bounded; no missed frames; no "database is locked" | 500 saves in 10.0 s, 0 errors. WAL file at most 15.9 MB (82 samples, every 0.25 s) and stays at that size afterwards (no `journal_size_limit`, as paper §4.5 expected); Litestream's `litestream_wal_size` metric read 4,152 bytes just after the burst (14 passive checkpoints by then; what the metric counts was not checked); 0 sync errors; no lock or missed-frame message. A latest-replica restore matches the live file in all 14 tables. **`apos-db-dump` fails** (§3.1). `apos-db-restore` of that dump into a new, empty file that Litestream also replicates: 5.4 s, no error; its replica matches the file | PASS for Litestream; **finding** for `apos-db-dump` |
| P5 | A `node app …` write task while the app runs | No lock errors | During a 300-save burst (5.4 s, 0 errors): `@apostrophecms/user:add` (3.9 s, exit 0) and `@apostrophecms/migration:migrate` (exit 0). No "database is locked" anywhere. A task needs `APOS_SESSION_SECRET` in its own environment (§3.5) | PASS |
| P6 | Event-loop delay with about 1,000 pages | Recorded; p99 below an agreed limit | See §3.2. 60 s, 8 parallel readers and one save a second: 169 page requests, 0 errors; HTTP median 2.95 s, p99 5.15 s; event-loop delay median 10 ms, **p99 1,520 ms, max 1,902 ms**; only 6 of about 60 saves completed. No limit has been agreed | Recorded; **finding** |
| P7 | `linux/arm64` | Only if emulation is approved | Emulation approved by the owner. Image built with Compose in 610 s; `uname -m` `aarch64`, Litestream 0.5.18 replicating. Site 200 after 406 s; smoke 18/18. Edits at 16:42:03Z and 16:42:25Z, restore to 16:42:11Z into a new, empty `arm64` container: 200 after 111 s, first edit there, second not, integrity `ok`; smoke 13/18 (429, §3.5), then 18/18 after clearing the counters. Docker Scout: the same Litestream findings as on `amd64` (§3.3) | PASS (emulated) |

## 3. Findings for the owner

### 3.1 `apos-db-dump` stops on Litestream's tables

Litestream creates `_litestream_seq` and `_litestream_lock` in the database it replicates. The dump
tool in `@apostrophecms/db-connect` 1.1.0 treats every table as an Apostrophe collection and expects an
`_id` column, so it stops with `no such column: _litestream_seq._id` and exit code 1. By then it has
written all of Apostrophe's collections (here 81 docs, 787 versions, 36 migrations and the rest,
2.8 MB), plus an empty `_litestream_seq` entry at the end.

- A backup script that checks the exit code reports a failure every time. One that does not check it
  keeps a dump that ends with a stray entry.
- Restoring such a dump into a new, empty file worked. Afterwards Litestream's `_litestream_seq` table
  in that file was empty, which fits `apos-db-restore` clearing it as a collection. Litestream kept
  replicating it without a warning. **The cause was not confirmed.**
- A copy restored with `litestream restore` also has both tables, so dumping that copy fails the same
  way.

Options, none tried: (a) report it upstream and wait for `db-connect` to skip tables without an `_id`
column or with the `_litestream_` prefix; (b) a small project script that dumps only Apostrophe's
collections through the same library; (c) use `litestream restore` copies, not NDJSON dumps, for the
release and monthly exports. Option (c) changes D-DB-4's "portable export", so it is the owner's call.

### 3.2 Page load time with about 1,000 pages

The test created 20 section pages with 49 child pages each, through the REST API (1,000 pages in
208 s). The database grew to 28 MB plus a 19 MB WAL.

| Measurement | Demo content only (restored site) | With 1,000 pages |
|---|---|---|
| One home page request, no load | 0.03–0.07 s | 0.46–0.56 s |
| One 404 page, no load | 0.05–0.07 s | 0.45–0.48 s |
| Home page with Litestream paused (`SIGSTOP`) | — | 0.29–0.54 s |

A CPU profile of 10 home page requests: 2.2 of 3.5 s in better-sqlite3's synchronous `Statement.all`,
and 0.36 s turning rows back into documents. Logging the SQL showed two causes:

- **No index can be used.** The adapter writes each condition as
  `json_extract(data, '$.x') = ? OR (json_type(data, '$.x') = 'array' AND EXISTS (… json_each …))`,
  so every query reads the whole `aposDocs` table: about 10–20 ms each with about 2,000 docs, several
  per request. The cost grows with the total number of docs, not with the page shown.
- **The two-level main menu loads every page in its two levels.** `views/layout.jsx` shows the home
  page's children and grandchildren (`ancestors: { children: { depth: 2 } }`). In this test all 1,000
  pages sit in those two levels, so each request loaded about 500–1,000 page docs. A real site would
  nest most pages deeper, but the menu still loads everything in its first two levels.

better-sqlite3 runs on the main thread, so while a query runs the app serves nothing else. That is
the event-loop delay in P6.

Not measured: the same load on MongoDB, a deeper and more realistic page tree, and page caching. The
migrated corporate site's page count is not known yet. **Litestream had no measurable share in this.**

### 3.3 Three high findings in Litestream's Go libraries

Docker Scout on the test image. The Litestream binary is built with Go 1.26.10 (no finding in the
standard library) and adds:

| Package in Litestream 0.5.18 | Finding | Fixed in | Same as |
|---|---|---|---|
| `github.com/klauspost/compress` 1.18.7 | CVE-2026-116591, high | 1.20.2 | D-SEC-5 (PBM had 1.20.1) |
| `github.com/go-jose/go-jose/v4` 4.1.4 | CVE-2026-116587, high | 4.1.6 | D-SEC-5 (PBM had 4.1.5) |
| `golang.org/x/net` 0.60.0 | CVE-2026-78661, high | 0.62.0 | D-SEC-5 (same version) |

All three are denial of service. With a `file://` replica, the agent sees no path to them: the cloud
identity libraries (`go-jose`) and HTML parsing (`x/net`) are not used, and compressed data comes only
from the replica, which only Litestream writes. With S3, whoever can write to the bucket could make a
restore crash, as with PBM. Not verified in Litestream's source. v0.5.18 is the latest release
(2026-11-03).

The other findings in the test image are not from Litestream:

- Go standard library 1.23.12 (4 critical, 30 high): **esbuild 0.25.12**, a production dependency of
  the app through `@apostrophecms/vite` → `vite`. It is also in the demo image. m1-046 put the
  1.23.12 findings down to MongoDB's tools; at least this part comes from esbuild.
- Debian packages of the full `node:24-bookworm` base (for example `libheif`, `openexr`, `mariadb`
  client libraries). A slimmer base for the staging image would drop most of them.

### 3.4 Media is not replicated

Litestream copies the database only. The restored site showed its content with broken images,
because the new uploads volume was empty. D-DB-4 already sets a separate 24-hour RPO for media; the
staging design must include that copy and restore it from the same point.

### 3.5 Smaller points

- **The form rate limit travels with a restore.** The counters live in Apostrophe's cache, in the
  database. All test requests reach the container from the same address, so the restored site
  started with the source's counts. `assurer-security:sanitize-after-restore` does not clear them
  (auth secrets only); `assurer-security:clear-form-rate-limit` does. On both platforms the
  first smoke run on the restored site gave 17/18 and the rerun 13/18. The first run's failing check
  was not captured; the rerun's five failures were all 429. After the counters were cleared, 18/18.
- **One supervisor for two processes.** In this setup, if Litestream stops, the container stops and
  the app restarts with it (about 3–4 s offline). A staging setup could restart Litestream alone. With
  systemd that is the normal case.
- **`node app` tasks in the container need the session secret** in their own environment
  (`APOS_SESSION_SECRET`), because the entrypoint sets it only for the processes it starts.
- **A database named in `litestream.yml` that does not exist yet** gives a "timeout waiting for db
  initialization" warning every 30 s until it is created. Harmless.
- **Litestream's own settings** in 0.5.18: sync every 1 s, L0 files kept 5 minutes, snapshots every
  24 h. Retention for the 7-day PITR (D-DB-4) was not set or tested here.

## 4. Limits of this test

- **`arm64` under emulation only** (P7): smoke and one point-in-time restore. No kill, burst, task or
  load test on `arm64`, and **not run on real ARM hardware**. The emulated times say nothing about
  real ARM speed.
- **Local directory only.** No S3, no SSE-C, no object lock, no Hetzner. The replica sat on the same
  machine as the database, which is not a backup.
- **Demo data and synthetic pages.** The RTO measured (8 s to a working site) is for a 1.2 MB database.
- **One SQLite setting checked as is.** `wal_autocheckpoint` stayed at its default and Litestream
  missed no frames at this write rate (P4), so the paper's fallback (0, with custom code) was not
  needed. `synchronous`, `busy_timeout` and `journal_size_limit` were not changed.
- **Agent-executed.** The P6 numbers were taken with the app's inspector open, inside Docker Desktop
  on a Windows PC.

## 5. How to run it again

From the repository root, with Docker running. The test password lives outside the repository.

```sh
export ASSURER_ADMIN_PASSWORD=...   # any test value, first start only
docker compose -f docker/litestream-poc/compose.yaml up -d --build site       # http://localhost:3045
docker exec assurer-litestream-poc-site-1 litestream status
```

Restore into a new, empty container (only with the owner's approval; AGENTS.md):

```sh
LITESTREAM_POC_RESTORE_TIMESTAMP=YYYY-MM-DDTHH:MM:SSZ \
  docker compose -f docker/litestream-poc/compose.yaml --profile restore up -d --no-deps restore   # http://localhost:3046
```

For `linux/arm64` on an `amd64` PC, under its own project name so it gets its own volumes:

```sh
export DOCKER_DEFAULT_PLATFORM=linux/arm64 LITESTREAM_POC_TAG_SUFFIX=-arm64
docker compose -f docker/litestream-poc/compose.yaml build site
docker compose -f docker/litestream-poc/compose.yaml -p assurer-litestream-poc-arm64 up -d --no-build site
```

Remove a project with `docker compose -f docker/litestream-poc/compose.yaml [-p <project>] --profile restore down -v`;
this deletes the test's volumes and replicas for good.

## 6. Owner's decisions on the results (2026-11-07)

| Question | Owner's answer | Recorded as |
|---|---|---|
| Accept the 3 high findings in §3.3? | "Accept until a fix (Recommended)" | D-SEC-6 |
| What D-DB-13 says now | "Keep, 2 conditions (Recommended)": SQLite with Litestream stays the direction; before staging, (1) the dump problem in §3.1 is fixed and (2) a load test at the real site's expected size passes a p99 limit the owner agrees | D-DB-13 note |
| How to handle §3.1 | "Upstream + project script (Recommended)": report it to `db-connect`, and in a later task write a project dump task that exports only Apostrophe's collections until upstream fixes it | D-DB-13 note |
| Clean-up | "Remove all PoC (Recommended)": containers and volumes removed, images kept | m1-048 report |
