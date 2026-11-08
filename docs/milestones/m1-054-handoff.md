# m1-054 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-08, by the agent at the end of m1-053 (agent-executed; not a human approval) |
| **Task** | `m1-054`: an item the owner picks from §2 |
| **Preconditions** | The m1-053 PR is merged and its hosted CI checks are green |
| **Branch** | `<type>/m1-054-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [decision register](../engineering/decision-register.md) (D-DB-8, D-DB-10, D-DB-12, D-DB-14, D-SEC-5) · [m1-053 report](../engineering/reports/2026/11/2026-11-08-m1-053-lighter-menu-query.report.md) |

## 1. Carry-over

- **m1-053:** the menu's children query projects `title`, `path`, `aposDocId`, `_url`
  (`modules/@apostrophecms/page/index.js`). A template that reads more of a menu item must add the
  field there. Output identical; menu data about half at the m1-050 size; no measurable time change
  on local SQLite; not measured on MongoDB.
- **CI:** the gitleaks download now retries and falls back to the API download of the same file
  (m1-053). `GITLEAKS_ASSET_ID` must change together with `GITLEAKS_VERSION`.
- Everything in the [m1-053 handoff](m1-053-handoff.md) §1 still applies: ADR-0004 accepted,
  MongoDB 8.0.x in one container with PBM, saves fail at 8 readers on MongoDB (single Node process),
  Docker on the owner's PC is empty, the db-connect issue URL is not recorded, D-DB-2, D-DB-3 and
  D-DB-7 wait for the DPO.

## 2. Candidate tasks

1. **Cluster mode on the MongoDB load test**: `APOS_CLUSTER_PROCESSES=2` (core option, no new
   package) on a disposable copy, with the load test's process lookup and loop probe changed to
   cover several workers. The same run can measure the m1-053 menu change on MongoDB. Needs approval
   for the configuration, the image build and the run.
2. **Staging image** for one container with MongoDB and PBM: TLS, member authentication, no demo
   seed or default password, nginx placement. Includes a PBM runbook and the hardening runbook §6
   and §7 rewrite.

## 3. Gates

- No new dependency, tool or image without approval. Disposable copies only for load tests.
- Changing D-DB-8, D-DB-10 or D-DB-12 (and so ADR-0004) needs the owner.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-054. Read AGENTS.md and docs/milestones/m1-054-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
