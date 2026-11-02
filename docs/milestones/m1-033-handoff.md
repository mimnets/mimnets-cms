# m1-033 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-02, by the agent at the end of m1-032 (agent-executed; not a human approval) |
| **Task** | `m1-033`, an item the owner picks. Candidates: (a) **record the hosting decisions** D-DB-2, D-DB-3, D-DB-7 and D-DB-4 once the owner and DPO inputs exist; (b) **run the D-DB-5 connection-drop test** on an approved disposable PostgreSQL with the chosen major version (needs D-DB-2 or an owner-picked version, and approval of the instance); (c) **privacy notice go-live** (CA-6, after DPO review, D-CONTENT-15); (d) **D-CONTENT-11** (publishing workflow) |
| **Precondition** | The m1-032 PR is merged (D-GIT-30) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-033-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-2 to D-DB-7, D-CONTENT-11, D-CONTENT-15) · [m1-032 report](../engineering/reports/2026/11/2026-11-02-m1-032-db-staging-prep.report.md) · [hosting options paper](m1-031-hosting-options.md) · [D-DB-5 proposal](m1-d-db-5-postgresql-connection-loss-proposal.md) · [backup and restore runbook](../runbooks/database-backup-and-restore.md) |

## 1. State at the end of m1-032

- `feat/m1-032-db-staging-prep`: `node app assurer-security:sanitize-after-restore` (dry run by
  default; `--execute --database=<name>`) removes sessions, bearer tokens, login-throttle counters
  and password-reset hashes. Verified on SQLite only, including the browser. Accepted by the owner;
  that D-DB-6 blocker is closed.
- `scripts/pg-connection-drop-test.mjs` written, **not run**.
- `@apostrophecms/db-connect` is still 1.1.0; D-DB-5 is unfixed. The upstream issue text is
  unchanged and **not filed** (owner, I6).
- Hosting: nothing decided, no accounts (m1-031 paper §7 inputs I1–I5 still needed).
- The unpublished draft page "Privacy notice" (`/privacy`, m1-027) is still in the local
  development database.

## 2. Candidates

- **2.1 Hosting decisions:** unchanged from the [m1-032 handoff §2.1](m1-032-handoff.md#21-record-the-hosting-decisions).
- **2.2 D-DB-5 test run:** install or provide a disposable, local PostgreSQL (a new tool: needs
  approval; WSL or a container preferred over unsigned zips), then run the script with and without
  `--supervise` and record the results. Also run the sanitize task on that PostgreSQL. This also
  covers part of the Linux repeat test (D-DB-6) if it runs on Linux with the target major version.
- **2.3 Privacy notice** and **2.4 Publishing workflow:** unchanged from the
  [m1-031 handoff §2.2–§2.3](m1-031-handoff.md#22-privacy-notice-go-live-ca-6).

## 3. Carry-over

- All items in the [m1-032 handoff §3](m1-032-handoff.md#3-carry-over) still apply.
- A restored copy keeps password hashes; whether lower environments force password resets is an
  open question (runbook §F).
- The Chrome extension refused screenshots on `127.0.0.1:3032`; grant the port or use the
  accessibility tree.

## 4. Gates

- No new dependency or tool (including a PostgreSQL install) without approval.
- No provider choice, account creation, spending or production change without explicit owner
  approval.
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- No real content entered in the dev database (D-CONTENT-16).
- Commit, push and PR need owner approval.

## 5. Prompt for the new session

> Start m1-033. Read AGENTS.md and docs/milestones/m1-033-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
