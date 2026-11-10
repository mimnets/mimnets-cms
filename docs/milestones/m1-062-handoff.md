# m1-062 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-10, by the agent at the end of m1-061 (agent-executed; not a human approval) |
| **Task** | `m1-062`: an item the owner picks from §2 |
| **Preconditions** | The m1-061 PR is merged and its hosted checks are green. It also carries the m1-060 records (`0dc9ce2`), which missed PR #67 |
| **Branch** | `<type>/m1-062-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [decision register](../engineering/decision-register.md) (D-DB-12, D-DB-16, D-DB-17, D-SEC-8) · [m1-061 report](../engineering/reports/2026/11/2026-11-10-m1-061-npm-proxy-design.report.md) · [m1-061 paper](m1-061-npm-proxy-design.md) · [staging container runbook](../runbooks/staging-container.md) |

## 1. Carry-over

- **D-DB-17 is decided: A for real staging and production, B for shared hosts** (m1-061). B is the
  paper's §4 design: a dedicated Docker network to NPM, HTTP to an internal nginx port, `real_ip` from
  NPM's address only, NPM issues the certificate, `IP_RANGES_FETCH_ENABLED=false` on NPM, port 81 not
  public. **Nothing of B is built or tested.**
- **Without B, NPM in front breaks the per-visitor limits**: every visitor shares one rate-limit and
  one form-limit bucket (paper §1).
- Everything in the [m1-061 handoff](m1-061-handoff.md) §1 still applies: D-DB-16 (6.8 kernel line,
  watch for MongoDB 8.0.37), the standing approval for the hosted workflow's restore drill only, the
  OCI loopback-port test the owner will run later, and the leftovers from m1-060.

## 2. Candidate tasks

1. **Build B** (paper §5): `docker/staging/compose.npm.yaml` and the internal nginx block, tested
   locally with a throwaway NPM-like proxy, or with NPM itself if the owner approves its image for
   the test. Runbook section "NPM mode".
2. **The disposable test on the owner's OCI server**: on loopback ports with an SSH tunnel (m1-061
   handoff §2 item 1), or behind the owner's NPM once B is built (paper §6 checks). The owner runs
   the commands; needs the owner's approval for the server, the kernel check and any NPM change.
3. **Worker crash and PBM under load** on a disposable copy (m1-061 handoff §2 item 3).
4. **The PBM S3 tests** (D-DB-12), which need an account and spending approved.

## 3. Gates

- No new dependency, tool, action or image without approval. NPM's image in a test is an approval.
- Changing the owner's NPM, and anything on a server, needs the owner's approval.
- A restore drill outside the hosted workflow needs the owner's approval each time.
- Changing D-DB-8, D-DB-10, D-DB-12, D-DB-15, D-DB-16 or D-DB-17 needs the owner.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-062. Read AGENTS.md and docs/milestones/m1-062-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
