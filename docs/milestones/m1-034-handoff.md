# m1-034 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-02, by the agent at the end of m1-033 (agent-executed; not a human approval) |
| **Task** | `m1-034`, an item the owner picks. Candidates: (a) **record the hosting decisions** D-DB-2, D-DB-3, D-DB-7 and D-DB-4 once the owner and DPO inputs exist; (b) **finish the D-DB-5 tests on Neon**: server restart through the Neon API (needs an API key in `.env`), the 5-minute auto-suspend, and two instances behind a health-checked local proxy (mitigation B); (c) **privacy notice go-live** (CA-6, after DPO review, D-CONTENT-15); (d) **D-CONTENT-11** (publishing workflow) |
| **Precondition** | The m1-033 PR is merged (D-GIT-31) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-034-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-2 to D-DB-7, D-CONTENT-11, D-CONTENT-15) · [m1-033 report](../engineering/reports/2026/11/2026-11-02-m1-033-pg-connection-drop.report.md) · [Neon runbook](../runbooks/postgresql-dev-on-neon.md) · [D-DB-5 proposal](m1-d-db-5-postgresql-connection-loss-proposal.md) · [hosting options paper](m1-031-hosting-options.md) |

## 1. State at the end of m1-033

- D-DB-5 is reproduced on PostgreSQL 16.15 (Neon). Mitigation A (supervisor) recovers in about
  20 s. D-DB-5 stays **OPEN**; the upstream issue is still **not filed** (owner, I6). Proposal §2
  could now say that `pg_terminate_backend` was tested.
- The sanitize task is verified on PostgreSQL.
- The test script accepts one named remote host (`--allow-remote-host`) and needs no `psql`.
- A disposable Neon project (PostgreSQL 16, Singapore) holds demo content and the test admin from
  `.env`. An empty PostgreSQL 18 Neon project also exists. Both belong to the owner.
- The owner's `.env` is back on SQLite; the Neon line is kept, commented out.
- Hosting: nothing decided, no accounts other than the owner's Neon test projects.

## 2. Carry-over

- All items in the [m1-033 handoff §3](m1-033-handoff.md#3-carry-over) still apply.
- The m1-032 CI checks were stated green by the owner at the end of m1-033 (`gh` is not installed).
- A dev server on Neon exits at each 5-minute auto-suspend until D-DB-5 is fixed. Use SQLite for
  daily work.
- The OCI Docker runbook is a fallback and has not been executed.

## 3. Gates

- No new dependency or tool without approval (the Neon CLI and Neon drivers are not approved).
- No provider choice, account creation, spending or production change without explicit owner
  approval. The Neon test project does not decide D-DB-2.
- Demo data only on Neon (D-CONTENT-16). Deleting a Neon project needs owner approval.
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-034. Read AGENTS.md and docs/milestones/m1-034-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
