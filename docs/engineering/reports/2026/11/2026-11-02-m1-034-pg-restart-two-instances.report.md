# m1-034 — D-DB-5 on Neon: server restart, idle wait and two instances (mitigation B)

| | |
|---|---|
| **Task** | m1-034 |
| **Date** | 2026-11-02 (started) to 2026-11-03 (runs and report) |
| **Scope** | Candidate (b) of the [m1-034 handoff](../../../../milestones/m1-034-handoff.md): finish the D-DB-5 tests on the owner's disposable Neon PostgreSQL 16 project (server restart through the Neon API, the 5-minute auto-suspend, two instances behind a health-checked proxy) |
| **Prompt** | [2026-11-02-m1-034-pg-restart-two-instances.prompt.md](../../../prompts/2026/11/2026-11-02-m1-034-pg-restart-two-instances.prompt.md) |
| **Handoff** | [m1-034 start handoff](../../../../milestones/m1-034-handoff.md) · next: [m1-035 handoff](../../../../milestones/m1-035-handoff.md) |
| **Branch / commit** | `test/m1-034-pg-restart-two-instances` from `origin/main` `0291944` (m1-033 merged as PR #36). Commit and push approved by the owner (D-GIT-32); PR opened by the owner |
| **Related** | D-DB-5 · D-DB-7 · D-DB-2 · D-GIT-31 · D-GIT-32 (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Candidate (b), the plan, both script changes, and pointing the app at the Neon PostgreSQL 16
  project with demo data only: owner, first session ("yes"; prompt record item 2).
- `NEON_API_KEY`, `NEON_PROJECT_ID` and `NEON_ENDPOINT_ID`: put into `.env` by the owner. No
  value was shown in chat, logs or files.
- Second session: repeat both runs with the current script, then write up ("yes"; prompt record
  item 3).
- m1-033 CI checks: green as stated by the owner; not checked by the agent (`gh` not installed).
- No package, lockfile or production system changed. No account created. No upstream issue filed.

## Session history

The task ran in two Claude Code sessions. The first wrote the script changes, the new helper and a
runbook draft, and ran the tests several times, but ended before any report or evidence was
saved. Only one complete log from it survived (2026-11-02, from an earlier version of the
script; it agrees with run 1 below). The runbook draft contained claims with no surviving
evidence ("four 7-minute waits", "7 s after the suspend", "0 app connections 15 s after the last
request"). The second session repeated both runs with the final script and changed the runbook
to say only what those runs show. Only the second session's runs are counted here.

## What was done

| Item | Result |
|---|---|
| `scripts/pg-connection-drop-test.mjs` | `--idle-wait=<s>`: scenario `idle-wait`, no requests for that long, then check. `--instances=2` (needs `--supervise`): two app instances on the next two ports behind a stand-in load balancer (built-in `node:http`: round robin over instances that answered `GET /` with 200 at the last 1 s check, 503 when none; no retries), and scenario `one-instance`, which drops only the first instance's connections (each instance sets its own `PGAPPNAME`). Every scenario now probes the site every 0.5 s from 1 s after the drop and reports failed probes. With two instances, a scenario passes only with 0 failed probes. The server-restart start command now runs 30 s after the stop while the site is probed. Terminated connections are logged by state |
| `scripts/neon-endpoint.mjs` (new) | `suspend`, `start`, `status` for the Neon endpoint through the Neon API with Node's built-in `fetch`. Reads the three `NEON_*` values from `.env`, prints only the HTTP status and the endpoint state, and exits 0 on API errors (Neon may already have started the compute) |
| [Neon runbook](../../../../runbooks/postgresql-dev-on-neon.md) | §1 and §4: restart flags through the helper, idle wait, two instances, results |
| Decision register | D-DB-5 and D-DB-7 notes; **D-GIT-32** (new, open) |
| Records | Prompt record (both sessions), this report, INDEX, runbooks README, [m1-035 handoff](../../../../milestones/m1-035-handoff.md) |

## Test environment

- Neon free plan, the m1-033 PostgreSQL 16 project (Singapore, direct endpoint, TLS), database
  `neondb` with the m1-033 demo content.
- Apostrophe 4.34.0, `@apostrophecms/db-connect` 1.1.0, `pg` 8.23.1, `pg-pool` 3.14.0,
  Node 24.21.0, Windows 11.
- Evidence (git-ignored): `evidence/m1-034/run1.log`, `run2.log`,
  `neon-operations-after-run1.txt`, `neon-operations-after-run2.txt`. The `pg` SSL-mode warning
  lines were removed; the logs contain no host, key or connection string.

## Verification (agent-executed)

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Lint | `npm run lint` | No errors or warnings | PASS |
| Neon API helper | `node --env-file=.env scripts/neon-endpoint.mjs status` | HTTP 200, state `idle` | PASS |
| Run 1 (13:50:47–13:59:31 local, UTC+6) | `--supervise --idle-wait=420 --stop-cmd=… suspend --start-cmd=… start` | idle-wait **PASS** (no exit; serving 5 s after the wait). idle-terminate **PASS** (1 idle connection terminated; exited 1x with the connection error; serving 28 s after the drop; 48 of 49 probes failed). server-restart **PASS** (exited 1x with the connection error; serving 17 s after the suspend; 26 of 27 probes failed). cursor **FAIL** (exited, connection error). Exit 1 | Mitigation A recovers from a drop and from a compute restart; cursor FAIL is the known D-DB-5 crash |
| Auto-suspend during the 7-min wait | Neon operations through `GET /projects/{id}/operations` | `start_compute` 07:51:00Z, then no operation until the script's own `suspend_compute` at 07:59:00Z | **NOT OBSERVED**: no auto-suspend happened |
| Neon restarts the compute by itself | Same operations list | `start_compute` 07:59:05Z, 5 s after the API suspend, before the script's start command (about 07:59:30Z, which found the endpoint active) | Confirmed |
| Run 2 (14:00:08–14:02:03 local) | `--supervise --instances=2` with the same restart flags; instances on `:3034` and `:3035`, proxy on `:3033` | idle-terminate **FAIL** (4 idle connections terminated; both instances exited; serving 17 s after the drop; 29 of 30 probes failed). one-instance **PASS** (2 connections of `:3034` terminated; that instance exited; serving throughout; 0 of 5 probes failed). server-restart **FAIL** (both instances exited; serving 20 s after the suspend; 33 of 34 probes failed). cursor **FAIL** (as in run 1). Exit 1 | Mitigation B hides the loss of one instance only |
| Two pools on the free plan | Run 2 | Both instances started and served through the proxy | PASS |
| `.env` back to SQLite | Owner said "ok" to the agent's offer; the agent swapped the comment marks on the two `APOS_DB_URI` lines (SQLite active, Neon kept, commented out). No value shown | SQLite line active | Done |
| Smoke on SQLite | `node --env-file=.env app` on `:3000`; `npm run test:smoke` | 18/18 | PASS |
| Workflow on SQLite | `npm run test:workflow` | 15/15 | PASS |
| Persistence on SQLite | `npm run test:persistence`, same server (no restart in between) | 7/7 | PASS |
| Browser (Chrome), logged out | `http://127.0.0.1:3000/` in a new tab; page text and one screenshot | Home page with the demo banner, the "Business Cover (Demo)" card and "Log in"; no admin bar, no draft content | PASS |
| Layouts 1440/768/375 | — | No template or layout change | NOT TESTED (not applicable) |

### Findings

1. **Server restart is now tested.** A compute suspend through the Neon API with open
   connections exits the app (D-DB-5, same connection error). With a supervisor, the site served
   again 17 s (run 1) and 20 s (run 2) after the suspend. Neon started the compute again 5 s after
   the suspend, because the restarted app connected.
2. **Mitigation B alone does not prevent an outage.** Two instances behind a health-checked proxy
   kept the site up when only one instance lost its connections (0 failed probes). When the
   database dropped every connection, or restarted, both instances crashed together, and the site
   was down for 17–20 s until the supervisor restarted them. A database restart or failover drops
   every connection, so in production B only helps with failures local to one instance. A, the
   supervisor, is still required, and only an upstream fix removes the outage.
3. **No auto-suspend happened during a 7-minute idle wait.** The operations log has no
   `suspend_compute` in that time. The cause is not known; one possibility is that something kept
   the compute active. So whether an auto-suspend makes an idle app exit was **not** observed. An
   earlier pair in the log (2026-11-02 20:13:40Z start, 20:18:46Z suspend) shows an auto-suspend
   about 5 minutes after a start, under conditions not recorded.
4. **One exit was not counted.** Run 2's log shows 6 app exits, but the scenarios counted 5.
   The `:3034` instance exited a second time during idle-terminate's recovery, after the 5 s
   counting window. The cause was not investigated. It does not change any outcome above.
5. The m1-033 runbook's `curl -f` restart commands would abort the test once Neon has started the
   compute by itself. The helper script avoids that.

## Cleanup

- The test script stopped its own instances and the proxy after each run. The agent's server on
  `:3000` for the suites was stopped, and the Chrome tab was closed.
- Raw run logs and the read-only operations helper were deleted from the scratch directory after
  the sanitized copies were saved.
- **Left in Neon:** as after m1-033 (demo content, workflow-test content, the test admin from
  `.env`). The compute suspends on its own when idle.
- **The owner's `.env`:** back on SQLite (see Verification). The three `NEON_*` lines are still
  there. **Owner action:** revoke the Neon API key used for this task, then delete those lines.
- The test page and workflow content from the suites stay in the local SQLite database, as after
  earlier runs.

## Open items

- The owner opens the PR for this branch (D-GIT-32).
- D-DB-5 stays **OPEN**. Proposal §4 steps 1–4 are now covered on Neon (step 1 with a local
  stand-in proxy). Step 5 needs a fixed db-connect release; the upstream issue is still not filed
  (owner, I6).
- D-DB-7: the chosen hosting needs automatic restart (A); more than one instance (B) is useful
  but not enough on its own.
