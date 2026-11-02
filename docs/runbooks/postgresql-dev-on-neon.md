# Runbook: Disposable PostgreSQL 16 on Neon (free plan), for development and the D-DB-5 test

| | |
|---|---|
| **Status** | Draft. **Verified 2026-11-02 (`m1-033`):** §2 (console setup, by the owner), §3 (migrate, seed, test suites on PostgreSQL 16.15), §4 runs 1 and 2 and the sanitize task. **Not executed:** the §4 server-restart flags (Neon API), the 5-minute auto-suspend observation, and §5 export/import. |
| **Purpose** | A disposable, free PostgreSQL 16 server for the D-DB-5 connection-drop test ([proposal](../milestones/m1-d-db-5-postgresql-connection-loss-proposal.md) §4, [`scripts/pg-connection-drop-test.mjs`](../../scripts/pg-connection-drop-test.mjs)) and short development checks. It is **not** staging or production, and it **does not decide D-DB-2** (managed provider and region). |
| **Owner direction** | m1-033: "go with Neon, approve the script change" ([m1-033 prompt](../engineering/prompts/2026/11/2026-11-02-m1-033-pg-connection-drop.prompt.md)). |
| **Alternative** | [PostgreSQL 16 in Docker on the owner's OCI server](./postgresql-dev-on-oci-docker.md) (not chosen; kept as a fallback) |

> **Safety rules**
> - **Demo data only.** No real content (D-CONTENT-16), no production copy, no personal data.
>   Use `node app assurer-demo:seed` and a disposable test user.
> - **Connection strings and API keys are secrets.** Paste them only into the git-ignored `.env`,
>   never into chat, docs, commit messages or reports.
> - **No Neon code in the app.** Apostrophe connects through `@apostrophecms/db-connect` and its
>   `pg` driver (ADR-0002). Do **not** run `neon init` or `neon deploy`, and do not add
>   `@neondatabase/serverless`, `neon.ts` or Neon agent skills to the repository. Neon's onboarding
>   prompt suggests these; they are new dependencies and tools that need approval, and none is
>   needed.
> - Pointing the app at Neon is a non-local database (AGENTS.md). The owner approves it for
>   m1-033, for this disposable project only.

## 1. Free-plan behaviour that matters here

- **Scale to zero after 5 idle minutes.** It cannot be turned off on the free plan. When the
  compute suspends, Neon closes the open connections, so the app exits (that is the D-DB-5
  defect). Under `npm run dev`, `nodemon` then waits: type `rs` to restart. Keep SQLite for
  everyday work.
- **The PostgreSQL major version is fixed per project.** It is chosen when the project is created.
- **Direct versus pooled endpoints.** Neon offers a pooled host (`…-pooler…`, PgBouncer in
  transaction mode) and a direct host. Use the **direct** host: the cursor scenario holds a
  connection across `FETCH` calls, and `pg_terminate_backend` must reach the app's real
  connections.
- Limits at the time of writing: 0.5 GB storage per project and 100 compute-hours a month. A demo
  database is a few MB.

## 2. Owner steps in the Neon console (no CLI)

1. Open the project. In **Settings**, check that the **Postgres version is 16**. If it is not,
   create a new project with version 16 and a nearby region, and use that one. The version cannot
   be changed afterwards.
2. Optional: in **Databases**, create a database `assurer_m1033` owned by the default role
   (usually `neondb_owner`). The default `neondb` also works; use its name below.
3. Click **Connect**. Choose the branch, the role and the database, and **turn connection pooling
   off** (a direct host has no `-pooler` in its name). Copy the connection string.
4. In your `.env`, comment out the SQLite line and add the Neon line. Keep only
   `?sslmode=require` at the end. If the string also has `&channel_binding=require`, remove that
   part: this test does not need it, and `pg` handles `sslmode=require` as full certificate
   verification.

```sh
# APOS_DB_URI=sqlite://./data/vcl-assurer-group.db
APOS_DB_URI=postgresql://<role>:<password>@<endpoint host>/<database>?sslmode=require
```

Then tell the agent "done". **Do not paste the string into chat.** The agent reads only the host
name and database name, which it needs for the test flags.

## 3. First start on the empty database

```sh
node app @apostrophecms/migration:migrate
node app assurer-demo:seed
node app @apostrophecms/user:add <disposable admin name> admin
npm run dev
```

Then run the suites from AGENTS.md (`npm run lint`, `test:smoke`, `test:workflow`,
`test:persistence`). The test credentials in `.env` must belong to a user in **this** database.
To switch back, restore the SQLite line in `.env` and restart.

## 4. Run the D-DB-5 connection-drop test

The script runs its admin SQL through the `pg` client that db-connect already uses, so no local
`psql` is needed (m1-033 change). `--allow-remote-host` must repeat the host from `APOS_DB_URI`
exactly; any other non-loopback host is refused.

```sh
# Run 1, without a supervisor: expected FAIL while db-connect 1.1.0 is unfixed
node --env-file=.env scripts/pg-connection-drop-test.mjs --database=<database> --allow-remote-host=<endpoint host>

# Run 2, with a supervisor (mitigation A)
node --env-file=.env scripts/pg-connection-drop-test.mjs --database=<database> --allow-remote-host=<endpoint host> --supervise
```

**Server-restart scenario (optional).** Neon's API can suspend and start the compute. That needs
a Neon API key, the project ID and the endpoint ID, all kept in `.env` (`NEON_API_KEY`,
`NEON_PROJECT_ID`, `NEON_ENDPOINT_ID`). Add these flags to run 2 (Windows `cmd` syntax, because
the script runs the commands through the shell):

```sh
--stop-cmd="curl -fsS -X POST -H \"Authorization: Bearer %NEON_API_KEY%\" https://console.neon.tech/api/v2/projects/%NEON_PROJECT_ID%/endpoints/%NEON_ENDPOINT_ID%/suspend"
--start-cmd="curl -fsS -X POST -H \"Authorization: Bearer %NEON_API_KEY%\" https://console.neon.tech/api/v2/projects/%NEON_PROJECT_ID%/endpoints/%NEON_ENDPOINT_ID%/start"
```

Without them, the script records `server-restart` as NOT RUN. The 5-minute auto-suspend is the
same kind of event and can be observed by hand: leave the app idle for more than 5 minutes and
record whether it exits.

Then run the sanitize task against the same database (D-DB-6):
`node app assurer-security:sanitize-after-restore` (dry run), then
`node app assurer-security:sanitize-after-restore --execute --database=<database>`.

What this covers:
- **Covered:** proposal §4 steps 2 and 4 (and step 3 with the API flags) against PostgreSQL 16 on
  a managed service with a proxy in front, which is close to production conditions.
- **Not covered:** step 1 (two instances behind a health-checked proxy, D-DB-7) and step 5 (needs
  a fixed db-connect release).
- **D-DB-6 Linux repeat test: only in part.** The database runs on Linux, but the app runs on
  Windows, and Neon is not the chosen staging provider.

## 5. Export and import

Both formats contain password hashes. Keep exports in `backups/` (git-ignored), or encrypted.
Stop the app first, and snapshot `public/uploads` at the same time: database and media are a pair.

| Destination | Format | How |
|---|---|---|
| Any engine Apostrophe supports (the D-DB-2 provider, OCI, local SQLite or PostgreSQL) | Apostrophe JSONL | `npx apos-db-dump "<APOS_DB_URI>" --output=backups/<date>-neon.jsonl`. No new tool, runs on this PC |
| Another PostgreSQL, exact copy | PostgreSQL custom dump | `pg_dump -Fc` needs PostgreSQL 16+ client tools (not installed; needs approval). Without a local install, run it in a container somewhere Docker exists, e.g. the OCI server: `docker run --rm postgres:16 pg_dump -Fc "<uri>" > <file>` |

Import, always into a **new, empty** database:

```sh
npx apos-db-restore "<target APOS_DB_URI>" --input=backups/<date>-neon.jsonl
# or, for a pg_dump file:
pg_restore --no-owner --no-privileges -d "<target admin URI>" backups/<date>-neon.pgdump
```

Then, against the new database ([backup and restore runbook](./database-backup-and-restore.md)
§B, §F): `node app @apostrophecms/migration:migrate`, the sanitize task (dry run, then
`--execute --database=<name>`), restore the matching uploads, give the target its own
`APOS_SESSION_SECRET`, and run the smoke and workflow tests.

Rules:
- **Data from this project never becomes staging or production data.** Those are built from the
  CA-5 entry on the target site (D-CONTENT-16, option A).
- Do not copy the local SQLite development database into Neon without owner approval. It holds
  test users and the unpublished privacy-notice draft.

## 6. Clean up

Remove the disposable test user through the Apostrophe UI or REST API (AGENTS.md rule 11). Deleting
the Neon project removes every database in it and cannot be undone. It needs the owner's approval,
and an export first if anything should be kept.
