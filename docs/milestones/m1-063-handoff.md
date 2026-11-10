# m1-063 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-10, by the agent at the end of m1-062 (agent-executed; not a human approval) |
| **Task** | `m1-063`: an item the owner picks from §2 |
| **Preconditions** | The m1-062 PR is merged and its hosted checks are green, including `staging-arm64`, which runs because the PR touches `docker/staging/` |
| **Branch** | `<type>/m1-063-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-12, D-DB-16, D-DB-17) · [m1-062 report](../engineering/reports/2026/11/2026-11-10-m1-062-npm-mode.report.md) · [m1-061 paper](m1-061-npm-proxy-design.md) · [staging container runbook](../runbooks/staging-container.md) §9 |

## 1. Carry-over

- **The NPM mode is built** (`docker/staging/compose.npm.yaml`, nginx's internal `:8080` block,
  runbook §9) and passes every local check against a stand-in for NPM (m1-062). **Not tested with
  NPM itself, on a server, over IPv6 or with a real certificate.**
- The owner's NPM changes are documented in runbook §9 and **not made**: the `assurer-npm` network,
  NPM's fixed address `172.30.56.2`, `IP_RANGES_FETCH_ENABLED=false`, port 81 off the internet.
- Everything in the [m1-062 handoff](m1-062-handoff.md) §1 still applies: D-DB-17 (A for real staging
  and production, B for shared hosts), D-DB-16 (6.8 kernel line, watch for MongoDB 8.0.37), the
  standing approval for the hosted workflow's restore drill only.
- **Left on the owner's PC:** `assurer-nginx:staging` rebuilt with the NPM files; the Chrome
  certificate exception for `localhost`; the local `npm start` server on port 3000.

## 2. Candidate tasks

1. **The disposable test on the owner's OCI server behind the owner's NPM** (paper §6, runbook §9).
   The owner runs the commands and makes the NPM changes; needs the owner's approval for the server,
   the kernel check (`uname -r`, D-DB-16) and each NPM change. Settles §6 checks 3 (the visitor's
   address reaches NPM, IPv4 and IPv6), 6 and 7, and the Compose version for `!reset`.
2. **Worker crash and PBM under load** on a disposable copy (m1-061 handoff §2 item 3).
3. **The PBM S3 tests** (D-DB-12), which need an account and spending approved.

## 3. Gates

- No new dependency, tool, action or image without approval. NPM's image in a test is an approval.
- Changing the owner's NPM, and anything on a server, needs the owner's approval.
- A restore drill outside the hosted workflow needs the owner's approval each time.
- Changing D-DB-8, D-DB-10, D-DB-12, D-DB-15, D-DB-16 or D-DB-17 needs the owner.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-063. Read AGENTS.md and docs/milestones/m1-063-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
