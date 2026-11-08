# m1-052 — Records for the MongoDB reversal

| | |
|---|---|
| **Task** | m1-052 |
| **Date** | 2026-11-08 |
| **Scope** | Candidate 3 of the handoff: the ADR for the engine history, superseded notes, and the dump task decision. The two m1-051 clean-up record commits are carried onto `main` with this branch |
| **Prompt** | [2026-11-08-m1-052-mongodb-reversal-records.prompt.md](../../../prompts/2026/11/2026-11-08-m1-052-mongodb-reversal-records.prompt.md) |
| **Handoff** | [m1-052 start handoff](../../../../milestones/m1-052-handoff.md) · next: [m1-053 handoff](../../../../milestones/m1-053-handoff.md) |
| **Branch / commit** | `docs/m1-052-mongodb-reversal-records` from `origin/main` `df69603`, with `cc0f457` and `f106750` cherry-picked (now `7c2ef4b`, `2d03061`). Commit and push approved by the owner (D-GIT-50) |
| **Related** | D-DB-8 · D-DB-13 · D-DB-14 (new) · D-SEC-7 · D-GIT-50 (new) · [ADR-0004](../../../../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Precondition: PR #54 is merged (`df69603` on `origin/main`). The five hosted CI checks (lint, test,
  build, audit, secrets) are `success` on `df69603`, read through the public GitHub API.
- Task choice and carrying the two commits: "go with your recommendation".
- Removing the dump task: "Remove it (Recommended)". Keeping the Litestream files: "Keep, mark
  superseded (Recommended)".
- ADR-0004 and the commit and push: "accept and aprrove" (D-DB-14, D-GIT-50).
- No package, tool, image or Docker use. No dependency change.

## Changes

| File | Change |
|---|---|
| `docs/architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md` | New, **Accepted** by the owner (D-DB-14). MongoDB Community Edition 8.0.x in one container with PBM; the engine history D-DB-6 → D-DB-8 → D-DB-13 → D-DB-8 with the evidence; supersedes ADR-0002 in part |
| `docs/architecture/decisions/ADR-0002-database-strategy.md` | Status line only (ADR lifecycle rule): the m1-051 reversal and the partial supersession by ADR-0004 |
| `docs/architecture/decisions/README.md` | ADR-0004 row; ADR-0002 status |
| `docs/runbooks/database-backup-and-restore.md`, `new-site-initialization.md`, `README.md` | Status notes: the PostgreSQL steps are superseded for staging and production. Procedures unchanged |
| `docs/milestones/m1-047-…`, `m1-048-…`, `m1-049-…`, `m1-050-…` | Superseded note in the header table |
| `docker/litestream-poc/README.md` | New: superseded, evidence only, not for staging or production |
| `modules/assurer-backup/` (deleted), `scripts/backup-dump.test.mjs` (deleted), `app.js` | The m1-049 dump task removed (owner's choice) |
| `docs/engineering/decision-register.md` | Notes on D-DB-8, D-DB-13, D-SEC-7; new D-DB-14 (ADR-0004 accepted) and D-GIT-50 (approved); header |
| Records | This report, the prompt, INDEX, m1-053 handoff |

## Findings

1. **The runbooks never described SQLite or Litestream for staging.** The handoff asked for
   superseded notes on "the SQLite and Litestream parts of the runbooks". The m1-047 to m1-050 work
   lived only in the milestone papers and `docker/litestream-poc/`, so those got the notes. What
   was out of date in the runbooks was the **PostgreSQL** wording from ADR-0002 (backup runbook
   status, new-site step 2). Those got the notes instead.
2. **ADR-0002 was not amended in substance.** The ADR README says accepted ADRs are superseded by a
   new ADR, with only the old status line changed. ADR-0004 follows that rule. It also fills the gap
   that ADR-0002 Decision 2 left open: "That fallback needs a new ADR".
3. **`@apostrophecms/db-connect` stays a direct dependency** (D-SEC-7). The removed dump task was
   its reason, but `scripts/pg-connection-drop-test.mjs` also imports it. Removing a package needs
   its own approval.
4. Unit tests went from 105 to 101: the four removed tests belonged to the dump task.
5. The m1-049 upstream dump issue (Litestream's tables) no longer affects this project. The
   db-connect issue URL from m1-050 is still not recorded.

## Tests executed and actual results

| Check | Where | Result |
|---|---|---|
| `npm run lint` | host | **PASS**, exit 0 |
| `npm run test:unit` | host | **PASS**, 101/101 |
| `npm run test:smoke` | local server (SQLite, `.env`) | **PASS**, 18/18 |
| `npm run test:workflow` | local server | **PASS**, 15/15 |
| `npm run test:persistence` | local server | **PASS**, 7/7 |

## Browser checks (agent-executed, Claude in Chrome)

The task changes no template or user interface, so this is the short public-site check.

| Check | Steps | Result |
|---|---|---|
| Development site, logged out | Open `http://127.0.0.1:3000/`, read the page text, read console errors | **PASS**: home page with the "Business Cover (Demo)" card; no console errors |
| Tablet and mobile layouts | — | **NOT TESTED**: no template or layout change |

No screenshots were saved. No test accounts or content were created, so nothing needed clean-up.

## Not done or not verified

- The upstream db-connect issue URL (m1-050 results §5, D-DB-13).
- Cluster mode, the lighter menu query, the staging image, the PBM S3 tests, the hardening runbook
  §6 and §7 rewrite, and a PBM runbook.
- The local server started for the suites (`node --env-file=.env app.js`, `127.0.0.1:3000`) was
  was not stopped by the agent (its stop command was not permitted). Claude Code then stopped it
  because the PC was low on memory. It is no longer running.
