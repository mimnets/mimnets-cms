# m1-032 — D-DB-5 mitigation and D-DB-6 staging blockers (provider-neutral)

| | |
|---|---|
| **Task** | m1-032 |
| **Date** | 2026-11-02 |
| **Scope** | Candidate 2.2 of the [m1-032 handoff](../../../../milestones/m1-032-handoff.md): the "sanitize after restore" task (D-DB-6 blocker), a repeatable PostgreSQL connection-drop test (D-DB-5 proposal §4), and a refresh of the upstream issue text (I6). No provider chosen; no dependency added |
| **Prompt** | [2026-11-02-m1-032-db-staging-prep.prompt.md](../../../prompts/2026/11/2026-11-02-m1-032-db-staging-prep.prompt.md) |
| **Handoff** | [m1-032 start handoff](../../../../milestones/m1-032-handoff.md) · next: [m1-033 handoff](../../../../milestones/m1-033-handoff.md) |
| **Branch / commit** | `feat/m1-032-db-staging-prep` from `origin/main` `96f97cc` (m1-031 merged as PR #34). Commit and push approved by the owner (D-GIT-30); PR opened by the owner |
| **Related** | D-DB-5 · D-DB-6 · D-DB-2 · D-DB-7 · D-SEC-3 · D-FORM-2 · D-GIT-29 · D-GIT-30 (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Task, scope and test handling chosen by the owner in session (see the prompt): "D-DB-5 / D-DB-6
  prep", "Auth secrets only (Recommended)", "Write script, don't run (Recommended)".
- PR #34 checks green: stated by the owner (`gh` is not installed; not checked by the agent).
- Closing answer, "i accept all": commit and push (D-GIT-30); the sanitize task accepted, which
  closes that D-DB-6 blocker; the owner files the upstream issue. The password-reset question for
  restored lower environments stays open (not decided either way).
- No architecture gate passed. No package, lockfile or production system changed. No upstream
  issue filed. Nothing published.

## What was done

| Item | Result |
|---|---|
| `modules/assurer-security/lib/sanitize.js` | Targets and the `--execute`/`--database` guard |
| `modules/assurer-security/index.js` | New task `assurer-security:sanitize-after-restore`. Dry run by default; `--execute` needs `--database=<configured name>`. Deletes `sessions` and `aposBearerTokens` documents and the `@apostrophecms/loginAttempt*` entries in `aposCache`; unsets `passwordResetHash` in `aposUsersSafe`. Uses `apos.db` only; no collection dropped. Idempotent |
| `scripts/sanitize-after-restore.test.mjs` | 5 unit tests (guard and targets), part of `npm run test:unit` |
| `scripts/pg-connection-drop-test.mjs` | D-DB-5 proposal §4 steps 2–5 as a script: idle `pg_terminate_backend`, optional server stop/start, and an interrupted cursor in a child process. `--supervise` simulates mitigation A. Refuses non-postgres URIs, non-loopback hosts and a `--database` that does not match. **Not run** (no PostgreSQL) |
| [Backup and restore runbook](../../../../runbooks/database-backup-and-restore.md) | Sanitize step in §B, §E (optional), §F (required) and §G |
| [D-DB-5 proposal](../../../../milestones/m1-d-db-5-postgresql-connection-loss-proposal.md) | m1-032 status note; §4 script usage |
| Decision register | D-DB-5 and D-DB-6 notes; D-GIT-29 marked merged; **D-GIT-30** (new, open) |
| Records | Prompt, this report, INDEX row and next-task line, [m1-033 handoff](../../../../milestones/m1-033-handoff.md) |

### Why these four targets

Read from the installed apostrophe 4.34.0 source: the session store is connect-mongo with its
default collection `sessions` (`@apostrophecms/express`); bearer and incomplete-login tokens are in
`aposBearerTokens`, and the login throttle uses `apos.cache` namespace
`@apostrophecms/loginAttempt[/<requirement>]` (`@apostrophecms/login`); password-reset codes are
stored as `passwordResetHash` in `aposUsersSafe` (`@apostrophecms/user`). Not touched, by owner
scope: password hashes, users, content, form submissions (D-FORM-2) and media. Also not touched:
the form rate-limit counters (`assurer-form-rate-limit`), which hold client IP addresses for up
to 15 minutes. The runbook says so.

### Upstream (I6)

`npm view`: `@apostrophecms/db-connect` 1.1.0, apostrophe 4.34.0, pg 8.23.1, all unchanged since
m1-011. The three `new Pool(...)` calls in the installed `adapters/postgres.js` still have no
`error` listener. A new duplicate search (GitHub issue search API, read-only: "postgres";
"ECONNRESET" OR "pg-pool" OR "db-connect") found no matching issue. The proposal §2 text is
therefore unchanged and still **not filed**; the owner files it.

## Verification (agent-executed)

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Unit | `npm run test:unit` | 99/99 pass, incl. 5 new | PASS |
| Lint | `npm run lint` | No errors or warnings | PASS |
| Smoke | `npm run test:smoke` against `http://127.0.0.1:3000` | 18/18 | PASS |
| Workflow | `npm run test:workflow` | 15/15 | PASS |
| Persistence | `npm run test:persistence` | 7/7 | PASS |
| Sanitize, seeded DB | Fresh throwaway SQLite in the scratch directory, seeded with fake sessions, tokens, throttle entries (plus a rate-limit and an unrelated cache entry) and a reset hash. Dry run; `--execute` without `--database`; with a wrong name; with the right name; again | Dry run counted 2/2/2/1 and changed nothing. Both refusals exited 1 and changed nothing. Execute removed exactly the targets; the rate-limit and unrelated cache entries and both password hashes stayed. The second run found 0 | PASS |
| Sanitize, live tokens (HTTP) | Copy of the dev database (SQLite backup API) served on `127.0.0.1:3032`. Admin login from `.env` for a bearer token and a session cookie; `GET /api/v1/@apostrophecms/user` with each; sanitize; repeat | Before: 200 / 200. After: 401 (bearer) / 403 (cookie). Public home 200 | PASS |
| Sanitize, browser (Chrome) | Same kind of copy. Disposable editor `m1032-editor` created with `@apostrophecms/user:add … editor`. Logged in through the login form on `127.0.0.1:3032`; admin bar showed the editor. Sanitized; reloaded `127.0.0.1:3032` and `localhost:3032`. Logged in again | Before: admin bar present. After: no admin bar and a "Log in" link on both hosts. Re-login worked (password kept) | PASS |
| Connection-drop script guards | Run with a SQLite URI, a remote host and a mismatched `--database` | Each refused with its message before starting anything | PASS |
| Connection-drop scenarios | — | No PostgreSQL available (owner: write, don't run) | NOT TESTED |
| Sanitize on PostgreSQL | — | No PostgreSQL available | NOT TESTED |
| Layouts 1440/768/375 | — | No template or layout change | NOT TESTED (not applicable) |

Screenshots were refused by the Chrome extension on `127.0.0.1:3032`, so the browser results come
from the page's accessibility tree. No evidence files were saved.

### Finding from the browser check

Before sanitizing, `localhost:3032` showed the **admin** user's admin bar. Browser cookies do not
depend on the port, so the session cookie from the owner's dev server on `localhost:3000` was
accepted by the copy, which held the same sessions. This shows the risk the task removes: a
restored copy accepts the source site's cookies. The agent did nothing with that session. After
sanitizing it was gone. Separately, the login form on `127.0.0.1:3032` redirected to
`localhost:3032`, a known carry-over (m1-025: test on `127.0.0.1`).

## Cleanup

- Both scratch servers were stopped. The scratch databases (seeded DB, two dev copies including the
  disposable editor and the copied hashes), the scratch password and the server logs were deleted
  from the session scratch directory. The Chrome tab was closed.
- The dev database was only read (backup API), never written. The owner's dev server on `:3000`
  (started outside this session) was left running.
- Nothing left over in the repository or the dev database.

## Open items

- D-DB-6: the sanitize blocker is closed (owner acceptance). Still open:
  D-DB-5 validation, the Linux repeat test, D-DB-2, D-DB-3, D-DB-4.
- D-DB-5: run `scripts/pg-connection-drop-test.mjs` on an approved disposable PostgreSQL with the
  D-DB-2 major version; the owner files the upstream issue (I6, D-SEC-3).
- Password hashes travel in dumps. Whether restored lower environments force a password reset is
  a separate decision, not taken (runbook §F).
