# Runbook: Database and media backup and restore

| | |
|---|---|
| **Status** | Draft. **Verified 2026-10-19 (`m0-003`):** SQLite `apos-db-dump`, `apos-db-restore` into a fresh file, and `migrate` rebuilding search. **Not executed:** the `tar` media steps and all PostgreSQL steps (pending the acceptance test in ADR-0002 §6). **m1-032 (2026-11-02):** `assurer-security:sanitize-after-restore` added (§B, §F). Verified on throwaway SQLite databases only, not on PostgreSQL. **m1-052 (2026-11-08):** staging and production run MongoDB 8.0.x with PBM ([ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md), accepted 2026-11-08). The PostgreSQL steps here are superseded for those environments; §A (local SQLite) and the JSONL steps still apply. PBM procedures: [m1-046 results](../milestones/m1-046-pbm-poc-results.md), not yet a runbook. |
| **Decision** | [ADR-0002](../architecture/decisions/ADR-0002-database-strategy.md) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) |
| **Audience** | Operators with access to the target environment's secrets |

> **Safety rules**
> - A restore **deletes** the target's data, collection by collection. Never restore over a live
>   database. Restore into a new, empty one, verify it, then switch.
> - Dumps contain password hashes, session and API tokens, and personal data. Store them
>   encrypted, in `backups/` locally (git-ignored) or a restricted bucket. Never attach them to
>   tickets or chat. Encryption, key custody and restore verification: the
>   [backup protection plan](./backup-protection-plan.md) (proposal, m1-011).
> - Database and media are a pair. Back them up from the same quiet point and restore both.

## A. Local (SQLite) backup

```sh
# 1. Stop the app (dumps are not snapshot-consistent while writes happen)
# 2. Portable dump
npx apos-db-dump "sqlite://./data/vcl-assurer-group.db" --output="backups/$(date +%F)-local.jsonl"
# 3. Media
tar -czf "backups/$(date +%F)-uploads.tgz" public/uploads
```

Expected: the dump has one header line per collection (12 in M0) followed by one line per document.

## B. Restore into a fresh local database

```sh
npx apos-db-restore "sqlite://./data/restore-test.db" --input=backups/<date>-local.jsonl
APOS_DB_URI="sqlite://./data/restore-test.db" node app @apostrophecms/migration:migrate   # rebuilds search index
APOS_DB_URI="sqlite://./data/restore-test.db" node app assurer-security:sanitize-after-restore --execute --database=restore-test
tar -xzf backups/<date>-uploads.tgz          # only into a matching checkout
```

The sanitize step (m1-032) removes the sessions, bearer tokens, login-throttle counters and
password-reset hashes that the dump carried, so the copied cookies and tokens no longer work on
the restored copy. Without `--execute` it only reports counts. The database name for
`--database` is the one the dry run prints. For SQLite it is the file name without `.db`.

**Verify:**
- `npm run test:smoke` passes against the restored database.
- Site search returns results. It will not until step 2 (migrate) has run.

## C. Production (PostgreSQL) — primary backup (not yet executed)

- Preferred: the managed provider's point-in-time recovery (WAL archiving) with ≥ 14-day retention.
- Otherwise run a nightly consistent snapshot:
  `pg_dump -Fc -d "$DATABASE_URL" -f backups/<date>.pgdump`, then copy it to the backup bucket.
- Media: bucket object versioning plus replication; or a nightly `rsync` of `public/uploads` when
  storage is local.

## D. Production — portable export (not yet executed)

At each release, and before any migration:
1. Enable maintenance mode or stop the app.
2. `npx apos-db-dump "$APOS_DB_URI" --output=backups/<date>-release-<id>.jsonl`
3. Snapshot the media.
4. Resume the app.

## E. Recovery procedure (not yet executed)

1. Declare the incident and record the target recovery time.
2. Create a **new** database, from PITR, `pg_restore`, or `apos-db-restore` of the JSONL export.
3. Restore media from the same point.
4. Run `node app @apostrophecms/migration:migrate` against the new database.
   Optional for the same site: `node app assurer-security:sanitize-after-restore --execute
   --database=<name>` logs everyone out. Use it when sessions or tokens may be compromised.
5. Run the smoke test and the editor workflow test against an isolated URL.
6. Switch `APOS_DB_URI`, restart, and monitor.
7. Write an incident report under `docs/engineering/reports/`.

## F. Copying production data into a lower environment

Not allowed without approval. If approved:
- Restore into a new, empty database in the lower environment, with the app stopped.
- Before the app serves any request, sanitize the copy (m1-032):
  ```sh
  node app assurer-security:sanitize-after-restore                                # dry run: counts, database name
  node app assurer-security:sanitize-after-restore --execute --database=<name>    # apply
  ```
  This deletes `sessions` and `aposBearerTokens` documents and the
  `@apostrophecms/loginAttempt*` entries in `aposCache`, and clears `passwordResetHash` in
  `aposUsersSafe`. It does not touch content, users, password hashes, form submissions, media or
  the form rate-limit counters. Those counters hold client IP addresses for up to 15 minutes.
  `--database` must repeat the configured database name, or the task refuses. Re-running it is
  safe.
- Rotate `APOS_SESSION_SECRET`. The lower environment has its own secret in any case (AGENTS.md).
- Assess the form submissions (personal data) before restoring them. The task does not remove
  them (owner scope, m1-032; retention is D-FORM-2).
- Password hashes stay. Treat the copy as holding production credentials, or have the users
  reset their passwords. That is a separate decision.

## G. Drill schedule

Quarterly restore drill into an isolated environment. Sanitize the restored copy (§F) before
it serves requests. Record the result as a dated report.
