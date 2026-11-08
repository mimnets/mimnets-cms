# ADR-0002: Database and media storage strategy

| | |
|---|---|
| **Status** | **Accepted.** PostgreSQL for staging and production remains conditional on the acceptance test (§6). **2026-10-20 (`m1-010`):** acceptance test run; agent recommendation **B, provisionally accepted with defined blockers** (§9), awaiting the owner (D-DB-6). Not a production commitment. **2026-10-20 (`m1-011`): the owner decided D-DB-6 = Option B.** PostgreSQL is provisionally accepted for development and further testing only, and is **not approved for staging or production**. SQLite stays the local default and MongoDB the fallback. No production database is selected. D-DB-5 is still open. **2026-11-04 (`m1-038`): the owner decided MongoDB (Community Server) as the engine for staging and production (D-DB-8)**, replacing the PostgreSQL direction of m1-031. The owner prefers self-hosting on Hetzner (provider and region wait for the DPO, D-DB-2). The PostgreSQL blockers (D-DB-5, D-DB-6) no longer block staging. §3 deviation preferred by the owner: media on the server disk with a nightly versioned copy to an EU bucket ([m1-038 report](../../engineering/reports/2026/11/2026-11-04-m1-038-hosting-inputs.report.md)). **2026-11-07 (`m1-047`): the owner decided SQLite in WAL mode with Litestream continuous backup for staging and production (D-DB-13), replacing MongoDB (D-DB-8), subject to a local proof of concept.** This reverses the "SQLite in production" rejection under Alternatives for a single-server site. The amendment of this ADR (or a new ADR) is still to be written and accepted ([m1-047 options paper](../../milestones/m1-047-sqlite-production-options.md)). **2026-11-08 (`m1-051`): the owner reversed D-DB-13; MongoDB again (D-DB-8).** **2026-11-08 (`m1-052`): [ADR-0004](./ADR-0004-mongodb-for-staging-and-production.md) (accepted by the owner 2026-11-08, D-DB-14) supersedes this ADR in part**: Decision item 2, §1, the PostgreSQL rows of §5, §6, §9 and two rows under Alternatives. The rest stays in force. |
| **Approved by** | Project owner, 2026-10-19 (recorded in the [m0-004 prompt](../../engineering/prompts/2026/10/2026-10-19-m0-004-safe-git-initialization.prompt.md)) |
| **Date** | 2026-10-19 |
| **Task** | `m0-003` · report: [`2026-10-19-m0-003-database-strategy.report.md`](../../engineering/reports/2026/10/2026-10-19-m0-003-database-strategy.report.md) |
| **Prompt** | [`2026-10-19-m0-002-engineering-governance.prompt.md`](../../engineering/prompts/2026/10/2026-10-19-m0-002-engineering-governance.prompt.md) (Task 2) |
| **Depends on** | [ADR-0001](./ADR-0001-cms-platform-and-starter.md) (ApostropheCMS Community Edition) |
| **Runbooks** | [Database backup and restore](../../runbooks/database-backup-and-restore.md) · [New site initialization](../../runbooks/new-site-initialization.md) |

## Context

The Milestone 0 proof of concept runs on SQLite through `@apostrophecms/db-connect` 1.1.0
(see `docs/milestones/m0-architecture-and-license-audit.md`). Before Milestone 1 we need a
decision on databases for each environment, on how data and media move between them, and on how
future company websites are kept separate.

Facts established by inspecting the installed source (`node_modules/@apostrophecms/db-connect`,
`apostrophe` 4.34.0) and by a non-destructive round-trip test on 2026-10-19:

- **Storage model.** Each Apostrophe "collection" (`aposDocs`, `aposAttachments`,
  `aposUsersSafe`, …) becomes one table. In PostgreSQL that table is
  `(_id TEXT COLLATE "C" PRIMARY KEY, _order SERIAL, data JSONB)`; SQLite is equivalent, plus FTS5
  tables for text search. Apostrophe talks to it through a MongoDB-compatible API. There is no
  relational schema to design or maintain.
- **Adapter maturity.** The SQLite and PostgreSQL adapters are new: 1.0.x shipped around
  August–September 2026. 1.1.0 (2026-09-30) fixed a PostgreSQL connection leak, a PostgreSQL
  sort bug that put page rank 10 before 2, and a prototype-pollution DoS (GHSA-j5rq-xfvr-p969).
  MongoDB is core's longest-standing default and is a thin wrapper over the official driver.
  Core's test matrix runs against MongoDB, PostgreSQL, SQLite and multipostgres.

## Decision

1. **SQLite** for local proof-of-concept development and automated tests.
2. **PostgreSQL** (14 or later, per the starter kit) for staging and production, **conditional on
   passing the PostgreSQL acceptance test** (§6). If it fails, fall back to MongoDB 8+, the
   adapter with the longest track record. That fallback needs a new ADR.
3. **Apostrophe-native data access only.** Content is managed through Apostrophe pages, pieces,
   widgets, schema fields, the query builder (`find()`), the REST API and
   `@apostrophecms/migration`. There is **no** custom parallel CMS database, **no** ORM, and
   **no** raw SQL for normal content operations.
   - Allowed exceptions: infrastructure tooling that does not interpret content, such as
     `pg_dump`/`pg_restore`, managed point-in-time recovery, and health checks. All of these are
     covered by runbooks.
4. **One database and one media store per website.** Every future company site gets its own
   PostgreSQL database (not a shared database), its own media bucket or uploads directory, its
   own session secret and its own admin accounts. `multipostgres` (several sites as schemas in
   one database) is technically supported but **not** used, because it shares one database
   server's failure, backup and credential boundary.
5. **Portable export and restore** uses the supported `apos-db-dump` / `apos-db-restore`
   (JSONL) tools shipped with db-connect. They are used for environment moves and engine
   migration. **Primary production backup** uses PostgreSQL-native, transactionally consistent
   tooling (§5), because the JSONL tools are not snapshot-consistent (§2).
6. **Media is backed up and migrated separately from the database, always as a pair** taken
   from the same quiet point (§3).

## 1. SQLite → PostgreSQL migration (procedure — not executed)

Supported path (db-connect documents cross-engine migration):

```sh
# 0. Freeze writes: stop the app (or put it in maintenance) — required, see §2.
# 1. Portable dump of the source
npx apos-db-dump "sqlite://./data/vcl-assurer-group.db" --output=backups/<date>-source.jsonl
# 2. Restore into an EMPTY, pre-created PostgreSQL database
npx apos-db-restore "postgres://<user>:<password>@<host>:5432/vcl_assurer_group" --input=backups/<date>-source.jsonl
# 3. Point the app at PostgreSQL and run migrations/startup so indexes (incl. text search) are built
APOS_DB_URI="postgres://…" node app @apostrophecms/migration:migrate
# 4. Copy media (public/uploads or bucket) from the same frozen moment
# 5. Run acceptance checks (§6), then switch traffic
```

Rules:

- PostgreSQL database names use underscores, not hyphens (`vcl_assurer_group`), per the starter
  kit's guidance.
- Pre-create the database and give the application role **only** the rights it needs on it
  (CONNECT, plus CREATE on its schema so Apostrophe can create tables and indexes). The adapter
  will issue `CREATE DATABASE` itself if the database is missing. Do **not** grant `CREATEDB` in
  production; a missing database should be an error, not a silent creation.
- TLS and pool settings go in the connection string (node-postgres `connectionString`, e.g.
  `?sslmode=require`).
- Restoring into a non-empty target is destructive (§2). Always restore into a new, empty
  database and switch over; never restore over the live database.
- Expected behavioural differences after the switch (verify in the acceptance test):
  - Text search uses PostgreSQL `to_tsvector('simple')` with `ts_rank` instead of SQLite FTS5 with
    BM25. Neither does stemming, and relevance order may change.
  - Simple equality on arrays uses JSONB containment (`@>`), which does not use btree indexes.
  - Aggregation `$group` does not support `$min`, `$max`, `$push` or `$addToSet`.
  - `$push`/`$addToSet` do not support `$each`.
  - `updateMany`, `findOneAndUpdate`, `replaceOne` and upserts are read-modify-write, not atomic.
    Core guards critical sections with `apos.lock`; **project code must do the same**.
  - Keep documents under 16 MB so data stays portable across all three engines.

## 2. Portable JSONL export and restore — verified behaviour

Verified on 2026-10-19 against a copy of the M0 database. The dump was written to a temporary
directory and deleted afterwards; it was never stored in the repository.

| Property | Finding |
|---|---|
| Coverage | All 12 collections were dumped: `aposDocs`, `aposAttachments`, `aposUsersSafe`, `aposDocsVersions`, `aposMigrations`, `aposFormSubmissions`, `sessions`, `aposBearerTokens`, `aposNotifications`, `aposCache`, `aposJobs`, `aposLocks`. Indexes are written as per-collection header lines. |
| Fidelity | Restored into a fresh SQLite file: every collection's row count matched; all 43 `aposDocs` documents were JSON-identical. Dates are encoded as `{"$date": ISO}` and restored as `Date`. |
| **Text index not carried** | The SQLite FTS5 index is **not** in the dump. Right after restore, search tables are absent. Running `node app @apostrophecms/migration:migrate` (or any app start) recreated the index and backfilled all 43 documents; search worked. **Always start the app or run migrate after a restore, before serving traffic.** |
| **Destructive** | For every collection in the dump, restore first runs `deleteMany({})` on the target, then inserts. Collections that exist in the target but not in the dump are **left untouched**, so stale sessions or tokens can survive. |
| **Not atomic** | There is no transaction around a restore. A failure midway leaves the target partly restored. |
| **Not a consistent snapshot** | The dump pages through each collection in batches of 100, with no transaction. Writes during a dump can produce an inconsistent copy. **Freeze writes first.** |
| Not byte-read-only | The SQLite adapter always opens the file read-write and sets `journal_mode=WAL`, so a dump changes the source file's bytes (logical content unchanged; `integrity_check: ok`). Do not point it at read-only media or rely on file checksums of the source. |
| **Contains secrets and personal data** | A dump contains password hashes (`aposUsersSafe`), live session IDs and API bearer tokens, and form submissions. Treat dumps as credentials: encrypt at rest, restrict access, never commit (`*.jsonl` is git-ignored), and set a retention period. |
| Doc discrepancy | The db-connect README shows header lines as `{"collection":…,"indexes":…}`. The code actually reads and writes `{"_collection":…,"_indexes":…}` and `{"_collection":…,"_doc":…}`. Trust the code; report the discrepancy upstream. |
| Version coupling | Use the same db-connect major version for dump and restore (README guidance). |

## 3. Media backup and migration

- Files are **not** in the database. `aposAttachments` holds metadata; the files live in uploadfs
  storage. The default is local disk at `public/uploads/attachments/`. Alternatives are S3 or any
  S3-compatible store via `APOS_S3_BUCKET`, `APOS_S3_KEY`, `APOS_S3_SECRET`, `APOS_S3_REGION` and
  `APOS_S3_ENDPOINT`; Azure and Google Cloud Storage are also supported (uploadfs 1.28.1).
- Each image is stored as an original plus generated sizes (`max`, `full`, `two-thirds`,
  `one-half`, `one-third`, `one-sixth`). In M0, 15 attachments produced 105 files. Back up **all**
  of them; `node app @apostrophecms/attachment:rescale` can regenerate the sizes from the
  originals, but it is slow.
- Files of archived or unpublished documents are hidden on local disk with `chmod 0000` by
  default. A backup job running as a different user may fail to read them. **Production:** set
  `APOS_UPLOADFS_DISABLED_FILE_KEY` (rename-based hiding) and run
  `node app @apostrophecms/attachment:migrate-to-disabled-file-key` once, or run backups as the
  application user.
- Moving from cloud storage back to disk: `node app @apostrophecms/attachment:download-all
  --to=public/uploads/attachments`.
- **Production target:** an S3-compatible bucket per site, with object versioning and lifecycle
  rules, not local disk. This keeps app servers stateless and lets backups use the provider's
  replication. The bucket choice is decision D-DB-3 in the register.
- A database backup and a media backup are only consistent if taken from the same quiet point. A
  restore always restores **both**.

## 4. Permissions and content-version preservation

Everything below lives in the collections the dump captures, and is preserved by both the JSONL
round trip and PostgreSQL-native backups:

| Data | Where it lives |
|---|---|
| Users and roles (guest / contributor / editor / admin) | `@apostrophecms/user` documents in `aposDocs` (`role` field) |
| Password hashes | `aposUsersSafe` (kept separate from `aposDocs`) |
| Page and piece visibility | per-document `visibility` field |
| Draft and published states | separate `aposDocs` rows per mode (`…:en:draft` / `…:en:published`) |
| Version history | `aposDocsVersions`: full document snapshots with author, locale and mode. "Undo publish" (`revertPublishedToPrevious`) also restores from these records, so losing this collection loses undo-publish. |
| Executed migrations | `aposMigrations` (33 in M0). Must travel with the data so migrations are not re-run. |
| Attachment ↔ document references | `aposAttachments` (`docIds`, `archivedDocIds`). `@apostrophecms/attachment:recompute-all-doc-references` repairs them. |

Cross-environment caution: a dump also carries **sessions and bearer tokens**. When copying
production data into staging or development, invalidate them after restore and rotate the
session secret. This should be done by a reviewed Apostrophe task, not ad-hoc SQL. That task is a
proposal for M1 and has not been built.

## 5. Production backup and recovery

| Layer | Mechanism | Purpose |
|---|---|---|
| Primary DB backup | Managed PostgreSQL point-in-time recovery (WAL archiving), **or** nightly `pg_dump -Fc` taken in a single consistent snapshot | Disaster recovery; consistent without stopping the site |
| Portable DB export | `apos-db-dump` with writes frozen, at each release and before migrations | Engine-independent copy; environment moves |
| Media | Bucket object versioning plus cross-region replication (or a nightly rsync of `public/uploads` from the same quiet point) | File recovery |
| Secrets | `.env` and secrets in the platform's secret manager, never in backups that are stored alongside the data | — |

Targets (RPO/RTO) are decision D-DB-4 in the register. Proposed: RPO ≤ 24 h (≤ 15 min with PITR),
RTO ≤ 4 h. **A backup counts only after a restore drill succeeds.** Run one quarterly into an
isolated environment, then run the acceptance checks against it.

**2026-11-04 (`m1-038`): D-DB-4 decided by the business owner.** Database RPO ≤ 15 min (PITR),
media RPO ≤ 24 h, RTO ≤ 4 h, PITR retention **7 days**, encrypted portable exports at each release
and monthly (12 kept), quarterly restore drill. Provider and region (D-DB-2, D-DB-3, D-DB-7) are
still open.

## 6. PostgreSQL acceptance test (gate for this ADR)

Run once in an isolated environment before staging uses PostgreSQL:

1. Fresh PostgreSQL 16 database (managed-service parity). Restore the M0 JSONL dump (§1); run migrate.
2. `npm run test:smoke` and `scripts/editor-workflow-test.mjs` (+ `--verify-only` after restart): all pass.
3. Page tree with **10 or more** sibling pages: order is correct (regression check for the 1.1.0 numeric-sort fix).
4. Site search returns expected pages; record the relevance differences.
5. Concurrent editing smoke test (two editors, different pages); no errors and no lost updates.
6. A connection-pool soak (for example 15 minutes of a simple load) shows no connection growth.
7. `pg_dump` → `pg_restore` drill, and an `apos-db-dump` → `apos-db-restore` round trip back to SQLite.

Owner and date: decision D-DB-1.

## 7. Adapter limitations (summary)

| Area | Limitation | Mitigation |
|---|---|---|
| Atomicity | Non-scalar `$push`/`$pull`/`$addToSet`, `$rename`, upserts, `updateMany`, `findOneAndUpdate` and `replaceOne` are read-modify-write | Use `apos.lock` around critical sections in project code |
| Aggregation | Only a leading `$match` runs in the database; later stages run in memory. `$min`, `$max`, `$push` and `$addToSet` are not supported. | Avoid aggregation in project code; use the query builder |
| Search | No stemming; ranking differs by engine | Accept, or add a search service later through a new ADR |
| Arrays and indexes | Array-aware equality is not btree-indexed | Keep queries simple; measure before optimising |
| Maturity | SQL adapters are about two months old | Acceptance test (§6); stay on the latest db-connect; watch advisories |
| SQLite | Single writer; single file; no replication | Local and tests only |
| Document size | Engine-specific | Keep documents under 16 MB |

## 8. Initialising a new company website with clean data

Summary; the full procedure is in the [new-site runbook](../../runbooks/new-site-initialization.md).

1. Own repository, or own deployment of the shared codebase, with its own `shortName`.
2. New, empty PostgreSQL database and new media bucket or prefix. **Never clone another site's
   database.** That would copy its users, password hashes, sessions, tokens, form submissions
   and version history.
3. New `APOS_SESSION_SECRET`, and new storage credentials scoped to that site's bucket only.
4. `node app @apostrophecms/migration:migrate` creates the home page, global document and indexes.
5. Create the first admin with `node app @apostrophecms/user:add <name> admin` (interactive
   password prompt).
6. Starter content is loaded by **code**, using seed tasks like `assurer-demo:seed`, not by copying
   data. `@apostrophecms/import-export` (free) could move selected content, but it had 8 security
   advisories in October 2026. It needs its own review and a version of at least 3.7.1 before use.

## 9. Acceptance test result (m1-010)

Run on 2026-10-20 in a disposable, local-only environment. Full matrix and evidence:
[m1-010 report](../../engineering/reports/2026/10/2026-10-20-m1-010-postgresql-compatibility-acceptance.report.md).
Environment: PostgreSQL **16.15** (official Windows binaries, user-level, `127.0.0.1` only),
`apostrophe` 4.34.0, `@apostrophecms/db-connect` 1.1.0 (both the latest published releases),
`pg` 8.23.1, Node 24.21.0, Windows 11. The app role had no `CREATEDB` right, and the
databases were pre-created as §1 requires.

| §6 item | Result |
|---|---|
| 1. Restore the M0 data into an empty database, then migrate | **PASS.** A JSONL dump of a *copy* of the local SQLite database (85 docs, 34 attachments, 8 collections) restored in 1.5 s. Every document in every collection was identical after a re-dump. The text index was absent after restore and was rebuilt by `migrate` (as §2 predicts). 33 migrations were not re-run. |
| 2. Smoke, workflow and persistence suites | **PASS.** Fresh DB: 14/14, 15/15 as admin, 15/15 as editor, 7/7 after restart. Migrated copy: 7/7. Restored copy: 14/14, 7/7. |
| 3. Ten or more siblings in order | **PASS.** 12 children in rank order 0–11 (REST and the admin UI). The 1.1.0 numeric-sort fix holds. |
| 4. Search | **PASS (matching).** The same 10 queries returned the same result sets on PostgreSQL and on a SQLite copy of the same data. Case-insensitive; no stemming. Relevance *ordering* was not compared (the REST list applies its default sort). |
| 5. Concurrent editing | **PASS.** Two users edited different pages, 10 interleaved saves each, with no errors or lost updates. |
| 6. Connection-pool soak | **PASS.** 15 min, 56,359 requests, 0 errors. PostgreSQL connections stayed between 8 and 13 with no growth. |
| 7. `pg_dump`/`pg_restore` and JSONL round trip to SQLite | **PASS.** `pg_dump -Fc` of the running database restored into a new database: identical counts, 41 indexes, identical document content (md5), and the app passed every check on it. PostgreSQL → JSONL → SQLite: all 6 collections identical. |

Additional findings:

- **FAIL: connection loss crashes the app (D-DB-5).** db-connect 1.1.0 does not attach an
  `error` listener to its `pg` pool. When PostgreSQL drops an idle connection, `pg-pool`
  emits an unhandled `error` and the Node process exits (`read ECONNRESET`). PostgreSQL
  itself recovered cleanly from the crash (WAL redo), and no acknowledged write was lost. Until
  upstream fixes it, any shared environment needs a supervisor that restarts the app, and
  health checks.
- A hard kill of the app mid-write kept the last acknowledged revision. The stale
  `@apostrophecms/page:tree` lock it left was taken over after restart.
- A failed `apos-db-restore` (truncated input) exits 1 but leaves a **partial** database:
  documents loaded, version history empty, `aposMigrations` missing. Always restore into a new
  database, and discard it on any failure (§2 rule confirmed).
- Media: 13 attachments → 91 files (original plus 6 sizes), none missing. A copy of the M0
  media matched all 34 attachment records.

**Outcome:** the §6 gate passes for every listed item, but the connection-loss crash blocks any
shared or production use. PostgreSQL is therefore **provisionally accepted for development and
CI only** (D-DB-6). Before staging, the following are required:

- D-DB-5 resolved or mitigated.
- A repeat on Linux with the managed service's major version.
- The reviewed "sanitize after restore" task. The migrated copy carried 11 sessions.
- D-DB-2, D-DB-3 and D-DB-4.

MongoDB remains the fallback (Decision §2).

## Consequences

- **Positive:** a single data-access model (Apostrophe APIs) on every engine; zero-server local
  development; a documented, tested path between engines; strong isolation between sites.
- **Negative:** dependency on young SQL adapters (mitigated by the acceptance gate and the MongoDB
  fallback); two backup mechanisms to operate (native and portable); search relevance differs
  between local and production.
- **Follow-ups:** run the acceptance test; choose the managed PostgreSQL and object storage
  providers; build a reviewed "sanitize after restore" task; report the db-connect README format
  discrepancy upstream.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| MongoDB everywhere | Most mature adapter, but adds a database family the team doesn't otherwise run, and needs a server even locally. Kept as the fallback. |
| PostgreSQL everywhere, including local | Viable, but loses zero-setup local development and fast throwaway test databases |
| SQLite in production | Single writer, no replication or HA; not appropriate for a corporate site |
| ORM or custom relational schema beside Apostrophe | Duplicates the CMS's own model, bypasses permissions, versioning and draft/publish, and creates a second source of truth |
| `multipostgres` (sites as schemas in one database) | Shared failure, backup and credential boundary, which conflicts with per-site independence |
