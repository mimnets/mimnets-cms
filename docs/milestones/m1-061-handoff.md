# m1-061 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-10, by the agent at the end of m1-060 (agent-executed; not a human approval) |
| **Task** | `m1-061`: an item the owner picks from §2 |
| **Preconditions** | The m1-060 PR (#67) is merged and its hosted checks are green |
| **Branch** | `<type>/m1-061-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [decision register](../engineering/decision-register.md) (D-DB-12, D-DB-15, D-DB-16, D-SEC-8) · [m1-060 report](../engineering/reports/2026/11/2026-11-10-m1-060-arm64-checks.report.md) · [staging container runbook](../runbooks/staging-container.md) · [PBM runbook](../runbooks/pbm-backup-and-restore.md) |

## 1. Carry-over

- **`arm64` is proven on a hosted runner** except Chrome and the suites: build, start, HTTPS, limits,
  an accepted upload, a PITR restore drill and a scan, all as on `amd64` (m1-060). The workflow now runs
  the drill and reads the kernel on every PR that touches the staging files.
- **The hosted workflow's restore drill has a standing approval** (owner, m1-060), for that throwaway
  runner only. Any other drill still needs the owner's approval each time.
- **D-DB-16 stands: A now, B later.** The runner is on `6.8.0-1070-azure`. The owner's PC's Docker VM is
  on 6.18.58, one step below MongoDB's limit. Watch for MongoDB 8.0.37 on Docker Hub.
- **The owner's OCI server** (Ubuntu 22.04, `aarch64`) runs Nginx Proxy Manager on 80, 81 and 443. For a
  disposable test the owner chose loopback ports in `docker/staging/.env`
  (`ASSURER_HTTP_BIND=127.0.0.1:8080`, `ASSURER_HTTPS_BIND=127.0.0.1:8443`,
  `APOS_BASE_URL=https://localhost:8443`, `ASSURER_DOMAIN=localhost`) and an SSH tunnel. The owner will
  run it later; check `uname -r` first.
- **Left from m1-060:** `staging-arm64-images.zip` (630 MB) in the owner's Downloads folder; the local
  `npm start` server on port 3000, if still running. `test:persistence` after a restart was not run.
- Everything in the [m1-060 handoff](m1-060-handoff.md) §1 still applies, except the `arm64` gaps closed.

## 2. Candidate tasks

1. **The disposable test on the owner's OCI server**, as agreed above. The owner runs the commands; the
   agent writes them and checks Chrome through the tunnel, as a non-admin editor. Needs the owner's
   approval for the server test and the kernel check.
2. **Behind Nginx Proxy Manager** (design): the network path from that proxy to the stack's nginx,
   `real_ip` in nginx so the rate limit and the logs see the visitor's address, and who issues the
   certificate. Touches D-DB-2/3/7; a paper first.
3. **Worker crash and PBM under load** on a disposable copy, on this stack with TLS and nginx. A local
   build needs a lot of memory; confirm with the owner first. The hosted runner may be an option.
4. **The PBM S3 tests** (D-DB-12), which need an account and spending approved.

Running the stack on a real staging server still waits for D-DB-2, D-DB-3 and D-DB-7 (DPO input I1) and
an approval.

## 3. Gates

- No new dependency, tool, action or image without approval. A newer `mongo` digest needs approval.
- A restore drill outside the hosted workflow needs the owner's approval each time (PBM runbook §3).
- Changing D-DB-8, D-DB-10, D-DB-12, D-DB-15 or D-DB-16 (and so ADR-0004) needs the owner.
- Scan again before production; D-SEC-8's "accepted" and "not affected" were decided for staging.
- Anything on a server, including the OCI test, needs the owner's approval.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-061. Read AGENTS.md and docs/milestones/m1-061-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
