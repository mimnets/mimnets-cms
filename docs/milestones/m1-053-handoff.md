# m1-053 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-08, by the agent at the end of m1-052 (agent-executed; not a human approval) |
| **Task** | `m1-053`: an item the owner picks from §2 |
| **Preconditions** | The m1-052 PR is merged and its hosted CI checks are green |
| **Branch** | `<type>/m1-053-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [decision register](../engineering/decision-register.md) (D-DB-8, D-DB-10, D-DB-12, D-DB-14, D-SEC-5) · [m1-052 report](../engineering/reports/2026/11/2026-11-08-m1-052-mongodb-reversal-records.report.md) |

## 1. Carry-over

- **ADR-0004 is accepted** (owner, 2026-11-08, D-DB-14). It supersedes ADR-0002 in part.
- **Engine:** MongoDB Community Edition 8.0.x (8.0.30 or newer, 8.2 at most), one container with the
  app, PBM for backup (S3 tests still due; account and spending to approve). SQLite stays local.
- **Load test on MongoDB (m1-051):** saves fail at 8 readers; at 4 readers and below everything
  passes. The limit is the single Node process.
- The m1-049 dump task is removed. The Litestream files in `docker/litestream-poc/` are kept as
  evidence only.
- The upstream db-connect issue URL (m1-050 results §5, D-DB-13) is still not recorded.
- **Docker on the owner's PC is empty.** Any Docker task rebuilds and downloads the pinned base
  images (`node:24-bookworm`, `mongo:8.0.34`) again.
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO's answer to I1.

## 2. Candidate tasks

1. **Cluster mode on the MongoDB load test**: `APOS_CLUSTER_PROCESSES=2` (core option, no new
   package) on a disposable copy, with the load test's process lookup and loop probe changed to
   cover several workers. Needs approval for the configuration, the image build and the run.
2. **Lighter menu query** in `views/layout.jsx`: load only the fields the menu needs.
3. **Staging image** for one container with MongoDB and PBM: TLS, member authentication, no demo
   seed or default password, nginx placement. Includes a PBM runbook and the hardening runbook §6
   and §7 rewrite.

## 3. Gates

- No new dependency, tool or image without approval. Disposable copies only for load tests.
- Changing D-DB-8, D-DB-10 or D-DB-12 (and so ADR-0004) needs the owner.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-053. Read AGENTS.md and docs/milestones/m1-053-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
