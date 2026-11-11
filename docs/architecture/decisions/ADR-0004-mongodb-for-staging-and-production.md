# ADR-0004: MongoDB for staging and production

| | |
|---|---|
| **Status** | **Accepted** 2026-11-08 (`m1-052`, D-DB-14). **Amendment 1 (one container per service, m1-068) accepted 2026-11-11 (D-DB-23).** Drafted by the agent; the decisions it records were made by the owner in the decision register (D-DB-8, D-DB-9, D-DB-10 (b), D-DB-12, D-DB-13) |
| **Date** | 2026-11-08 |
| **Task** | `m1-052` · report: [`2026-11-08-m1-052-mongodb-reversal-records.report.md`](../../engineering/reports/2026/11/2026-11-08-m1-052-mongodb-reversal-records.report.md) |
| **Supersedes** | [ADR-0002](./ADR-0002-database-strategy.md) **in part**: Decision item 2 (PostgreSQL for staging and production), §1 (SQLite → PostgreSQL migration), the PostgreSQL rows of §5, §6 and §9 (the PostgreSQL acceptance test), and the "SQLite in production" and "MongoDB everywhere" rows under Alternatives. Everything else in ADR-0002 stays in force |
| **Approved by** | Project owner, 2026-11-08, in session: "accept and aprrove" (recorded in the [m1-052 prompt](../../engineering/prompts/2026/11/2026-11-08-m1-052-mongodb-reversal-records.prompt.md)) |

## Context

ADR-0002 (2026-10-19) chose PostgreSQL for staging and production, with MongoDB 8+ as the fallback,
and said that fallback needs a new ADR. Since then the engine changed three times. Each change was an
owner decision recorded in the [decision register](../../engineering/decision-register.md):

| Date | Task | Decision | Reason given |
|---|---|---|---|
| 2026-10-20 | m1-011 | D-DB-6 = B: PostgreSQL for development and testing only, not staging or production | The app process exits when PostgreSQL drops an idle connection (D-DB-5) |
| 2026-11-04 | m1-038 | **D-DB-8: MongoDB** Community Server, self-hosted | No D-DB-5 crash; MongoDB is Apostrophe's native engine |
| 2026-11-04 | m1-041 | D-DB-9: MongoDB **8.0.x**, at most 8.2 | Apostrophe 4.34.0 accepts only the `mongodb` driver 6.x, which supports servers up to 8.2 |
| 2026-11-06 | m1-044 | D-DB-10 (b): the app and MongoDB in **one container** | Owner's choice ("same container i would suggest"); the agent had suggested separate containers |
| 2026-11-06 | m1-045, m1-046 | D-DB-12: **Percona Backup for MongoDB** (PBM), S3 tests still due | Local proof of concept: PITR restore into a new container passed every suite |
| 2026-11-07 | m1-047 | **D-DB-13: SQLite in WAL mode with Litestream**, replacing D-DB-8, subject to tests | Fewer moving parts, no MongoDB server |
| 2026-11-08 | m1-050 | D-DB-13 load test **fails** at the expected size | The SQLite adapter (db-connect 1.1.0) cannot use indexes for equality and `$in`, and better-sqlite3 runs every query on the event loop |
| 2026-11-08 | m1-051 | **D-DB-13 reversed: MongoDB again** (D-DB-8, D-DB-10 (b), D-DB-12 back in force) | "apostrophe if actually built for mongodb - then i would suggest and reccomend please go with mongodb community edition with same docker contianer for assurer project" |

Evidence for MongoDB on this project:

- The smoke, workflow and persistence suites passed against MongoDB 8.0.34 in the one-container image
  (m1-043, m1-046, m1-051).
- PBM point-in-time restore into a new, empty container worked, and every suite passed on the
  restored site. No gap after an agent crash or a container restart (m1-046).
- Load test at about 3x today's size (m1-051), against the limit the owner agreed in m1-050: at
  8 readers, HTTP p99 568 ms, event-loop p99 72.7 ms and 0 errors pass, but saves fail (46/59 and
  53/59 against ≥ 90%). At 4 readers and below, everything passes. Every lookup uses an index. The
  limit is the single Node process, not the database
  ([results](../../milestones/m1-051-mongodb-load-test-results.md)).

## Decision

1. **Engine.** Staging and production run **MongoDB Community Edition 8.0.x** (8.0.30 or newer;
   8.2 at most while Apostrophe accepts only driver 6.x, D-DB-9). It is reached through Apostrophe's
   own MongoDB connection, with no db-connect adapter in between.
2. **Container.** The app and MongoDB run **in one container** per environment (D-DB-10 (b)). The
   current image is for demo and test use only: it has a demo seed and a default password
   (D-DB-11). A staging version must be built first, with TLS, MongoDB member authentication, no
   demo seed, no default password, and a decided nginx placement.
3. **Backup.** The primary database backup is **PBM**: logical backups with oplog slicing for
   point-in-time recovery (D-DB-12), against the D-DB-4 targets (database RPO ≤ 15 min, RTO ≤ 4 h,
   PITR retention 7 days). It stays final only after the S3 tests (SSE-C, object lock, credential
   handling). Those tests need an account and spending that the owner has not yet approved. The
   PBM dependency findings are accepted until a fixed release (D-SEC-5); scan again before staging.
4. **Portable export.** `apos-db-dump` / `apos-db-restore` (ADR-0002 Decision 5, §2) remains the
   engine-independent export, taken with writes frozen. It is not the primary backup.
5. **Encryption at rest.** MongoDB Community has no built-in encryption at rest. Use full-disk
   encryption on the server (D-DB-8).
6. **Local development** stays on **SQLite** (ADR-0002 Decision 1). The automated suites run on
   SQLite in CI and on MongoDB before staging use.
7. **Unchanged from ADR-0002:** Apostrophe-native data access only (Decision 3); one database,
   media store and set of secrets per site (Decision 4, §8); media backed up separately but as a
   pair from the same quiet point (Decision 6, §3); the verified JSONL behaviour (§2); the
   permissions and versioning inventory (§4); restore drills (§5).

## Consequences

- **Positive:** Apostrophe's native engine, with the longest track record and indexed queries. No
  D-DB-5 crash. Queries run outside the Node event loop. Tested backup and restore (PBM, local).
  One container is simple to start and move.
- **Negative:**
  - A second engine family to run: SQLite locally, MongoDB in shared environments. Local and
    production search ranking differ.
  - MongoDB is SSPL-licensed. Running it for our own site is normal use; legal check with D-M0-7.
  - One container puts the app and the database on the same failure and update cycle. The agent
    advised separate containers.
  - PBM stores its storage credentials and SSE-C key in plain text in `admin.pbmConfig`, which
    every backup contains (m1-046).
  - The single Node process limits saves under heavy read load (m1-051).
- **Follow-ups:**
  - The staging image (Decision 2).
  - The PBM S3 tests (Decision 3), which need an account and spending approved.
  - Rewriting §6 and §7 of the hardening runbook for one container.
  - Cluster mode (`APOS_CLUSTER_PROCESSES`) or a page cache, if the save limit matters.
  - Provider and region (D-DB-2, D-DB-3, D-DB-7), still waiting for the DPO's answer to I1.
  - A read-only MongoDB viewer for the dashboard, through the dependency gate.
  - Re-checking D-DB-9 when Apostrophe accepts driver 7.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| PostgreSQL (ADR-0002 Decision 2) | db-connect 1.1.0 crashes the app when PostgreSQL drops an idle connection (D-DB-5), and the adapter is young. Kept for development tests only (D-DB-6) |
| SQLite in WAL mode with Litestream (D-DB-13) | Chosen on 2026-11-07, then failed the load test at the expected size (m1-050): HTTP p99 2.46 s and event-loop p99 956 ms against 1 s and 200 ms. Even with an adapter fix, event-loop p99 and saves failed, because every query runs on the event loop. Reversed by the owner on 2026-11-08 |
| MongoDB 9.0 | Needs the `mongodb` driver 7.x, which Apostrophe 4.34.0 does not accept (D-DB-9) |
| Separate containers for the app and MongoDB | The agent's suggestion; the owner chose one container (D-DB-10 (b)) |
| WAL-G, scheduled `mongodump --oplog`, Ops Manager, disk snapshots | Compared in the [m1-045 options paper](../../milestones/m1-045-backup-tool-options.md); `mongodump --oplog` is the fallback if PBM's S3 tests fail |

## Amendment 1: one container per service (m1-068)

| | |
|---|---|
| **Status** | **Accepted** 2026-11-11 (`m1-068`, D-DB-23) by the owner, in session: "Accept (Recommended)". Drafted by the agent; it records D-DB-20, decided by the owner on 2026-11-11 |
| **Design** | [m1-068 design note](../../milestones/m1-068-release-pipeline-design.md) (D-DB-22, approved by the owner) |

**Decision 2 is replaced by:**

2. **Containers.** Each service runs **in its own container, in one Docker Compose stack** per
   environment (D-DB-20, replacing D-DB-10 (b)): `app` (Apostrophe in cluster mode), `mongo`
   (MongoDB 8.0 from the official image, pinned by digest, with TLS and member authentication),
   `pbm` (pbm-agent), `backup` (the base-backup schedule), `nginx` and `certbot`, plus the one-shot
   `setup` and `cert-bootstrap` jobs. MongoDB is reached only over an internal network, never on a
   published port. Each service mounts only its own secrets. The images are built and checked in
   CI for each commit on `main` and pulled from `ghcr.io` by the server, which never builds
   (D-DB-21). The demonstration image (D-DB-11) stays one container, for demo and test use only.

**Consequences of the amendment:**

- **Positive:** an app release does not restart MongoDB; each service has its own limits, health
  check and restart; MongoDB, PBM and the app are updated separately; a release is one commit,
  and rolling back means starting an earlier one.
- **Negative:** MongoDB now listens on a container network instead of loopback (internal network,
  TLS and authentication required). More moving parts: eight services instead of four. A rollback
  across a new Apostrophe migration needs a PITR restore. The images are stored on GitHub, under
  the account's package allowance.
- **Alternatives:** the row "Separate containers for the app and MongoDB" above no longer applies;
  one container (D-DB-10 (b)) is the replaced option.
