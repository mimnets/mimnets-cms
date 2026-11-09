# Runbook: PBM backup and restore (staging container)

| | |
|---|---|
| **Status** | **Draft; run on the owner's PC only** (`m1-055`, 2026-11-08, agent-executed): see §7 for what was run and what was not. Not run on a server |
| **Applies to** | The staging site container ([staging container runbook](./staging-container.md)): MongoDB 8.0.34, one-member replica set `rs0`, Percona Backup for MongoDB (PBM) 2.17.0 |
| **Decisions** | D-DB-4 (RPO ≤ 15 min, RTO ≤ 4 h, PITR 7 days) · D-DB-12 (PBM, final after the S3 tests) · D-SEC-5 (PBM dependency findings accepted until a fixed release) · ADR-0004 Decision 3 |
| **Related** | [m1-046 PBM results](../milestones/m1-046-pbm-poc-results.md) · [backup protection plan](./backup-protection-plan.md) · [hardening runbook](./server-hardening-and-patching.md) §6, §9 · [backup and restore (portable export)](./database-backup-and-restore.md) |

> **The backups are on the same server as the database.** PBM writes to the container's `backups`
> volume only, until the S3 storage passes its tests (D-DB-12), which need an account and spending
> the owner has not approved. A lost or broken server loses the backups with it. Until then, the
> portable export ([backup and restore runbook](./database-backup-and-restore.md)) copied off the
> server is the only off-site database copy.

All commands run from the repository root on the server. `pbmc` is a wrapper in the image that runs
`pbm` as the `pbm` user with its credentials; never pass a connection string on the command line.

```sh
S="docker compose -f docker/staging/compose.yaml"
```

## 1. What runs by itself

| What | How | Where to look |
|---|---|---|
| `pbm-agent` | started by the entrypoint as the `pbm` user; restarted after 5 s if it stops, without stopping the site | `$S exec site pbmc status` (Agents) |
| Point-in-time oplog slices | PBM, every 5 minutes (`pitr.oplogSpanMin: 5`) | `pbmc status` (PITR chunks) |
| Base backup | 2 minutes after each container start, then every `ASSURER_BACKUP_INTERVAL_HOURS` (default 24); `0` turns it off | `$S logs site \| grep 'Base backup'` |
| Retention | after each base backup: `pbm cleanup --older-than 8d` (`ASSURER_BACKUP_RETENTION`), which removes backups and oplog slices older than that while keeping what PITR needs | `pbmc list` |

With the 5-minute slice, the newest recoverable moment trails by at most about 5 minutes plus the
upload, and by *slice + base backup duration* while a base backup runs (m1-046 results §3.3). The
RPO of 15 minutes holds while a base backup takes 10 minutes or less. Measure it with the real
content (§7).

**No alert exists yet.** A failed backup only shows in the log line `ERROR: base backup failed` and
in `pbmc status`. Until an alert is chosen (open in D-DB-12), check weekly (hardening runbook §10).

## 2. Everyday commands

```sh
$S exec site pbmc status                 # agents, PITR state, latest backups and their size
$S exec site pbmc list                   # backups and the PITR time ranges
$S exec site pbmc backup --wait          # a base backup now, for example before a release
$S exec site pbmc logs --tail 50         # PBM's own log
```

Before each release and before any migration that changes data, take a base backup and check that
it shows as `done` in `pbmc list`.

## 3. Restore drill (into a new, empty container)

A drill restores a copy of the backups into a separate container with its own volumes. It never
writes to the running site. **Run it only with the owner's approval** (AGENTS.md: restore is
destructive; restore into a new, empty database only).

1. Choose the time to restore to, from `pbmc list` (a time inside a PITR range, UTC).
2. Copy the secrets, media and backups into the drill's own volumes, and start it empty in restore
   mode (MongoDB and `pbm-agent` only):

   ```sh
   $S --profile restore run --rm restore-copy
   $S --profile restore up -d --no-deps restore
   $S exec restore pbmc config --force-resync --wait
   $S exec restore pbmc restore --time=YYYY-MM-DDTHH:MM:SS --yes --wait
   ```

   For a snapshot without PITR: `pbmc restore <backup name> --yes --wait`.
3. Start the drill container in site mode. It runs the migrations and the app, over plain HTTP on
   the server's loopback only (`127.0.0.1:3044`), with no backup schedule:

   ```sh
   ASSURER_RESTORE_MODE=site $S --profile restore up -d --no-deps restore
   ```

   Reach it through an SSH tunnel (`ssh -L 3044:127.0.0.1:3044 <server>`), check the content at the
   chosen time, log in, and record the time from step 1 to a working site (RTO ≤ 4 h).
4. Remove the drill and its volumes:

   ```sh
   $S --profile restore rm -s -f restore
   docker volume rm assurer-staging_restore-mongo-data assurer-staging_restore-secrets \
     assurer-staging_restore-uploads assurer-staging_restore-app-data assurer-staging_restore-backups
   ```

   Never run `down -v` on the staging project: it deletes the site's own volumes too.

## 4. Real recovery (the site's server is lost)

Until the S3 storage exists, a lost server means the PBM backups are lost too; recover from the
latest portable export instead ([backup and restore runbook](./database-backup-and-restore.md)).
Once the backups are off the server:

1. Build a new server (hardening runbook) and the stack with **empty** volumes.
2. Put the site's secrets back from the secret store into the new `secrets` volume
   (`mongo-*-password`, `mongo-keyfile`, `session-secret`; the backup holds the database users with
   those passwords). The secret store is not designed yet (m1-046 results §4).
3. Start the site container with `ASSURER_MODE=restore`, restore as in §3 step 2, then start it
   again in site mode, then start nginx.
4. Restore the media from its own backup, from the same quiet point (ADR-0002 Decision 6).

## 5. Security notes

- The `pbm` database user has `anyAction` through the `pbmAnyAction` role (Percona's documented
  roles; accepted under D-DB-12). Its password is only in `pbm-agent`'s environment and in the
  root-only secrets volume.
- PBM stores its storage configuration, including any S3 credentials and SSE-C key, in plain text
  in `admin.pbmConfig`, which every backup contains (m1-046 results §3.2). With filesystem storage
  there is no credential in it. This matters again for the S3 tests.
- D-SEC-5: three high findings in PBM 2.17.0's Go libraries are accepted until a fixed release. Scan
  the image again before staging use and at each PBM update (§7).

## 6. Updating PBM

Change `PBM_VERSION` and both `PBM_SHA256_*` values in
[`docker/staging/Dockerfile`](../../docker/staging/Dockerfile) from Percona's repository index,
rebuild, scan, take a base backup with the old version, then deploy. Read Percona's release notes for
changes to the backup format first. Updating is a dependency change and needs approval (AGENTS.md).

## 7. Verification

Agent-executed on the owner's PC (`linux/amd64`), 2026-11-08, with demo-sized data (backups of 71 KB
and 108 KB). Full results: [m1-055 report](../engineering/reports/2026/11/2026-11-08-m1-055-staging-image.report.md).

| Check | Result |
|---|---|
| Scheduled base backup 2 minutes after a start, over MongoDB TLS | PASS (6–7 s) |
| `pbm cleanup --older-than 8d` accepted | PASS (nothing old enough to delete; **removal itself not tested**) |
| PITR restore into a new, empty container to a time after the newest base backup: a change published after that backup was present | PASS; 60 s from the copy step to a working site |
| Suites on the restored site | Persistence 7/7, workflow 15/15; smoke 17/18, the one failure being the demo notice check, expected because the drill runs with `APOS_DEMO_SITE=0` |
| `pbm-agent` restart after a kill | PASS |
| Newest recoverable moment | One reading, 4.6 minutes behind. **Not an RPO measurement** |
| Scan (D-SEC-5) | The same three PBM findings; other findings under D-SEC-8 |
| `m1-056`, image without `gosu`, in one layer: scheduled base backup; PITR restore into a new, empty container; §3 step 4 with the test project's volume prefix | PASS; 85 s to a working site, workflow 15/15, persistence 7/7, smoke 17/18 (the same expected failure) |

**Not tested:** real data sizes, so RPO during a base backup and RTO are unproven; §4; a failed backup's log line; `linux/arm64`; S3 storage.
