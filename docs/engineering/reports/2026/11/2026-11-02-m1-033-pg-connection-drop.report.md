# m1-033 — D-DB-5 connection-drop test on PostgreSQL 16 (Neon free plan)

| | |
|---|---|
| **Task** | m1-033 |
| **Date** | 2026-11-02 |
| **Scope** | Candidate (b) of the [m1-033 handoff](../../../../milestones/m1-033-handoff.md): run the D-DB-5 connection-drop test on an owner-approved disposable PostgreSQL 16, run the sanitize task there, and document how to set up, connect, export and import |
| **Prompt** | [2026-11-02-m1-033-pg-connection-drop.prompt.md](../../../prompts/2026/11/2026-11-02-m1-033-pg-connection-drop.prompt.md) |
| **Handoff** | [m1-033 start handoff](../../../../milestones/m1-033-handoff.md) · next: [m1-034 handoff](../../../../milestones/m1-034-handoff.md) |
| **Branch / commit** | `test/m1-033-pg-connection-drop` from `origin/main` `2b50789` (m1-032 merged as PR #35). Commit and push approved by the owner (D-GIT-31); PR opened by the owner |
| **Related** | D-DB-5 · D-DB-6 · D-DB-2 · D-DB-7 · D-GIT-30 · D-GIT-31 (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Candidate (b), PostgreSQL 16: owner, in session.
- Test instance: first the owner's OCI server (Docker), then local Docker was discussed, and
  finally **Neon free plan**: "go with Neon, approve the script change". The agent read this as
  approval to point the app at that Neon project, with demo data only (AGENTS.md: non-local
  database). It does **not** decide D-DB-2.
- Script change approved by the owner in the same message.
- Neon account and projects: created by the owner. The agent created no account and accepted no
  terms. The agent did not follow the onboarding prompt that Neon generated (CLI install,
  `neon init`/`deploy`, Neon driver in the app); see the prompt record, item 4.
- Closing answer, "approve all", to three items: commit and push (D-GIT-31); the m1-032 CI checks
  green (stated by the owner; `gh` is not installed, not checked by the agent); switching `.env`
  back to SQLite.
- No package, lockfile or production system changed. No upstream issue filed. Nothing published.

## What was done

| Item | Result |
|---|---|
| `scripts/pg-connection-drop-test.mjs` | `--allow-remote-host=<exact host>` accepts one named non-loopback host; any other is refused. Admin SQL runs through the `pg` client that db-connect already depends on (resolved from db-connect's location), so no `psql` is needed. It now terminates only the APOS_DB_URI user's connections to the target database. Crash detection fixed twice during the run: it now checks each stderr chunk before trimming it, and uses the `'close'` event instead of `'exit'` (a single 18 KB crash chunk was being cut down to its last 4,000 characters) |
| [Neon runbook](../../../../runbooks/postgresql-dev-on-neon.md) | New. Console-only setup (no Neon CLI or driver), first start, test commands, optional server-restart through the Neon API, export (`apos-db-dump`; `pg_dump` with client tools or in a container) and import into a new, empty database, then migrate and sanitize |
| [OCI Docker runbook](../../../../runbooks/postgresql-dev-on-oci-docker.md) | New, **not chosen**, kept as a fallback (loopback-only container, SSH tunnel, export/import). Not executed |
| [D-DB-5 proposal](../../../../milestones/m1-d-db-5-postgresql-connection-loss-proposal.md), decision register | m1-033 results noted on D-DB-5 and D-DB-6; **D-GIT-31** (new, open) |
| Records | Prompt, this report, INDEX rows, runbooks README, [m1-034 handoff](../../../../milestones/m1-034-handoff.md) |
| Owner's `.env` (git-ignored, not tracked) | The owner switched `APOS_DB_URI` to Neon. The agent changed one character on line 10 (`APOS_DB_URI:` to `APOS_DB_URI=`), so that the line was read. No values were shown in chat or in files |

## Test environment

- Neon free plan, project created by the owner, region `ap-southeast-1` (Singapore), **direct**
  endpoint (not the pooler), TLS (`sslmode=require`, which `pg` 8.23.1 treats as `verify-full`).
- Server: `PostgreSQL 16.15 (df8277c) on aarch64-unknown-linux-gnu`.
- Apostrophe 4.34.0, `@apostrophecms/db-connect` 1.1.0, `pg` 8.23.1, `pg-pool` 3.14.0,
  Node 24.21.0, Windows 11 (the app runs on Windows).
- The first Neon project the owner created ran **PostgreSQL 18.6**. The agent stopped before
  writing to it, and the owner created a 16 project. Nothing was written to the 18 project.
- Database `neondb`, empty at the start (0 user tables). Filled with
  `@apostrophecms/migration:migrate` (39 s) and `assurer-demo:seed` (40 s). The test admin from
  `.env` was created with the core `@apostrophecms/user:add <user> admin` task, with the password
  sent through stdin and never printed. `assurer-test:ensure-admin` refuses non-SQLite databases
  by design.

## Verification (agent-executed)

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Unit | `npm run test:unit` | 99/99 | PASS |
| Lint | `npm run lint` | No errors or warnings | PASS |
| Smoke on Neon | App on `127.0.0.1:3034` with the Neon `APOS_DB_URI`; `BASE_URL=http://127.0.0.1:3034 npm run test:smoke` | 18/18 | PASS |
| Workflow on Neon | `npm run test:workflow`, same base URL | 15/15 | PASS |
| Persistence on Neon | `npm run test:persistence`, same base URL | 7/7 | PASS |
| Writes reached Neon | `pg` query: tables and `aposDocs` | 12 Apostrophe tables; 31 documents, 1 user, latest `updatedAt` 10:50 UTC (during the workflow run); 1 live app connection | PASS |
| Script guards | Remote host without the flag; a different host; right host with a wrong `--database`; SQLite URI | Each refused with its message before anything started | PASS |
| D-DB-5 run 1, no supervisor (10:58 UTC) | `scripts/pg-connection-drop-test.mjs --database=neondb --allow-remote-host=<host>` | idle-terminate **FAIL**: exited 1x (connection error), not serving after 60 s. server-restart NOT RUN. cursor **FAIL**: exited (code 1) (connection error). Exit 1 | **D-DB-5 reproduced** (expected result for db-connect 1.1.0) |
| D-DB-5 run 2, `--supervise` (11:00 UTC) | Same, with `--supervise` | idle-terminate **PASS**: exited 1x (connection error), serving 20 s after the drop, 23 failed probes. server-restart NOT RUN. cursor **FAIL**: exited (code 1) (connection error). Exit 1 | Mitigation A recovers the app (PASS); cursor FAIL as designed (see below) |
| D-DB-5 crash stack | Started the app by hand on `:3035`, terminated its connections with `pg` | `Error: terminating connection due to administrator command`, `Emitted 'error' event on BoundPool instance at: Client.idleListener (pg-pool/index.js:62)`, process exit 1. The same path as m1-010 (there `ECONNRESET`) | Confirmed |
| Server restart | — | No `NEON_API_KEY`/project and endpoint IDs in `.env` | NOT TESTED |
| Neon auto-suspend (5 min idle) | — | Not observed by hand | NOT TESTED |
| Sanitize on PostgreSQL, no data | Dry run, `--execute --database=neondb`, dry run | All counts 0 (the suites log out) | PASS (no-op) |
| Sanitize on PostgreSQL, with data | Through the login API on `:3034`: one bearer login, one session login, one failed login. Then dry run, execute, dry run | Before: sessions 1, bearer tokens 1, throttle counters 1, reset hashes 0. Execute deleted 1/1/1. After: all 0 | PASS |
| Sanitize: password-reset hash | — | No reset hash present (password reset not used) | NOT TESTED |
| Browser (Chrome), logged out | `http://127.0.0.1:3034/` on the Neon instance; page text and one screenshot | Home page with the "Demo" product card, the demo banner and "Log in"; no admin bar, no draft content | PASS |
| Layouts 1440/768/375 | — | No template or layout change | NOT TESTED (not applicable) |
| m1-032 CI checks | — | Green, stated by the owner ("approve all"); not checked by the agent (`gh` not installed) | Owner-stated |

**Why the cursor scenario fails with `--supervise` too.** It runs a separate process that holds a
db-connect cursor (no supervisor restarts it), so it only passes when the process survives, that
is, after an upstream fix (proposal §4 step 5). In the app, an interrupted cursor crashes the
process the same way, and the supervisor restarts it.

**Not covered:** proposal §4 step 1 (two instances behind a health-checked proxy; depends on
D-DB-7), step 3 (server restart; Neon API key not provided) and step 5 (no fixed db-connect
release). **D-DB-6 Linux repeat test: in part only.** The database is PostgreSQL 16 on Linux, but
the app runs on Windows, and Neon is not a D-DB-2 candidate.

### Findings

1. **D-DB-5 is reproduced on PostgreSQL 16.15 through a managed proxy** (Neon), with
   `pg_terminate_backend`. A connection drop during idle time exits the process. The m1-011
   proposal §2 issue text says that `pg_terminate_backend` "should take the same path, but we
   have not tested it". It is now tested. The owner may want to update that sentence before
   filing (I6).
2. **Mitigation A works:** with a restart 2 s after an exit, the site served again 20 s after the
   drop. Requests during those 20 s failed (23 failed probes at 0.5 s intervals). Two instances
   behind a health-checked proxy (B) would hide this, which is not tested.
3. **Neon free plan suspends after 5 idle minutes**, and closes the connections. With db-connect
   1.1.0, a dev server on Neon will exit at each suspend. Keep SQLite for daily development.
4. The owner's dev server on `:3000` (started 15:03, before the `.env` change) stayed on SQLite.
   The first smoke run, by mistake, used it and passed 18/18 against SQLite; that result is not
   counted above. All counted results used the agent's own instance on `:3034`.

## Cleanup

- The agent's app instances on `:3034`, `:3035` and `:3036` were stopped; the test script stops its
  own on `:3033`. The Chrome tab was closed.
- Raw app logs were deleted from the scratch directory, because Node's crash output prints the
  `pg` client object, which can contain connection details. The helper script was deleted.
- **Left in Neon** (disposable project, demo data only): the seeded demo content, the
  "M0 Test Page" and other workflow-test content, and the test admin from `.env`. They are kept
  for later runs. Delete the Neon project when it is no longer needed (owner, not undoable).
  The 18.6 project is empty.
- **The owner's `.env`:** switched back to SQLite by the agent on the owner's approval (line 9
  active, the Neon line commented out and kept). The running dev server was never affected.
- The local SQLite dev database was not read or written.

## Open items

- The owner opens the PR for this branch (D-GIT-31).
- D-DB-5 stays **OPEN**: the upstream fix (I6; the owner files it) or the owner's acceptance of A+B
  as the permanent mitigation. Before that, test B (two instances) and the server restart (Neon API).
- D-DB-6 remaining blockers: D-DB-5, the Linux repeat test on the D-DB-2 provider (app on Linux
  too), D-DB-2, D-DB-3 and D-DB-4.
