# m1-046 results: local proof of concept for Percona Backup for MongoDB (PBM)

| | |
|---|---|
| **Status** | Agent-executed test, 2026-11-07, on the owner's Windows PC (Docker Desktop, `linux/amd64` native; `linux/arm64` under emulation). Local and disposable: backups on local disk, no account, no spending, no server. Containers and volumes removed afterwards. **Not a human approval.** Owner's decisions on the results: §6 |
| **Tests** | P1–P8 from the [m1-045 options paper §6](./m1-045-backup-tool-options.md#6-proposed-proof-of-concept-needs-separate-approval) |
| **Files** | [`docker/pbm-poc/`](../../docker/pbm-poc/): `Dockerfile`, `compose.yaml`, `pbm-entrypoint.sh`, `pbmc.sh`, `pbm-config.yaml`. The demo image files are unchanged |
| **Related** | D-DB-4 · D-DB-10 · D-DB-12 · [single-container runbook](../runbooks/docker-single-container.md) · [m1-046 report](../engineering/reports/2026/11/2026-11-07-m1-046-pbm-poc.report.md) |

## 1. Summary

PBM 2.17.0 works with this project's one container: MongoDB 8.0.34 Community, a one-member replica
set, access control, a key file and `javascriptEnabled: false`. A point-in-time restore into a new,
empty container brought back content from just before a test change, cut off at the right moment, and
all suites passed on the restored site.

Three results matter for the final choice:

1. **Three high findings in PBM's own Go libraries** (§3.1). All are denial of service and none has a
   fixed PBM release yet. The owner accepted them until a fix (D-SEC-5).
2. **PBM keeps storage credentials and the SSE-C key in plain text in `admin.pbmConfig`, and every
   backup contains that collection** (§3.2). `pbm config --list` masks them; the database does not.
3. **The RPO depends on how long a base backup takes** (§3.3). Slicing pauses while a base backup
   runs, so the 15-minute RPO holds only while a base backup finishes in about 5 minutes, unless the
   slice length is shortened.

## 2. Results

| # | Test | Pass condition (options paper §6) | Actual result | Status |
|---|---|---|---|---|
| P1 | Install PBM 2.17.0, pinned, SBOM scanned | Runs with `javascriptEnabled: false` on one member; no unaccepted high or critical finding | Installed from Percona's noble repository, pinned by version and SHA-256, built and run on `amd64` and on `arm64` (emulated, §4). `getCmdLineOpts` shows `javascriptEnabled: false`, `authorization: enabled`. Docker Scout: PBM adds **3 high, 0 critical** findings (§3.1). The other findings were already in the demo image (§3.1) | PASS with the 3 highs **accepted by the owner until a fix** (D-SEC-5) |
| P2 | Base backup and slicing | `pbm status` shows continuous PITR coverage | Base backup of the demo database: 87.83 KB in 6 s. PITR coverage stayed one unbroken range, `11:35:48–12:56:12` (80 minutes), through an agent kill, a base backup and a container restart | PASS |
| P3 | RPO | Newest recoverable moment stays within 15 minutes of now, including during a base backup | See §3.3. Largest lag seen: **666 s (11.1 min)**, right before the first slice after the agent kill (43 samples every 30 s, 11:38–12:00 UTC, one disposable write a minute; the monitor was stopped early by Claude Code because the PC ran low on memory). During a base backup PBM flushed a slice at the start and paused for the 8 s the backup took | PASS on demo-sized data; the limit in §3.3 applies |
| P4 | PITR restore into a new, empty container | Content from just before a test delete is back; `migrate` and all suites pass | Marker piece created 11:37:54Z and archived 11:38:37Z on the source. Restore to 11:38:20Z into a new container with an empty database: the marker is back and not archived; none of the 15 later pieces (first at 11:39:03Z) came back. `migrate` ran at start. Lint clean; smoke 18/18; workflow 15/15; container restart, then persistence 7/7 | PASS |
| P5 | RTO | Measured time from start to a working site, on realistic data | `pbm restore` 18 s; restore start to HTTP 200 on the restored site 44 s. The database was about 0.6 MB, so this is not realistic data (§4) | Measured on demo data only |
| P6 | One container | Agent starts after MongoDB, survives a container restart, and an agent crash does not take the site down | Agent starts once MongoDB is primary. `SIGKILL` of `pbm-agent`: the site answered 200 throughout; the agent was back in about 5 s and slicing resumed from the last slice, with no gap (about 60 s to clear the stale lock). Container restart: site 200 after 13 s, slicing resumed from the last slice end, no gap | PASS |
| P7 | Separation | The app's user cannot read the PBM credentials | As the app's OS user (`assurer`): reading the PBM password file, `pbm-agent`'s environment and `/backups` are all denied; the app's environment has no PBM variable. The app's database user `assurerApp` is refused on `admin.pbmConfig` and `admin.pbmBackups`. Root in the container can still read everything | PASS (within the limit in options paper §4.1) |
| P8 | Secrets | Whether a credential or key appears in `admin.pbmConfig`, `pbm config --list`, logs or the backup | Filesystem storage: no plaintext password or secret in the logs, `pbm config --list` or an uncompressed backup. The backup holds SCRAM hashes of the 3 database users. **With a fake S3 configuration** (dummy values, nothing listening): `pbm config --list` masks keys as `***`; **`admin.pbmConfig` stores the access key, secret key and SSE-C key in plain text**; nothing in the logs. Every backup includes `admin.pbmConfig` (§3.2) | Finding, see §3.2 |

The three S3 tests in options paper §6 (Hetzner SSE-C, object lock, cleanup on a locked bucket) were
**not run**. They need an account and a small spend, which are not approved.

## 3. Findings for the owner

### 3.1 Three high findings in PBM's dependencies

Docker Scout compared the PBM image with the same image without PBM. PBM adds:

| Package in PBM 2.17.0 | Finding | Fixed in | What triggers it | Agent's view of exposure here |
|---|---|---|---|---|
| `github.com/klauspost/compress` 1.20.1 | CVE-2026-116591, high (8.7): integer overflow, panic on a crafted two-block frame | 1.20.2 | Crafted compressed data | PBM decompresses backups during a restore. Someone who can write to the backup storage could make a restore crash. It does not leak or change data |
| `github.com/go-jose/go-jose/v4` 4.1.5 | CVE-2026-116587, high (7.5): CPU exhaustion on a crafted RSA JWK | 4.1.6 | A crafted key in a JWK | Used by cloud identity libraries (GCS, Azure). Not on the S3 or filesystem path, as far as the agent can tell; not verified in PBM's source |
| `golang.org/x/net` 0.60.0 | CVE-2026-78661, high (7.5): quadratic HTML parsing | 0.62.0 | Crafted HTML | PBM does not parse HTML from untrusted sources, as far as the agent can tell; not verified in PBM's source |

All three are denial of service. None has a fixed PBM release on 2026-11-07 (2.17.0 is the latest).
**Owner's decision (2026-11-07, D-SEC-5): accepted until a fix.** Upgrade PBM when Percona ships a
release with the fixed libraries, and scan again before any staging use.

Already in the demo image, not from PBM: 4 critical and 30 high findings in the Go standard library
1.23.12 and 1.24.6 (MongoDB's own tools in `mongo:8.0.34`), plus `apt`, `async` and `js-yaml`. They
belong to the base image check in the single-container runbook §6, not to this test.

### 3.2 Storage credentials and the SSE-C key are stored in plain text, and backed up

With S3 storage, `admin.pbmConfig` holds the access key, the secret key and the SSE-C key in plain
text. Anyone who can read that collection (the `pbm` user, any user with read on `admin`, root in the
container, or anyone with a copy of the database files) gets them. Every PBM backup includes
`admin.pbmConfig`: the filesystem test showed the full document in each backup. So **with S3 storage,
each backup would contain the keys to its own storage and its own SSE-C key**. That was inferred from
the filesystem run; it was not run against real S3.

This weakens options paper §4.3 (encryption with SSE-C): whoever gets one backup gets the key to read
the others, and the storage credentials to delete them (§4.2). Possible mitigations, none tested:
PBM's Vault support for credentials (`credentials.vault` exists in the stored document), storage
credentials scoped to one bucket with object lock, and treating every backup as a secret, as AGENTS.md
already asks.

### 3.3 RPO and base backups

- Between base backups, the newest recoverable moment trails by up to one slice (10 minutes) plus
  the upload. The largest lag seen was 666 s (11.1 min), which included the agent kill and its 60 s lock recovery.
- When a base backup starts, PBM closes the current slice and pauses slicing until the backup ends.
  So during a base backup the lag is roughly *slice length + backup duration*. The demo backup took
  8 s; a real one is longer. **For RPO ≤ 15 minutes, a base backup must finish within about 5 minutes,
  or the slice length must be shorter** (`pitr.oplogSpanMin`, for example 5).
- After a container stop, the slice in progress is not written until the agent is back. The oplog
  covers it, so nothing is lost unless the disk is lost at the same time.

## 4. Limits of this test

- **Data size.** About 0.6 MB of demo content. RTO and the backup duration in §3.3 need a measurement
  with realistic data (the size of the migrated corporate content).
- **Local disk only.** No S3, no SSE-C, no object lock. The filesystem storage lives on the same
  machine as the database, which is not a backup.
- **Restores.** One logical PITR restore on `linux/amd64` (P4). On `linux/arm64`, under emulation on
  this PC: both images built with Compose (341 s), the site started (HTTP 200 after 398 s), `pbm-agent`
  2.17.0 reported `linux/arm64`, a base backup took 9 s, a snapshot restore into a new, empty `arm64`
  container took 22 s, and smoke passed 18/18 on the restored site. No PITR restore and no RPO
  measurement on `arm64`. **Not run on real ARM hardware.**
- **Cross-building needs the `build-only` profile.** Without it, Compose builds the base image for the
  host's platform, and the `arm64` PBM package then fails to install. A native build on an `arm64` host
  does not need it. Not run on real ARM hardware.
- **Restore needs the database secrets.** The backup contains the database users with the source's
  passwords, so the restored site needs the source's secrets (`mongo-*-password`, the key file). The
  test copied them from the source volume. A real rebuild must get them from the secret store, which
  is not designed yet.
- **No scheduler, retention or alert.** Not part of P1–P8. Still open (options paper §4.5, §5).
- **Agent-executed**, with debug-level PBM logs (PBM's default in this setup).

## 5. How to run it again

From the repository root, with Docker running. The test password lives outside the repository.

```sh
export ASSURER_ADMIN_PASSWORD=...   # any test value, first start only
docker compose -f docker/pbm-poc/compose.yaml up -d --build site       # http://localhost:3043
docker exec assurer-pbm-poc-site-1 pbmc backup --wait                    # base backup
docker exec assurer-pbm-poc-site-1 pbmc status                           # PITR coverage
```

Restore into a new, empty container (only with the owner's approval; AGENTS.md):

```sh
docker compose -f docker/pbm-poc/compose.yaml --profile restore run --rm restore-copy
docker compose -f docker/pbm-poc/compose.yaml --profile restore up -d --no-deps restore
docker exec assurer-pbm-poc-restore-1 pbmc config --force-resync --wait
docker exec assurer-pbm-poc-restore-1 pbmc restore --time=YYYY-MM-DDTHH:MM:SS --yes --wait
PBM_POC_RESTORE_MODE=site docker compose -f docker/pbm-poc/compose.yaml --profile restore up -d --no-deps restore   # http://localhost:3044
```

For `linux/arm64` on an `amd64` PC, build with the `build-only` profile so that the base image follows
the platform, and run it under its own project name so it gets its own volumes:

```sh
export DOCKER_DEFAULT_PLATFORM=linux/arm64 PBM_POC_TAG_SUFFIX=-arm64
docker compose -f docker/pbm-poc/compose.yaml --profile build-only build site
docker compose -f docker/pbm-poc/compose.yaml -p assurer-pbm-poc-arm64 up -d --no-build site
```

Remove a project with `docker compose -f docker/pbm-poc/compose.yaml [-p <project>] --profile restore down -v`; this deletes the test's volumes and backups for good.

## 6. Owner's decisions on the results (2026-11-07)

| Question | Owner's answer | Recorded as |
|---|---|---|
| Accept the 3 high findings in §3.1? | "Accept until a fix (Recommended)" | D-SEC-5 |
| What D-DB-12 says now | "PBM, S3 tests still due (Recommended)": PBM confirmed for local use; final after the S3 tests (SSE-C, object lock, credential handling such as Vault), which need an account and spending approved later | D-DB-12 note |
| Retry `arm64` | "Retry now (Recommended)" | §4 |
| Clean-up | "Remove all PoC (Recommended)": containers and volumes removed, images kept | m1-046 report |
