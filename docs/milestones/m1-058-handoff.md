# m1-058 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-09, by the agent at the end of m1-057 (agent-executed; not a human approval) |
| **Task** | `m1-058`: an item the owner picks from §2 |
| **Preconditions** | The m1-057 PR is merged and its hosted CI checks are green |
| **Branch** | `<type>/m1-058-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [decision register](../engineering/decision-register.md) (D-DB-12, D-DB-15, D-SEC-5, D-SEC-8) · [m1-057 report](../engineering/reports/2026/11/2026-11-09-m1-057-staging-findings.report.md) · [staging container runbook](../runbooks/staging-container.md) · [PBM runbook](../runbooks/pbm-backup-and-restore.md) |

## 1. Carry-over

- **m1-057:** D-SEC-8 is decided. nginx is down to 1 high finding, measured. The `apt` upgrade in
  `docker/staging/Dockerfile` is **written but never built**, so it may fail. The stack is **not ready
  for a server**.
- **No images on this PC.** The owner cleared them to free space and memory, so the site image must be
  built from the start. The build cache remains (21.7 GB), which may help.
- **No tested memory stop.** The permission check refused force-killing `docker.exe` by name; do not
  retry it. The owner approved the agent's suggestion that the owner watches a site build and stops it
  ("i approve all"), and added "this won't happen again for memory". The agent does not know what that
  second part rests on, so **confirm with the owner before any site build**, and still read available
  memory first.
- **`gh` is not installed.** Hosted checks can be read from GitHub's public API. The owner opens PRs or
  approves installing `gh`.
- **Windows shell:** native `curl` cannot write to `/tmp`; use the scratchpad. The nginx base image has
  no `openssl` command.
- Everything in the [m1-057 handoff](m1-057-handoff.md) §1 still applies, including the 6 GB limit and
  restarting first.

## 2. Candidate tasks

1. **Finish the staging proof (agent's suggestion):** after a restart and with a stop method agreed,
   the runbook's `$S build` and `$S` commands as written, which also proves the `apt` upgrade; a site
   rescan (6 findings expected); nginx proxying to the real site, with upload and rate limits on the
   changed image; then the `arm64` build and start. If this PC cannot do it, the owner chooses another
   way.
2. **Worker crash and PBM under load** on a disposable copy, on this stack with TLS and nginx, which
   also checks the number of workers.
3. **The PBM S3 tests** (D-DB-12), which need an account and spending approved.

Running the stack on a server still waits for D-DB-2, D-DB-3 and D-DB-7 (DPO input I1) and an approval.

## 3. Gates

- No new dependency, tool or image without approval. Disposable copies only for load tests.
- A restore drill needs the owner's approval each time (PBM runbook §3).
- Changing D-DB-8, D-DB-10, D-DB-12 or D-DB-15 (and so ADR-0004) needs the owner.
- Scan again before production; D-SEC-8's "accepted" and "not affected" were decided for staging.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-058. Read AGENTS.md and docs/milestones/m1-058-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
