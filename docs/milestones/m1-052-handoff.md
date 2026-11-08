# m1-052 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-08, by the agent at the end of m1-051 (agent-executed; not a human approval) |
| **Task** | `m1-052`: an item the owner picks from §2 |
| **Preconditions** | The m1-051 PR is merged and its hosted CI checks are green |
| **Branch** | `<type>/m1-052-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-8, D-DB-10, D-DB-12, D-DB-13, D-SEC-5) · [m1-051 results](./m1-051-mongodb-load-test-results.md) · [m1-051 report](../engineering/reports/2026/11/2026-11-08-m1-051-mongodb-reversal.report.md) |

## 1. Carry-over

- **Engine (owner, 2026-11-08):** MongoDB Community Edition 8.0.x (8.0.30 or newer, 8.2 at most,
  D-DB-9), one container with the app (D-DB-10 (b)), PBM for backup (D-DB-12; S3 tests still due,
  account and spending to approve). D-DB-13 (SQLite with Litestream) is superseded. SQLite stays the
  local default.
- **Load test on MongoDB (m1-051):** HTTP, loop and errors pass at 8 readers; saves fail (46/59 and
  53/59 against 90%). At 4 readers and below everything passes. The limit is the single Node process.
- **Upstream db-connect issue:** the owner says it is filed; record the URL in m1-050 results §5 and
  D-DB-13 once given. The m1-049 dump issue is also still unfiled.
- Still to write: the ADR-0002 amendment or a new ADR for the engine history (D-DB-8 → D-DB-13 →
  D-DB-8); superseded notes on the SQLite and Litestream parts of the runbooks; whether the m1-049
  dump task and the Litestream proof of concept stay; the staging version of the one-container image.
- The dashboard: the Apostrophe admin layer stands; a read-only MongoDB viewer replaces Datasette,
  through the dependency gate.
- **Docker on the owner's PC is empty** (owner, end of m1-051): no containers, images or volumes,
  including the demo site and the PBM and Litestream proof-of-concept images. Any Docker task rebuilds
  from scratch and downloads the pinned base images (`node:24-bookworm`, `mongo:8.0.34`) again.
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO's answer to I1.

## 2. Candidate tasks

1. **Cluster mode on the MongoDB load test**: `APOS_CLUSTER_PROCESSES=2` (core Apostrophe option, no
   new package) on the disposable copy, with the load test's process lookup and loop probe changed to
   cover several workers. Retest at the agreed size and limit. Needs the owner's approval for the
   configuration and the run.
2. **Lighter menu query** in `views/layout.jsx`: load only the fields the menu needs.
3. **Records for the reversal**: the ADR, the superseded runbook notes, and the dump task decision.
4. **Staging image** for one container with MongoDB and PBM (TLS, no demo seed or default password,
   member authentication, nginx placement).

## 3. Gates

- No new dependency, tool or image without approval. Disposable copies only for load tests.
- Changing D-DB-8, D-DB-10 or D-DB-12 needs the owner.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-052. Read AGENTS.md and docs/milestones/m1-052-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
