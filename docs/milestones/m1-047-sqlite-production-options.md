# m1-047 options paper: SQLite (WAL) instead of MongoDB for staging and production

| | |
|---|---|
| **Status** | Agent research, 2026-11-07. **Nothing was installed or run**, apart from read-only checks of the installed packages. No option here is tested on a server. **Owner's decision (2026-11-07, D-DB-13 in the [decision register](../engineering/decision-register.md)): option B, SQLite with Litestream, subject to the proof of concept in §7; Docker Compose and plain systemd both kept; both dashboard layers; the proof of concept next** (§6). That approves no install, account or spending |
| **Question** | The owner asked: "can we consider to continue with sqlite with WAL on and then i think we will not depends on mongodb and docker right?" |
| **Decides** | The database engine for staging and production (would reopen D-DB-8), and with it the backup tool (D-DB-12) and the container question (D-DB-10 (b)) |
| **Does not decide** | The provider and region (D-DB-2, D-DB-3, D-DB-7, waiting for the DPO's answer to I1), media storage, or any install, account, server or spending |
| **Related** | [ADR-0002](../architecture/decisions/ADR-0002-database-strategy.md) · D-DB-4, D-DB-8, D-DB-9, D-DB-10, D-DB-11, D-DB-12, D-SEC-5 in the [decision register](../engineering/decision-register.md) · [m1-045 backup tool paper](./m1-045-backup-tool-options.md) · [m1-046 PBM results](./m1-046-pbm-poc-results.md) · [hardening runbook](../runbooks/server-hardening-and-patching.md) |

## 1. Short answer

**Owner's direction in session (2026-11-07), not yet a recorded decision:** "think of keep our db
sqlite with dashboard as i have aksed for mongodb - so if sqlite will fit for our project requorements
so we will go for sqlite if needed anything on or off like WAL", and "sqlite dashnoard should have
CRUD and export import data and along with your suggested features". The settings are in §4.5 and
the dashboard is in §4.6. The engine change is an architecture gate and needs the owner's answer to Q1.

- **MongoDB: yes, we would not need it.** Apostrophe 4.34.0 supports SQLite through
  `@apostrophecms/db-connect` 1.1.0, and this project has run on SQLite since m0. Every automated
  suite and every browser check so far has run on SQLite. MongoDB was only ever tested in the m1-043
  demo image and the m1-046 PBM test.
- **Docker: not needed, but optional.** Without MongoDB, the server needs only Node.js, the app, a
  backup agent and nginx. Those can run under systemd (the owner's preference in m1-038, before
  D-DB-10 (b)) or in Docker Compose (the owner's rule from m1-046). Dropping Docker is a separate
  choice from dropping MongoDB (§6, Q2).
- **Is SQLite good enough?** For this site, very likely yes: one server, a few editors, mostly reads.
  Apostrophe's own docs say SQLite "is also good for small projects in production" and only warn when
  "your needs grow beyond a single server". D-DB-10 (b) already puts the whole site on one server in
  one container, so MongoDB gives no extra availability today.
- **What it costs:** the site can never run more than one server, the SQLite adapter is young, the
  backup tool (Litestream) has no client-side encryption, and its cleanup clashes with object lock
  (§4). These are manageable but need the owner's acceptance.

## 2. Recommendation

**Option B: SQLite in WAL mode with Litestream continuous replication on one server, subject to a
local proof of concept (§7).** Keep the decision on Docker separate (Q2). The agent leans towards
**systemd without Docker** for staging and production, because it removes a layer for a team with
limited ops, and the Docker demo image can stay for demos. Keeping Compose is also reasonable.

Reasons:

1. **It matches what we have tested.** All suites (lint, smoke, workflow, persistence) and every
   browser check from m0 to m1-046 ran on SQLite. Staging would run the same engine as development,
   including the same FTS5 search, so search behaves the same everywhere (ADR-0002 noted the
   difference as a negative).
2. **It removes the open MongoDB problems.** PBM's `anyAction` user (m1-045 §4.1), storage credentials
   and the SSE-C key in plain text in `admin.pbmConfig` and in every backup (m1-046 §3.2), three high
   findings (D-SEC-5), Percona's "single-node replica set is for testing" caveat (m1-045 §4.4), the
   driver cap at MongoDB 8.2 (D-DB-9), the replica-set key file or x.509 setup (hardening §12
   choice 2), and the `mongo` image's two-platform limit.
3. **The availability is the same.** With D-DB-10 (b), MongoDB runs as one member in the same
   container as the app. If that server fails, the site is down either way. Recovery is a restore onto
   a new server in both cases.
4. **The load is small.** sqlite.org calls SQLite conservatively fine below 100,000 hits a day on
   one server (its own site serves 400,000–500,000 a day). The local database is 1.8 MB. Writes come
   from a few editors and the contact form.
5. **Fewer moving parts to patch.** No database server, no database users or passwords, no replica
   set. The database file is a file on the encrypted data volume (hardening §12 choice 1).

If the owner wants to keep the option of more than one app server, or does not want to depend on a
five-month-old adapter in production, **stay with MongoDB (option A)**. Nothing in this paper makes
option A wrong; the m1-046 work stays valid.

## 3. Options

| | A. MongoDB 8.0 + PBM, one container (current, D-DB-8, D-DB-10 (b), D-DB-12) | **B. SQLite + Litestream** (recommended) | C. SQLite + scheduled snapshots |
|---|---|---|---|
| **How** | `mongod` one-member replica set and the app in one image; PBM logical backups with oplog slices | App writes `data/<site>.db`; Litestream streams WAL changes to S3-compatible storage every second | `VACUUM INTO` (or the backup API) every 15 minutes, then an encrypted upload with restic |
| **RPO ≤ 15 min (D-DB-4)** | Yes, if a base backup takes ≤ about 5 minutes (m1-046 §3.3) | Yes: seconds by default (`sync-interval 1s`) | Yes, only if every 15-minute run succeeds |
| **PITR, 7 days** | Yes, to any moment | Yes, to any moment, with `snapshot.retention: 168h` | **No**: only to snapshot points |
| **RTO ≤ 4 h** | Not measured on realistic data | Not measured; a restore is a file download | Not measured; a file download |
| **Client-side encryption** | No; SSE-C, key in plain text in the database (m1-046 §3.2) | **No** (removed in v0.5.1); SSE-C or SSE-KMS only, key in a config file outside the database | **Yes** (restic encrypts before upload) |
| **Object lock** | Untested (S3 tests still due) | Conflicts with compaction and retention deletes (§4.4) | Works: restic can run append-only |
| **Backup tool privileges** | `anyAction` in MongoDB | Reads the database file, as the app's OS user or a group with read rights | Reads a snapshot file |
| **Advisories** | Three high (D-SEC-5) | None published (2026-11-07) | restic not checked yet |
| **License** | SSPL (MongoDB), Apache-2.0 (PBM) | Public domain (SQLite), MIT (better-sqlite3), Apache-2.0 (Litestream) | Public domain, BSD-2-Clause (restic, to confirm) |
| **Docker** | Required by D-DB-10 (b) | Optional | Optional |
| **`arm64`** | Built under emulation only (m1-046) | Official Litestream Linux `arm64` builds; better-sqlite3 prebuilds for `linux-arm64` (check on the target) | As B |
| **More than one app server** | Possible later (more replica-set members) | **Never** with this design | **Never** |
| **Tested on this project** | m1-043, m1-046 (local Docker) | Engine: since m0. Litestream: not tested | Engine: since m0. Snapshots: not tested |

Rejected:

| Option | Why not |
|---|---|
| LiteFS | Fly.io staff describe it as "not discontinued but … limited updates"; still beta (last seen v0.5.14, 2025-04); FUSE-based and built for clusters, so it gives nothing on one server |
| WAL-G | No SQLite support |
| `sqlite3_rsync` | Copies to another host over SSH, not to object storage; would need a second server |
| Hetzner Backups or snapshots alone | Daily, so they fail RPO ≤ 15 min. Hetzner does not say whether they are crash-consistent. Keep them as a server rebuild aid only (hardening §9) |
| Copying the live database file | Not safe in WAL mode without the `-wal` and `-shm` files from the same instant. Use Litestream or `VACUUM INTO` |
| PostgreSQL | Still blocked by the D-DB-5 crash, and needs a database server like MongoDB does |

A layered variant **B + C** (Litestream for PITR, plus a nightly restic snapshot for an encrypted,
append-only copy) closes the encryption and object lock gaps of B at the cost of a second tool. The
agent suggests deciding that after the proof of concept.

## 4. What the owner has to accept with option B

### 4.1 One server, for good

SQLite is a file on one machine. Apostrophe's guide says: "Avoid SQLite when your production
architecture needs more than one ApostropheCMS application server", and "A database file on one
server cannot act as shared storage for multiple application instances." Apostrophe's hosting page
also suggests "at least two processes", but no Apostrophe page says whether two processes may share
one SQLite file. Plan for **one Node process**.

Consequences:

- A deploy restarts the app: a few seconds of downtime per release, unless a later task tests a
  hand-over between two processes on the same host.
- A server failure means a restore onto a new server (§5), as with option A today.
- Moving to MongoDB or PostgreSQL later stays possible with `apos-db-dump` and `apos-db-restore`
  (ADR-0002 §1, verified SQLite → PostgreSQL → SQLite in m1-010).
- Never put the database on a network file system, a Hetzner Storage Box mount, or Docker Desktop's
  file sharing. A Hetzner Cloud volume (block storage) is fine.

### 4.2 A young adapter

- The SQL adapters reached 1.0 in June 2026. db-connect 1.1.0 (2026-09-30) is still the latest.
- One advisory so far: GHSA-j5rq-xfvr-p969 (high), prototype pollution in the SQLite and PostgreSQL
  adapters. It is fixed in 1.1.0 and apostrophe 4.33.0; this project has both.
- No open GitHub issue in the apostrophecms organisation mentions SQLite, and no "database is
  locked" reports were found. With an adapter this young, that is weak evidence.
- Core's test matrix runs against SQLite (ADR-0002).

Mitigation: stay on the latest db-connect, watch advisories (the CI `audit` job already does), and
keep the monthly portable exports from D-DB-4 so that an engine change stays cheap.

### 4.3 Durability and blocking, by design

- **`synchronous = NORMAL`.** better-sqlite3 is built with `SQLITE_DEFAULT_WAL_SYNCHRONOUS=1`, and
  db-connect sets only `journal_mode = WAL` and `busy_timeout = 5000`. In WAL mode, sqlite.org says
  that with NORMAL "a transaction committed … might roll back following a power loss or system
  crash". The database stays consistent, and an app crash loses nothing. Losing the last seconds on a
  power cut is inside the 15-minute RPO. Rails 8 uses the same setting by default.
- **Synchronous queries.** better-sqlite3 runs queries on Node's main thread. A slow query blocks
  every request while it runs. At 1.8 MB this is not measurable today; the proof of concept measures
  it with more content.
- **Read-modify-write updates.** ADR-0002 §7 already applies: some update operators are
  read-modify-write. Inside one Node process they cannot interleave, because better-sqlite3 is
  synchronous [inferred from the adapter source]. A second process, such as a `node app …` task run
  while editors work, can interleave. Run write tasks only when no one edits.
- `apos.lock` uses a unique key on `aposLocks`, and the adapter maps SQLite's unique-constraint error
  to MongoDB's error code 11000, so locks work across processes [inferred from the source].
  Sessions are stored through the same adapter (connect-mongo on the emulated API) and expire through
  TTL indexes, which db-connect supports for SQLite since 1.1.0.

### 4.4 Litestream's limits

- **No client-side encryption.** Since v0.5.1, Litestream stops at startup if a replica has an `age`
  block. It supports SSE-C and SSE-KMS only. Hetzner Object Storage supports SSE-C and does not
  encrypt at rest by default. Unlike PBM, the SSE-C key sits in `/etc/litestream.yml` (or an
  environment variable) on the server, not inside the database or its backups. It must also be kept
  off the server, by the key custodians (backup protection plan §2).
- **Object lock.** Litestream deletes old files during compaction and when retention expires
  (Litestream issue #891). A compliance-mode lock blocks those deletes. Workarounds discussed
  upstream: versioning only (deletes leave delete markers), governance mode with a bypass right, or
  `retention.enabled: false` with bucket lifecycle rules doing the cleanup. A second bug made locked
  buckets reject every upload in v0.5.17. It was fixed in v0.5.18 by opt-in PutObject checksums
  (issue #1607). **Not verified on Hetzner.**
- **Storage credentials can delete.** As with PBM (m1-045 §4.2), unless the cleanup is moved to
  lifecycle rules.
- **Checkpoints.** Litestream keeps a read transaction open and runs checkpoints itself. Its tips
  page warns that under heavy writes the app's own automatic checkpoint can make it miss WAL frames,
  and suggests `wal_autocheckpoint = 0`. db-connect leaves the default (1000 pages) and gives no
  option to change it. At a few editors' write rate the risk is low, but **the proof of concept must
  check it**, together with `apos-db-restore`, which runs a `TRUNCATE` checkpoint.
- **Young format.** v0.5.0 (2025) had restore regressions, fixed by v0.5.2, and v0.5.15–0.5.18 added
  more integrity fixes. Latest: v0.5.18, listed as 2026-11-03 (recheck the date). Pin a version and
  drill restores. No GitHub security advisories are published. One maintainer, backed by Fly.io.
- Litestream does not run on Windows. Local tests need WSL2 (already on the owner's PC) or Docker.
- Litestream creates a `_litestream_lock` table in the database. Do not drop it.

### 4.5 SQLite settings: what is on, what is off

The owner asked what needs to be switched on or off. db-connect opens the file itself and has **no
option for SQLite settings**. Changing one would need custom startup code that reaches into the
adapter's private handle, which goes against "official Apostrophe APIs first". So the agent proposes
**no changes now**, with each setting checked in the proof of concept (§7).

| Setting | Value now | Set by | Proposal |
|---|---|---|---|
| `journal_mode` | **WAL (on)** | db-connect, at every connect | Keep. Readers do not block the writer, and Litestream requires it |
| `busy_timeout` | 5000 ms | db-connect | Keep. A second writer waits up to 5 s instead of failing |
| `synchronous` | NORMAL | better-sqlite3 build default in WAL mode | Keep (§4.3). FULL would also survive a power cut, at a write-speed cost; not needed for a 15-minute RPO |
| `wal_autocheckpoint` | 1000 pages (about 4 MB) | SQLite default | Keep unless P4 shows Litestream missing frames; then 0 with custom code and a WAL size alarm |
| `journal_size_limit` | Not set | SQLite default | Optional. Without it the `-wal` file keeps its largest size after a checkpoint (locally 4.2 MB beside a 1.8 MB database). Harmless; disk space only |
| FTS5 text search | On | db-connect (search index) | Keep |
| `secure_delete` | Off | SQLite default | Question for the DPO: deleted rows (for example form submissions) stay in free pages until overwritten or `VACUUM`. Backups keep them for 7 days anyway |
| `foreign_keys`, `mmap_size`, `cache_size` | Defaults | SQLite | Not relevant (no foreign keys) or not needed at this size |

Do not change `journal_mode` back to DELETE, and never use `immutable=1` on the live file (§4.6).

### 4.6 The database dashboard (owner's requirement: CRUD, export and import)

The owner wants a dashboard with **CRUD and export/import**, plus the agent's suggested features. The
requirement was first raised for MongoDB (m1-043) and now applies to SQLite.

**The problem with a plain database tool.** Each Apostrophe document is one JSON value in a `data`
column. A draft and its published copy are two rows, relationships are IDs inside the JSON, and the
search index lives in separate FTS5 tables. A raw edit in a generic tool skips schema validation,
permissions, draft/publish, version history and the search index. It also breaks the project rule
"content is accessed only through Apostrophe APIs" (ADR-0002, AGENTS.md). A raw writer on the live
file also adds a second writer that runs checkpoints Litestream does not control (§4.4).

**Proposal: two layers.** CRUD and import go through Apostrophe. Raw viewing is read-only.

| Layer | What | Tool | New dependency |
|---|---|---|---|
| **1. Assurer data dashboard** (CRUD, export, import) | An admin-only page in the Apostrophe admin bar. It lists every content type with counts, opens any document's JSON, and creates, edits, archives and restores documents. It exports a type or a selection, and imports into **drafts** for review. It also shows the database's health | A project module `modules/assurer-data-dashboard`, built only on Apostrophe APIs (`find()`, `insert`/`update`/`archive`, REST API). Export and import of content with media through **`@apostrophecms/import-export`** 3.7.1 (official, MIT, latest; every published advisory is fixed in 3.7.1, the version ADR-0002 §8 requires) | `@apostrophecms/import-export` only, after the dependency gate (license, advisories, review) |
| **2. Read-only data view** (raw tables) | Browse all tables, run read-only SQL with a time limit, export CSV and JSON | **Datasette** 0.65.5 or later on the server, normal mode (never `--immutable`), opened `mode=ro`, bound to `127.0.0.1`, reached over an SSH tunnel, with `datasette-auth-passwords`, and **no write plugins**. Fallback without a new tool: the `sqlite3` CLI with `file:…?mode=ro` over SSH | Datasette (Apache-2.0), after the dependency gate. It had two high advisories in 2026, both fixed in 0.65.5 |
| Whole-database export and import | Copy of the whole site | `VACUUM INTO` snapshot, `apos-db-dump` (portable) and `litestream restore`. Import of a whole database only into a **new, empty** file (AGENTS.md: restore is destructive) | None beyond Litestream |
| Raw CRUD on a copy | Investigations, for example on a restored snapshot | A desktop tool such as DBeaver Community (Apache-2.0) on a **downloaded snapshot**, never on the live file | Optional; dependency gate |

The agent advises against raw CRUD on the live file in any tool. If the owner still wants it, that is
an exception to ADR-0002 and needs its own decision.

**Features the agent suggests for layer 1:**

1. **Admin only**, behind Apostrophe's login, with no public route. Editors keep the normal UI.
2. **Audit log**: every create, edit, archive, export and import is recorded (who, when, what), and
   the record cannot be edited from the dashboard.
3. **Snapshot before every write batch and import**: an automatic `VACUUM INTO` copy, kept 7 days,
   so one click can undo a bad import.
4. **Import with a dry run first**: show what would be created or changed, then import into drafts.
   Nothing is published by an import. File size and document count limits; schema validation on
   every document.
5. **Safe exports**: password hashes (`aposUsersSafe`), sessions, bearer tokens and login-throttle
   data are never exported. Form submissions (personal data) are shown and exported only with an
   explicit choice and a warning. Exports can be downloaded only by an admin, and expire.
6. **Health panel**: database and `-wal` size, last Litestream sync and its lag, last snapshot, last
   restore drill date, disk space, and the SQLite and adapter versions.
7. **JSON view** with formatting, search across documents, and links back to the normal editor for
   each document.
8. **Archive instead of delete**, as AGENTS.md requires: the dashboard has no hard delete.

Layer 2 adds raw access for troubleshooting without any risk of writing. Its features are Datasette's
own: table browser, read-only SQL with a time limit, and CSV and JSON export.

Layer 1 is new code, so it is a separate task with its own tests and browser checks (as admin and as
an editor, who must not see it). Its size: about one medium task for viewing, CRUD and exports, and
one more for import with dry run and snapshot. The agent suggests building it after the proof of
concept (§7), because it relies on the health data and snapshots from that work.

### 4.7 What does not change

- **I1:** Hetzner Object Storage exists only in the EU, and the server would be in Singapore. The
  DPO still has to accept the EU copy (D-DB-2, D-DB-3).
- Media on the server disk with a nightly versioned copy (D-DB-3, owner's preference).
- RPO, RTO, retention and drills (D-DB-4).
- Disk encryption, nginx, SSH rules, reboots and the uptime check (hardening §12 choices 1, 3, 4, 5, 8).
- Portable exports, the sanitize-after-restore task (ADR-0002 §2, runbook §F), and one database per
  site.
- The dashboard requirement (owner, m1-043) stays and moves to SQLite (§4.6).

### 4.8 Vercel or Cloudflare Workers? (owner's question)

The owner asked: "can we host with vercel or cloudflare worker?" **Not for the app with SQLite.**
Option B needs one long-running Node process with the database file on a disk that persists. These
platforms run short-lived functions on many machines. The points below come from the agent's general
knowledge of these platforms; they were not checked against current vendor docs in this task.

| | Vercel (Functions) | Cloudflare Workers |
|---|---|---|
| Long-running Express server (Apostrophe) | No: request-scoped functions | No: request-scoped isolates |
| Persistent local disk for `data/<site>.db` | No: only a temporary `/tmp`, lost between instances | No file system |
| Native addon `better-sqlite3` | Not across instances; the file would not be shared | No: Workers do not load native Node addons |
| One writer, one file | No: many instances at once | No |
| SQLite offered by the platform | Through partners (not db-connect) | D1 is SQLite, but db-connect has no D1 adapter; it would be a parallel database (ADR-0002) |

Apostrophe's own guide warns against exactly this: "SQLite is also a poor fit when your hosting
platform uses an ephemeral filesystem … the site's content can be lost."

What these platforms *can* do, as a later and separate decision: **Cloudflare in front of the
server** (DNS, CDN cache for public pages and images, TLS, WAF and rate limits), with the app still
on the server. That puts a US company in the request path, so it needs the DPO (I1), and it changes
the proxy trust settings (`APOS_TRUST_PROXY`). Vercel adds nothing for this site.

**Shared web hosting (for example Hostinger's shared or "web hosting" plans)** is also out, even with
SQLite. m1-042 found from Hostinger's support pages that its Node.js apps on those plans have a
120-second request limit and no always-running background workers. Litestream must run all the time,
and the app must be one long-running process that owns the database file. **A VPS is needed** (any
provider: Hetzner, a Hostinger VPS plan, the owner's OCI server), run either with systemd or with
Docker Compose (D-DB-13). The provider and region still wait for the DPO (I1).

## 5. Restore and recovery with option B (not executed)

```sh
# Into a NEW, EMPTY path on the new or the same server; never over the live file.
litestream restore -o /srv/assurer/restore/vcl-assurer-group.db \
  -timestamp 2026-11-07T10:15:00Z s3://<bucket>/<site>/db
# Then point APOS_DB_URI at the restored file, start the app (it runs migrations),
# run the suites, and switch traffic. Restore the media copy from the same point.
```

- `-timestamp` uses only files created strictly before that time; `-txid` is inclusive. v0.5.12 and
  later have a dry run; v0.5.10 and later check integrity.
- Unlike a JSONL restore, Litestream restores the whole file, including the FTS5 search tables.
- A restore into a lower environment still needs `assurer-security:sanitize-after-restore`.

## 6. Questions for the owner

| # | Question | Agent's suggestion |
|---|---|---|
| Q1 | Engine for staging and production: A. stay with MongoDB (D-DB-8) · B. switch to SQLite with Litestream, subject to the proof of concept · C. SQLite with scheduled snapshots | **B, subject to test** |
| Q2 | If B or C: how the server runs it: systemd and packages · Docker Compose (app image plus Litestream) | systemd; keep the Docker image for demos only. Either is fine |
| Q3 | If B: accept §4.1 (one server, short restart on each deploy) and §4.4 (SSE-C only; object lock workaround) for now? | Yes, and decide on the nightly encrypted restic copy (B + C) after the test |
| Q4 | Next task: the local proof of concept in §7? | Yes |
| Q5 | Dashboard (§4.6): layer 1 (CRUD, export and import through Apostrophe, admin only) and layer 2 (read-only Datasette). Raw CRUD on the live file stays out | Yes to both layers; build layer 1 after the proof of concept; each tool through the dependency gate |

**Owner's answers (2026-11-07):** Q1 and Q3: "B. SQLite + Litestream (Recommended)". Q2: "I would
suggest keep docker along with regular and also suggest can we host with vercel or cloudflare
worker?": both ways stay supported, a Compose setup and a plain systemd setup, and the hosting
question is answered in §4.8. Q5: "Both layers (Recommended)". Q4: "Yes, next (Recommended)".

If the owner chooses B or C, the agent records the change at the architecture gate. It amends
ADR-0002 (or adds ADR-0004) and the register (D-DB-8 reopened, D-DB-12 and D-SEC-5 left on hold, a
new D-DB entry). It marks the MongoDB parts of the hardening runbook (§6, §7) and the single-container
runbook as superseded for staging, without deleting history. The m1-043 and m1-046 Docker files stay
for demos and as option A's evidence until the owner decides to remove them.

## 7. Proposed proof of concept (needs separate approval)

Litestream is a new tool, so installing it needs the owner's approval, a license check (Apache-2.0)
and an advisory check (none published on 2026-11-07). It needs no account or spending: Litestream can
replicate to a local directory (`file://`), so S3 waits for I1 and a separate approval.

Where: WSL2 on the owner's PC, with the database on the Linux file system (not `/mnt/c`), or the
Docker setup if the owner chooses Compose. A disposable copy of the local database only.

| # | Check | Pass when |
|---|---|---|
| P1 | App on SQLite with Litestream replicating to a local directory; lint, smoke, workflow and persistence suites | All pass; replication lag in seconds |
| P2 | Editor writes (UI and suites), then `kill -9` of the app and of Litestream, then restart | No error; replication resumes with no gap |
| P3 | `litestream restore -timestamp` to a moment between two known edits, into a new path | The first edit is there, the second is not; integrity check ok; all suites pass on the restored site |
| P4 | WAL and checkpoints under a write burst (for example 500 saves) and during `apos-db-dump` / `apos-db-restore` | WAL size stays bounded; Litestream reports no missed frames; no "database is locked" in the app |
| P5 | A `node app …` write task while the app runs | No lock errors; behaviour recorded |
| P6 | Event-loop delay with about 1,000 pages of demo content | Recorded; p99 below an agreed limit |
| P7 | `linux/arm64` | Only if an ARM machine or emulation is approved; otherwise NOT TESTED |

Out of scope: S3, SSE-C, object lock and Hetzner (a later test, like the PBM S3 tests), any server,
and real ARM hardware.

## 8. Evidence and its limits

| Fact | Source | Checked |
|---|---|---|
| db-connect 1.1.0 and apostrophe 4.34.0 are the latest releases | npm registry, GitHub `main` changelogs | 2026-11-07 |
| The adapter sets WAL and `busy_timeout = 5000` only | `node_modules/@apostrophecms/db-connect/adapters/sqlite.js` (`connect`) | Local, 2026-11-07 |
| better-sqlite3 12.11.1 bundles SQLite 3.53.2, built with `SQLITE_DEFAULT_WAL_SYNCHRONOUS=1` | `node_modules/better-sqlite3/deps/` | Local, 2026-11-07 |
| SQLite 3.53.2 includes the fix for the WAL-reset corruption bug (affected 3.7.0–3.51.2) | sqlite.org/wal.html, sqlite.org/changes.html | Web, 2026-11-07 |
| Apostrophe docs on SQLite in production | apostrophecms.com/docs/guide/choosing-a-database.html, apostrophecms.com/guides/choosing-a-db-for-your-cms-project | Web, 2026-11-07 |
| Litestream encryption, retention, S3-compatible endpoints, checkpoints | litestream.io/reference/config/, /guides/s3-compatible/, /how-it-works/, /tips/ | Web, 2026-11-07 |
| Litestream object lock issues | github.com/benbjohnson/litestream issues #891, #1607 | Web, 2026-11-07 |
| Litestream v0.5.0 restore regressions | mtlynch.io/notes/hold-off-on-litestream-0.5.0/ | Web |
| SQLite usage guidance and `synchronous` | sqlite.org/whentouse.html, sqlite.org/pragma.html, sqlite.org/cves.html | Web, 2026-11-07 |
| LiteFS status | community.fly.io/t/what-is-the-status-of-litefs/23883 | Web, partly verified |
| Hetzner Backups | docs.hetzner.com/cloud/servers/backups-snapshots/overview/ | Web; crash consistency not stated |
| `mode=ro` is safe on a live WAL file; `immutable=1` can give wrong results or `SQLITE_CORRUPT` | sqlite.org/uri.html, sqlite.org/wal.html | Web, 2026-11-07 |
| `@apostrophecms/import-export` 3.7.1 is the latest (MIT); all published advisories affect `< 3.7.1` or older | npm registry; GitHub advisory API | 2026-11-07 |
| Datasette 0.65.5 (Apache-2.0); GHSA-w3hf-fcg5-p4cc and GHSA-h547-rmjf-5m2m fixed by 0.65.5 | github.com/simonw/datasette/releases, /security/advisories | Web, 2026-11-07 |
| Desktop tools (DBeaver, Beekeeper, DB Browser, Letos) cannot open the live file safely over the network | sqlite.org/wal.html ("WAL does not work over a network filesystem") | Web, 2026-11-07 |

Not verified: the exact v0.5.18 release date and its checksum option name; Litestream's behaviour
when the app runs a `TRUNCATE` checkpoint; better-sqlite3 prebuilds on the target `arm64` image;
whether Hetzner backups are crash-consistent; whether two Apostrophe processes can safely share one
SQLite file. The research was agent-executed and is not human approval.
