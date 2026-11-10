# m1-060 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-10, by the agent at the end of m1-059 (agent-executed; not a human approval) |
| **Task** | `m1-060`: an item the owner picks from §2 |
| **Preconditions** | The m1-059 PR is merged and its hosted CI checks are green |
| **Branch** | `<type>/m1-060-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [decision register](../engineering/decision-register.md) (D-DB-12, D-DB-15, D-DB-16, D-SEC-8) · [m1-059 report](../engineering/reports/2026/11/2026-11-10-m1-059-server-kernel.report.md) · [m1-059 paper](m1-059-server-kernel.md) · [staging container runbook](../runbooks/staging-container.md) |

## 1. Carry-over

- **D-DB-16 is decided (m1-059): A now, B later.** Servers stay on Ubuntu 24.04's 6.8 kernel line
  (`linux-generic` or `linux-virtual`; `linux-oracle-lts-24.04` on OCI); no `*-hwe-24.04` kernel. MongoDB
  8.0.34 refuses every Ubuntu 7.0 kernel until 8.0.37. The `apt` steps are **not tested**.
- **Watch for MongoDB 8.0.37** on Docker Hub. Pinning its digest needs approval, then a rebuild and the
  staging proof again. That task is option B of D-DB-16.
- The owner's OCI server was not checked. Per m1-042 it is Ubuntu 22.04 `aarch64`, whose `linux-oracle` is
  on 6.8 today.
- The owner's PC's Docker VM was on 6.18.54 (m1-058). A Docker Desktop update can stop MongoDB there.
  Check `docker info --format "{{.KernelVersion}}"` first if MongoDB does not start.
- Everything in the [m1-059 handoff](m1-059-handoff.md) §1 still applies, except the kernel decision.

## 2. Candidate tasks

1. **Worker crash and PBM under load** on a disposable copy, on this stack with TLS and nginx, which also
   checks the number of workers. A local build needs a lot of memory; confirm with the owner first.
2. **The PBM S3 tests** (D-DB-12), which need an account and spending approved.
3. **The remaining `arm64` checks** in the hosted workflow: an accepted upload, a PBM restore, a scan. It can
   also print the runner's kernel with `uname -r` in the step summary.
4. **A read-only kernel check of the OCI server** (`uname -r`, `dpkg -l 'linux-*' | grep ^ii`), run by the
   owner or approved for the agent. Optional: a `uname -r` message in the site's start script (m1-059
   paper §5 item 4), which needs approval and a rebuild.

Running the stack on a server still waits for D-DB-2, D-DB-3 and D-DB-7 (DPO input I1) and an approval.

## 3. Gates

- No new dependency, tool or image without approval. A newer `mongo` digest needs approval.
- A restore drill needs the owner's approval each time (PBM runbook §3).
- Changing D-DB-8, D-DB-10, D-DB-12, D-DB-15 or D-DB-16 (and so ADR-0004) needs the owner.
- Scan again before production; D-SEC-8's "accepted" and "not affected" were decided for staging.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-060. Read AGENTS.md and docs/milestones/m1-060-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
