# m1-035 — D-DB-5 upstream issue text updated for filing

| | |
|---|---|
| **Task** | m1-035 |
| **Date** | 2026-11-03 |
| **Scope** | Candidate (b) of the [m1-035 handoff](../../../../milestones/m1-035-handoff.md): update the [D-DB-5 proposal](../../../../milestones/m1-d-db-5-postgresql-connection-loss-proposal.md) §2 issue text with the m1-033 and m1-034 results, so that the owner can review it and file it (I6) |
| **Prompt** | [2026-11-03-m1-035-d-db-5-upstream-issue.prompt.md](../../../prompts/2026/11/2026-11-03-m1-035-d-db-5-upstream-issue.prompt.md) |
| **Handoff** | [m1-035 start handoff](../../../../milestones/m1-035-handoff.md) · next: [m1-036 handoff](../../../../milestones/m1-036-handoff.md) |
| **Branch / commit** | `docs/m1-035-d-db-5-upstream-issue` from `origin/main` `6507bd2` (m1-034 merged as PR #37). Commit and push approved by the owner (D-GIT-33); PR opened by the owner |
| **Related** | D-DB-5 · D-SEC-3 · D-GIT-32 · D-GIT-33 (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Candidate (b): owner, in session ("(b) D-DB-5 upstream issue (Recommended)").
- m1-034 CI checks: green as stated by the owner ("Yes, all green"); not checked by the agent
  (`gh` not installed).
- No package, lockfile, `.env`, database or production system changed. **No upstream issue
  filed**; nothing posted anywhere. GitHub was only read, through the public search API without a
  token.

## What was done

| Item | Result |
|---|---|
| Upstream re-check | npm: `@apostrophecms/db-connect` 1.1.0 (modified 2026-10-20), `apostrophe` 4.34.0, `pg` 8.23.1, `pg-pool` 3.14.0, all equal to the installed versions. Upstream `main` `packages/db-connect/package.json`: 1.1.0. Installed `adapters/postgres.js`: `new Pool(...)` at lines 2515 (main), 2532 (admin) and 2547 (reconnect), and no `'error'` listener. `pg-pool/index.js` line 62 emits `'error'` from `idleListener` |
| Duplicate search | GitHub issue search API on `apostrophecms/apostrophe`, open and closed: "postgres" (7 results), "ECONNRESET" (0), "db-connect" (11), "pool error" created since 2026-01-01 (1). **No matching issue.** #5604 (closed) fixed the release of abandoned postgres cursor connections. It is related, but it adds no `'error'` listener |
| Proposal §2 | Issue text rewritten. Changes: `pg_terminate_backend` is now tested (it was "not tested"), and the reproduction uses it. Added the managed PostgreSQL (direct endpoint, TLS) and compute-suspend cases, the second stack message (`terminating connection due to administrator command`), the cursor exit, a link to #5604, and the measured workarounds (supervisor 17–28 s; two instances do not help when the whole database drops). The provider name is not in the public text. The status row also gets m1-034 and m1-035 notes |
| Decision register | D-DB-5 note (m1-035); D-GIT-32 marked merged (PR #37); **D-GIT-33** (new, open) |
| Records | This report, the prompt record, INDEX, [m1-036 handoff](../../../../milestones/m1-036-handoff.md) |

## Verification (agent-executed)

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Lint | `npm run lint` | No errors or warnings | PASS |
| Smoke | `node --env-file=.env app` on `:3000` (SQLite); `npm run test:smoke` | 18/18 | PASS |
| Workflow | `npm run test:workflow` | 15/15 | PASS |
| Persistence | `npm run test:persistence`, same server | 7/7 | PASS |
| Browser (Chrome), public site | `http://127.0.0.1:3000/` in a new tab; page text | Home page with the "Demo" label and the "Business Cover (Demo)" card | PASS |
| Browser: no admin bar or draft content when logged out | — | Not checked: the page text read covers the article only, and the follow-up HTML check was not run | NOT TESTED |
| Issue text against the evidence | Each claim compared with the m1-010, m1-033 and m1-034 reports and the sanitized m1-034 logs | Matches. The m1-034 logs record only "connection error" for the compute suspend, so the text quotes no separate message for that case | PASS |
| Layouts 1440/768/375 | — | No template or layout change | NOT TESTED (not applicable) |

## Cleanup

- The agent's server on `:3000` was stopped and the Chrome tab was closed. Stopping it by port PID
  was refused by the session's permission check; the agent stopped its own background task
  instead.
- The suites' test page and workflow content stay in the local SQLite database, as after earlier
  runs.

## Open items

- **Owner:** review the proposal §2 text, file it at
  <https://github.com/apostrophecms/apostrophe/issues/new> (I6), and record the issue URL on
  D-DB-5. The D-SEC-3 (a) issue in [m1-012-upstream-issue-drafts.md](../../../../milestones/m1-012-upstream-issue-drafts.md)
  is also still unfiled.
- The owner opens the PR for this branch (D-GIT-33).
- D-DB-5 stays **OPEN**: step 5 needs a fixed db-connect release.
- Carry-over from the m1-035 handoff §2 still applies (revoke the Neon API key and remove the
  `NEON_*` lines from `.env`).
