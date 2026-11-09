# m1-059 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-09, by the agent at the end of m1-058 (agent-executed; not a human approval) |
| **Task** | `m1-059`: an item the owner picks from §2 |
| **Preconditions** | The m1-058 records PR is merged and its hosted CI checks are green |
| **Branch** | `<type>/m1-059-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [decision register](../engineering/decision-register.md) (D-DB-12, D-DB-15, D-DB-16, D-SEC-5, D-SEC-8) · [m1-058 report](../engineering/reports/2026/11/2026-11-09-m1-058-staging-proof.report.md) · [staging container runbook](../runbooks/staging-container.md) · [PBM runbook](../runbooks/pbm-backup-and-restore.md) |

## 1. Carry-over

- **m1-058:** the staging proof passes on `amd64` (owner's PC) and `arm64` (hosted `ubuntu-22.04-arm`).
  The stack is **not ready for a server**.
- **The kernel (D-DB-16, open):** MongoDB 8.0 refuses Linux kernels 6.19 to 7.0.13. This PC's Docker VM is
  on 6.18.54. **If MongoDB stops with `MongoDB did not start` after a Docker Desktop update, check this
  first** with `docker info --format "{{.KernelVersion}}"`. The kernel of the `ubuntu-22.04-arm` runner
  is in the run's log, which the agent did not read.
- **Memory on this PC:** the first `$S build` fell from 6.5 GB available to 137 MB. A later one started at
  6.6 GB and fell to 1.2 GB. Docker's VM keeps memory afterwards; quitting Docker Desktop returned it
  fastest. Build `arm64` with the hosted workflow, not here. The owner agreed to watch and stop a build by
  quitting Docker Desktop; the stop itself is **still not tested**. Confirm before any build.
- **Merging:** the owner merged PRs #61 to #64 straight after opening them. Read each run on the PR that
  started it; a push after the merge starts no run. Keep records in their own PR.
- **Reading a run:** step results come from GitHub's public API. Logs need a login, so the owner pastes
  them. `gh` is not installed. The diagnostics step prints MongoDB's own lines after a failure.
- **Local test:** set `ASSURER_HTTP_BIND=127.0.0.1:80` and `ASSURER_HTTPS_BIND=127.0.0.1:443`. Chrome cannot
  pass the certificate warning; the owner does that. Closing Chrome to save memory disconnects the extension.
- **On this PC:** the four images, 24.13 GB of build cache and 14 volumes in the m1-058 report, Clean-up.
- Everything in the [m1-058 handoff](m1-058-handoff.md) §1 still applies, except what m1-058 closed.

## 2. Candidate tasks

1. **Decide the server kernel (agent's suggestion):** D-DB-16, once a server is known, because it can stop
   MongoDB outright. It can use the owner's OCI `arm64` server if approved, which would also be the first run
   on a real server. Waits on nothing for the paper part; a server run needs an approval.
2. **Worker crash and PBM under load** on a disposable copy, on this stack with TLS and nginx, which also
   checks the number of workers.
3. **The PBM S3 tests** (D-DB-12), which need an account and spending approved.
4. **The remaining `arm64` checks** in the hosted workflow: an accepted upload, a PBM restore, a scan.

Running the stack on a server still waits for D-DB-2, D-DB-3 and D-DB-7 (DPO input I1), D-DB-16 and an
approval.

## 3. Gates

- No new dependency, tool or image without approval. A newer `mongo` digest (for 8.0.37, when it ships) needs
  approval. Disposable copies only for load tests.
- A restore drill needs the owner's approval each time (PBM runbook §3).
- Changing D-DB-8, D-DB-10, D-DB-12 or D-DB-15 (and so ADR-0004) needs the owner. So does the workaround in
  D-DB-16 option C on anything but a labelled test.
- Scan again before production; D-SEC-8's "accepted" and "not affected" were decided for staging.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-059. Read AGENTS.md and docs/milestones/m1-059-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
