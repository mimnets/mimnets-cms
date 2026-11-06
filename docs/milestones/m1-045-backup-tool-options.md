# m1-045 options paper: MongoDB continuous backup tool

| | |
|---|---|
| **Status** | Agent research, 2026-11-06. **Nothing was installed or run.** No tool in this paper has been tested on this project. **Owner's decision (2026-11-06, D-DB-12 in the [decision register](../engineering/decision-register.md)): PBM as the direction, subject to the proof of concept in §6.** That approves no install, account or spending |
| **Decides** | The tool that meets the database targets in D-DB-4 on one container (D-DB-10 (b)) |
| **Does not decide** | The storage provider and region (D-DB-2, D-DB-3, waiting for the DPO's answer to I1), media backup, the server, or any install, account or spending |
| **Related** | D-DB-4 · D-DB-8 · D-DB-10 · [hardening runbook](../runbooks/server-hardening-and-patching.md) §6, §9 · [backup protection plan](../runbooks/backup-protection-plan.md) §2 · [single-container runbook](../runbooks/docker-single-container.md) |

## 1. Recommendation

**Percona Backup for MongoDB (PBM) 2.17.0, logical backups with oplog slicing, subject to the local
proof of concept in §6.** The owner accepted this recommendation; §4 records what comes with it.

It is the only candidate that gives real point-in-time recovery on MongoDB Community 8.0 with a
documented, maintained interface. It costs nothing in license fees, but it has **three conflicts with
our current rules and one vendor caveat** (§4). Those need the owner's decision. If they are not
acceptable, the fallback is scheduled `mongodump` (option C), which fits the security rules better
but gives no recovery between dump points.

## 2. Requirements

| # | Requirement | From |
|---|---|---|
| R1 | Database RPO ≤ 15 minutes, with PITR | D-DB-4 |
| R2 | PITR retention of 7 days | D-DB-4 |
| R3 | RTO ≤ 4 hours, proved by a quarterly restore drill | D-DB-4 |
| R4 | Works with MongoDB Community 8.0.x on a one-member replica set, with `javascriptEnabled: false` | D-DB-8, §12 choices 6 and 7 |
| R5 | Works inside or next to the one container, on `linux/amd64` and `linux/arm64`, with MongoDB unpublished | D-DB-10 (b), m1-041 |
| R6 | Backups encrypted, with their own credentials and key custody | Backup protection plan §2 |
| R7 | Backups leave the server | Hardening runbook §9 |
| R8 | License and advisory check; affordable for a team with limited ops | AGENTS.md, I3, I4 |

## 3. Candidates

| | A. PBM 2.17.0 | B. WAL-G 3.0.9 | C. `mongodump --oplog` on a schedule | D. Ops Manager or Cloud Manager | E. Hetzner Backups or disk snapshots |
|---|---|---|---|---|---|
| **PITR to any moment** | Yes, oplog slices | Yes, oplog archive | **No**, only to dump points | Yes | No |
| **RPO ≤ 15 min** | Yes on paper: a slice covers 10 minutes by default, and it can be shortened | Yes on paper | Only if every 15-minute run succeeds, and a full dump each time | Yes | **No**: daily |
| **MongoDB 8.0** | Documented for Community | Not stated in the docs | Part of MongoDB's tooling; already in our image | Yes | Not applicable |
| **Vendor status** | Maintained; last release 2026-10-15 | Docs: "Interface of MongoDB features is currently unstable" | Maintained; **the schedule, upload and cleanup would be our own scripts** | Maintained | Maintained; crash-consistent |
| **License** | Apache-2.0 | Apache-2.0 | Apache-2.0 | Ops Manager: Enterprise Advanced subscription outside evaluation and development. Cloud Manager: paid service | Paid Hetzner feature |
| **GitHub advisories** | None found | One, fixed in 1.1 (CVE-2021-38599) | One, fixed in 100.2.0 (CVE-2020-7924) | Not checked | Not applicable |
| **Database privileges** | Broad (§4.1) | Not checked | `backup` role, as runbook §6 plans (to confirm) | Not checked | None |
| **Delete rights on storage** | Needed (§4.2) | Not checked | Not needed by the backup job | Not applicable | Not applicable |
| **Verdict** | **Recommended** | Rejected: unstable interface on a critical path | **Fallback** | Rejected: cost, and backup data leaves for a vendor service | Rejected for R1. Stays a server rebuild aid (runbook §9) |

MongoDB Atlas backup is not a candidate: it does not back up a self-hosted server, and D-DB-8 chose
self-hosting.

## 4. What the owner has to accept with PBM

### 4.1 Conflict: the PBM user is far more powerful than the runbook planned

Runbook §6 plans `assurerBackup` with the `backup` role only. PBM's documentation requires `backup`,
`restore`, `clusterMonitor`, `readWrite` on `admin`, and a custom role with **`anyAction` on any
resource**. In practice the account can do anything in MongoDB, and it sits in the same container as
the app.

Mitigation: `pbm-agent` runs as its own OS user, its credentials are readable by that user only, and
the app's environment never contains them. This limits the damage from an app compromise. It does
not limit anything once an attacker has root in the container.

### 4.2 Conflict: storage credentials can delete backups

Backup protection plan §2 asks for write-only credentials. PBM needs list, get, put **and delete**,
because it cleans up its own backups. An attacker who reaches those credentials could delete them.

Mitigation: a bucket with versioning and object lock, so a delete leaves the locked versions in place.
Hetzner supports both, but object lock must be turned on when the bucket is created. PBM on a locked
bucket is **not verified**, and the retention period adds to what is stored and paid for.

### 4.3 Conflict: encryption depends on a key that must be kept elsewhere

Hetzner Object Storage does not encrypt objects by default. The route its documentation names is
SSE-C, where we supply the key, and PBM's `s3` storage type has a setting for it.

- **The key:** if it is lost, the backups are lost. It needs the plan's custody rules (two named
  custodians, an offline copy).
- **Where PBM keeps it:** PBM stores its configuration in `admin.pbmConfig`. Whether that includes the
  key and storage credentials, and whether they end up in a backup, is **not verified**.
- **A possible trap:** PBM's docs say to switch to the `minio` storage type if `s3` gives errors on an
  S3-compatible service, and the configuration reference lists no SSE-C setting for `minio`. If `s3`
  does not work with Hetzner, we may lose encryption.
- **No client-side encryption:** PBM's reference lists only server-side options, so the provider
  handles the key during each upload. The plan's client-side rule covers portable exports, which stay
  separate (§5).

### 4.4 Caveat: Percona describes a single-node replica set as being for testing

PBM's docs say: "For testing, you may deploy it on a single-node replica set". I found no statement
that it is supported or unsupported in production. Our design has one member because of the
one-server, one-container choice. A replica set also needs other members for high availability, and
this design has none, whichever tool is used.

### 4.5 Other limits

- **Logical backups only.** Physical, incremental and snapshot backups need Percona Server for
  MongoDB, not Community. Restores are slower, so R3 has to be measured. The database is small today.
- **PITR pauses during a base backup.** PBM stops slicing while a logical backup runs and resumes
  afterwards, so the real RPO grows during that window. To be measured.
- **It does not schedule itself.** PBM has no backup scheduler or automatic retention. Base backups
  and `pbm cleanup --older-than=7d` need a timer. Because the image has no cron, a systemd timer on the
  host running `docker exec` is the likely design.
- **Retention can run past 7 days.** PBM keeps the base backup and slices needed for recovery, which
  matters for personal-data retention (D-FORM-2).
- **Memory.** PBM asks for at least 1 GB of RAM per node and recommends 2 CPU cores, in a container
  that already gives MongoDB a 1 GB cache and runs the app. This affects the server size and budget
  (I3).
- **Version lock.** All agents and the CLI must be the same version. This is simple with one image.

## 5. What PBM does not solve

- **Silent failure.** The external uptime check (§12 choice 8) sees only the website. If `pbm-agent`
  stops, the site keeps working and the RPO is lost without any sign, and the weekly check in runbook
  §10 could miss up to a week. **R1 needs an alert on backup status.** No alert service is chosen yet.
- **Media.** PBM does not back up `uploads/`. A restored database can point to files newer than the
  last nightly copy (RPO 24 hours, D-DB-4).
- **Portable exports.** Encrypted `apos-db-dump` exports at each release and monthly are still needed.
  They need the `age` approval in the backup protection plan.
- **Where backups go.** Hetzner Object Storage is in the EU only, and the server is planned for
  Singapore. The [question for the DPO](../engineering/reports/2026/11/2026-11-04-m1-038-hosting-inputs.report.md#question-for-the-dpo-i1)
  (I1) covers this, so the target waits for the answer. PBM can also write to other S3-compatible
  services.
- **Restore safety.** `pbm restore` replaces data. AGENTS.md still applies: restore only into a new,
  empty database, with explicit approval. A drill must not share write access to the production
  bucket.
- **ADR-0002 §5** still names PostgreSQL PITR as the primary backup. It needs a separate update with
  owner approval. This paper does not change it.

## 6. Proposed proof of concept (needs separate approval)

Local, disposable and on the owner's PC. It uses a new test image and new volumes, stores backups on
local disk first, and leaves `assurer-site-1` and its volumes alone. No account or spending.

| # | Test | Pass condition |
|---|---|---|
| P1 | Install PBM 2.17.0 in a test image, pinned, with its SBOM scanned | Runs with `javascriptEnabled: false` on one member; no unaccepted high or critical finding |
| P2 | Base backup and slicing | `pbm status` shows continuous PITR coverage |
| P3 | RPO | Newest recoverable moment stays within 15 minutes of now, including during a base backup |
| P4 | PITR restore into a **new, empty** container | Content from just before a test delete is back; `migrate` and all suites pass |
| P5 | RTO | Measured time from start to a working site, on realistic data |
| P6 | One container | Agent starts after MongoDB, survives a container restart, and an agent crash does not take the site down |
| P7 | Separation | The app's user cannot read the PBM credentials |
| P8 | Secrets | Whether a credential or key appears in `admin.pbmConfig`, `pbm config --list`, logs or the backup |

Three more tests need S3 storage, so they need a separate approval for an account and a small spend:
Hetzner `s3` type with SSE-C (§4.3), PBM with object lock and versioning (§4.2), and cleanup against a
locked bucket.

Apostrophe check, already done by source search: its modules use no collection renames and no
time-series collections, which are PBM's replay limits. They use ordinary TTL indexes. This needs P4
to confirm it.

## 7. Evidence and its limits

**Verified 2026-11-06:**

- Licenses from each project's license file.
- Releases and advisories from the public GitHub API: the repository advisories and the Go ecosystem
  in the global advisory database.
- Packages `2.17.0-1.noble` for `amd64` and `arm64` in Percona's apt repository. Ubuntu 24.04 is the
  base of the current image (read from the running container, without changing it).
- A published SHA-256 file for the `x86_64` tarball. The `aarch64` and `arm64` tarball URLs I tried
  returned 404, so the image would install from apt.

**Not verified:**

- Anything about running PBM. No tool was run.
- PBM on Hetzner Object Storage.
- That "no advisory" means no vulnerability: `npm audit` does not cover these tools, GitHub lists only
  what is published there, and the National Vulnerability Database was not searched. PBM's bundled Go
  libraries need the SBOM scan in P1.
- Hetzner storage prices for Singapore or the EU.
- Percona's platform lifecycle page for Ubuntu 24.04. The repository has the packages, but the page
  itself was not read.

## 8. Sources

Retrieved 2026-11-06. The PBM pages are from `docs.percona.com/percona-backup-mongodb/`.

1. `details/versions.html` (MongoDB versions per PBM release)
2. `latest/details/deployments.html` (replica sets, single-node wording)
3. `latest/features/backup-types.html` (Community supports logical and selective only)
4. `features/point-in-time-recovery.html` (10-minute slices, `pitr.oplogSpanMin`)
5. `install/configure-authentication.html` (roles, localhost connection)
6. `details/storage-configuration.html` (storage types, list/get/put/delete)
7. `latest/reference/configuration-options.html` (SSE settings)
8. `latest/features/known-limitations.html` · `latest/usage/restore.html` · `latest/usage/delete-backup.html` · `latest/usage/schedule-backup.html` · `system-requirements.html` · `latest/details/control-collections.html` · `latest/release-notes/2.17.0.html`
9. `github.com/percona/percona-backup-mongodb` · `repo.percona.com/pbm/apt/` · `downloads.percona.com/downloads/percona-backup-mongodb/`
10. `wal-g.readthedocs.io/MongoDB/` · `github.com/wal-g/wal-g`
11. `github.com/mongodb/mongo-tools`
12. `mongodb.com/products/self-managed/enterprise-advanced/ops-manager` · `mongodb.com/docs/cloud-manager/core/pricing/`, and search summaries of MongoDB's licensing forum posts
13. `docs.hetzner.com/storage/object-storage/faq/general/` · `docs.hetzner.com/storage/object-storage/supported-actions/`
