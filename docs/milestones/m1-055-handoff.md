# m1-055 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-08, by the agent at the end of m1-054 (agent-executed; not a human approval) |
| **Task** | `m1-055`: an item the owner picks from §2 |
| **Preconditions** | The m1-054 PR is merged and its hosted CI checks are green |
| **Branch** | `<type>/m1-055-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [decision register](../engineering/decision-register.md) (D-DB-8, D-DB-10, D-DB-12, D-DB-14, D-SEC-5) · [m1-054 report](../engineering/reports/2026/11/2026-11-08-m1-054-cluster-mode-load-test.report.md) · [m1-054 results](./m1-054-cluster-mode-results.md) |

## 1. Carry-over

- **m1-054:** on MongoDB at the 3x size, one Node process now passes the agreed profile (8 readers;
  saves 59/59 and 58/59), consistent with the m1-053 menu projection but not a controlled A/B. With
  `APOS_CLUSTER_PROCESSES=2`, every limit passes with margin (HTTP p99 about 270–310 ms, save p50
  about 0.6 s) for about 0.6 GiB more memory; 4 workers add little. Agent's suggestion for staging:
  2 workers, sized against the server's memory with MongoDB's cache. Not decided.
- **Load test:** `scripts/load-test.mjs` now measures every worker in cluster mode; the probe writes
  `/tmp/loop-delay-<pid>.json`. `APOS_CLUSTER_PROCESSES` in the load-test compose, empty = one process.
- **Docker on the owner's PC** now holds `assurer-site:load-test-mongo` and the pulled base images;
  no containers or volumes from m1-054.
- Everything in the [m1-054 handoff](m1-054-handoff.md) §1 still applies, except that the m1-053
  change has now been measured on MongoDB (above).

## 2. Candidate tasks

1. **Staging image** for one container with MongoDB and PBM: TLS, member authentication, no demo
   seed or default password, nginx placement, and the number of cluster workers (m1-054 §3). Includes
   a PBM runbook and the hardening runbook §6 and §7 rewrite. Needs approval for any new image or tool.
2. **Worker crash and PBM under load** on a disposable copy: kill a worker during a load run, and
   run a PBM backup during one. Needs approval for the image build and the run.

## 3. Gates

- No new dependency, tool or image without approval. Disposable copies only for load tests.
- Changing D-DB-8, D-DB-10 or D-DB-12 (and so ADR-0004) needs the owner.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-055. Read AGENTS.md and docs/milestones/m1-055-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
