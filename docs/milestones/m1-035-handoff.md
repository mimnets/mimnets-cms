# m1-035 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-03, by the agent at the end of m1-034 (agent-executed; not a human approval) |
| **Task** | `m1-035`, an item the owner picks. Candidates: (a) **record the hosting decisions** D-DB-2, D-DB-3, D-DB-7 and D-DB-4 once the owner and DPO inputs exist (the m1-034 results bear on D-DB-7: automatic restart is required); (b) **file the D-DB-5 upstream issue** (owner, I6), after updating the proposal §2 text with the m1-033 and m1-034 results; (c) **privacy notice go-live** (CA-6, after DPO review, D-CONTENT-15); (d) **D-CONTENT-11** (publishing workflow) |
| **Precondition** | The m1-034 PR is merged (D-GIT-32) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-035-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-2 to D-DB-7, D-CONTENT-11, D-CONTENT-15) · [m1-034 report](../engineering/reports/2026/11/2026-11-02-m1-034-pg-restart-two-instances.report.md) · [Neon runbook](../runbooks/postgresql-dev-on-neon.md) · [D-DB-5 proposal](m1-d-db-5-postgresql-connection-loss-proposal.md) · [hosting options paper](m1-031-hosting-options.md) |

## 1. State at the end of m1-034

- D-DB-5 proposal §4 steps 1–4 are now run on Neon PostgreSQL 16 (step 1 with a local stand-in
  proxy). With a supervisor (A), the site recovers from a connection drop or a compute restart in
  about 17–28 s. Two instances (B) hide only a failure in one instance; a database-wide drop or
  restart crashes both. D-DB-5 stays **OPEN**; step 5 needs a fixed db-connect release. The
  upstream issue is still **not filed** (owner, I6).
- The Neon auto-suspend did not happen during a 7-minute idle wait, so its effect is not observed.
- One extra app exit during a recovery in run 2 was not investigated (report, finding 4).
- The owner's `.env` is back on SQLite. The Neon line and the three `NEON_*` lines are kept.
- Hosting: nothing decided.

## 2. Carry-over

- All items in the [m1-033 handoff §3](m1-033-handoff.md#3-carry-over) and the
  [m1-034 handoff §2](m1-034-handoff.md#2-carry-over) still apply.
- **Owner:** revoke the Neon API key used in m1-034, then remove the `NEON_*` lines from `.env`.
- The m1-033 CI checks were stated green by the owner; `gh` is still not installed.
- Neon §5 export/import is still not executed. The OCI Docker runbook is still a fallback, not
  executed.

## 3. Gates

- No new dependency or tool without approval (the Neon CLI and Neon drivers are not approved).
- No provider choice, account creation, spending or production change without explicit owner
  approval. The Neon test project does not decide D-DB-2.
- Demo data only on Neon (D-CONTENT-16). Deleting a Neon project needs owner approval.
- No public issue text is filed by the agent (I6).
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-035. Read AGENTS.md and docs/milestones/m1-035-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
