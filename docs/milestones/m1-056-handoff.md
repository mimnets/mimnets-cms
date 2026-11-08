# m1-056 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-08, by the agent at the end of m1-055 (agent-executed; not a human approval) |
| **Task** | `m1-056`: an item the owner picks from §2 |
| **Preconditions** | The m1-055 PR is merged and its hosted CI checks are green (D-GIT-53) |
| **Branch** | `<type>/m1-056-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [decision register](../engineering/decision-register.md) (D-DB-12, D-DB-15, D-SEC-5, D-SEC-8) · [m1-055 report](../engineering/reports/2026/11/2026-11-08-m1-055-staging-image.report.md) · [staging container runbook](../runbooks/staging-container.md) · [PBM runbook](../runbooks/pbm-backup-and-restore.md) |

## 1. Carry-over

- **m1-055:** the staging stack in `docker/staging/` works on `linux/amd64` on the owner's PC. It is
  **not ready for a server**: D-SEC-8 is not resolved (direction A, not yet tried), and `arm64` has not been built.
- **Local run limits:** demo-sized data; Chrome tested the editor UI bypassing nginx.
- **Memory:** the `arm64` build was stopped when the PC ran critically low on memory (0.4 of 15.7 GB
  free). Close other programs before repeating it, and do not start it without checking.
- **Windows shell:** with `MSYS_NO_PATHCONV=1`, native `curl` cannot write to `/dev/null`; compare
  bytes in Node or write to a real file.
- **Docker on the owner's PC** holds the images listed in the m1-055 report, Clean-up; no containers or
  volumes from m1-055.
- Everything in the [m1-055 handoff](m1-055-handoff.md) §1 still applies.

## 2. Candidate tasks

1. **Close the m1-055 gaps (agent's suggestion):** try D-SEC-8 option A (replace `gosu`, drop `esbuild` from the final image), run the suites and rescan; the `arm64` build and start; an accepted
   upload through nginx with a byte comparison; Chrome through nginx, if the owner clicks through
   the local certificate warning or chooses another way; the runbook commands as written.
2. **Worker crash and PBM under load** on a disposable copy, on this stack with TLS and nginx, which
   also checks the number of workers (m1-055 handoff §2 candidate 2).
3. **The PBM S3 tests** (D-DB-12), which need an account and spending approved.

Running the stack on a server still waits for D-DB-2, D-DB-3 and D-DB-7 (DPO input I1) and an approval.

## 3. Gates

- No new dependency, tool or image without approval. Disposable copies only for load tests.
- Changing D-DB-8, D-DB-10, D-DB-12 or D-DB-15 (and so ADR-0004) needs the owner.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-056. Read AGENTS.md and docs/milestones/m1-056-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
