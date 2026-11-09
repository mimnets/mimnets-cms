# m1-057 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-09, by the agent at the end of m1-056 (agent-executed; not a human approval) |
| **Task** | `m1-057`: an item the owner picks from §2 |
| **Preconditions** | The m1-056 PR is merged and its hosted CI checks are green |
| **Branch** | `<type>/m1-057-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [decision register](../engineering/decision-register.md) (D-DB-12, D-DB-15, D-SEC-5, D-SEC-8) · [m1-056 report](../engineering/reports/2026/11/2026-11-09-m1-056-staging-gaps.report.md) · [staging container runbook](../runbooks/staging-container.md) · [PBM runbook](../runbooks/pbm-backup-and-restore.md) |

## 1. Carry-over

- **m1-056:** on `linux/amd64`, the site image went from 78 critical and high findings to 7, with no
  critical left, and works. The stack is **not ready for a server**: the owner has not decided the
  remaining findings, and `arm64` is not proven.
- **Memory:** read `\Memory\Available MBytes`, not only the free figure. Docker's VM keeps its memory
  for some minutes after a build ends (about 6 GB seen; 5.5 GB available again later), so restart first. A native `$S build` took available memory
  from 2.8 GB to 382 MB. **Do not start the `arm64` build under 6 GB available.**
- **A memory stop rule must end the real processes.** In m1-056, `kill` ended only the Git Bash wrapper,
  and `docker compose build` and `buildx` kept running. Test the stop before relying on it.
- **Windows shell:** use `MSYS_NO_PATHCONV=1` for `docker exec` with container paths. Temp cleanup can
  remove scratchpad files overnight, so write them again before use. `@apostrophecms/user:add` waits
  forever if its piped password has no trailing newline.
- **Chrome:** the extension cannot operate a certificate warning page; the owner has to click through.
  The site answers some seconds after the log line "Started".
- **Docker on the owner's PC** holds the images in the m1-056 report, Clean-up.
- Everything in the [m1-056 handoff](m1-056-handoff.md) §1 still applies, except what m1-056 closed.

## 2. Candidate tasks

1. **Finish the m1-056 gaps (agent's suggestion):** after a restart, the runbook's `$S build` and the
   `$S` commands as written; then the `arm64` build and start, with at least 6 GB available. If this PC
   cannot do it, the owner chooses another way.
2. **Decide the remaining findings (D-SEC-8):** the 7 in the site image, and nginx and certbot. A newer
   `mongo` digest or `apt` upgrade needs approval.
3. **Worker crash and PBM under load** on a disposable copy, on this stack with TLS and nginx, which
   also checks the number of workers.
4. **The PBM S3 tests** (D-DB-12), which need an account and spending approved.

Running the stack on a server still waits for D-DB-2, D-DB-3 and D-DB-7 (DPO input I1) and an approval.

## 3. Gates

- No new dependency, tool or image without approval. Disposable copies only for load tests.
- A restore drill needs the owner's approval each time (PBM runbook §3).
- Changing D-DB-8, D-DB-10, D-DB-12 or D-DB-15 (and so ADR-0004) needs the owner.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-057. Read AGENTS.md and docs/milestones/m1-057-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
