# m1-042 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-04, by the agent at the end of m1-041 (agent-executed; not a human approval) |
| **Task** | `m1-042`, an item the owner picks. Candidates: (a) **MongoDB 8.0.x test run** (8.2 at most, the driver limit; D-DB-9): run the suites against it and settle [hardening runbook](../runbooks/server-hardening-and-patching.md) §12 choices 6 and 7 (tool approval); (b) **choose the MongoDB backup tool** for 7-day PITR, with the license and advisory check; (c) record D-DB-2, D-DB-3 and D-DB-7 once the DPO has answered I1; (d) privacy notice go-live after DPO review (D-CONTENT-15); (e) record the D-DB-5 and D-SEC-3 (a) and (c) issue URLs once the owner files them |
| **Precondition** | The m1-041 PR is merged (D-GIT-39) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-042-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-2 to D-DB-9) · [m1-041 report](../engineering/reports/2026/11/2026-11-04-m1-041-mongodb-9-oci.report.md) · [hardening runbook](../runbooks/server-hardening-and-patching.md) · [hosting options paper](m1-031-hosting-options.md) §10 |

## 1. State at the end of m1-041

- The owner skipped the local MongoDB test run and installed MongoDB 9.0.4 on their own OCI
  server. Apostrophe 4.34.0 accepts only `mongodb` driver 6.x, which supports servers up to 8.2.
  **D-DB-9 decided by the owner: C**: keep 9.0 there, not connected; development stays on
  SQLite; `.env` unchanged.
- Runbook §12 choices 6 and 7 are still open. No suite has run against MongoDB.
- Staging and production stay as recorded: Hetzner Cloud, Singapore (owner's preference,
  D-DB-2 and D-DB-7 still wait for the DPO).

## 2. Carry-over

- **Owner, first:** the MongoDB container on the OCI server is reachable from the internet
  without authentication (m1-041 report, security observations). Stop it, or recreate it bound
  to `127.0.0.1` with access control on, and remove any OCI ingress rule for 27017.
- Owner: remove the agent's key line (`m1-041-agent-…`) from the OCI server's
  `/root/.ssh/authorized_keys` when the agent no longer needs access.
- All items in the [m1-041 handoff §2](m1-041-handoff.md#2-carry-over) still apply: revoke the
  Neon API key, then remove the `NEON_*` lines from `.env` (owner); send the DPO question (I1)
  (owner); file the D-DB-5, D-SEC-3 (a) and D-SEC-3 (c) issues if wanted (owner); limit SSH in
  the runbook's §3 `ufw` example in the first staging task.
- Re-check D-DB-9 when Apostrophe releases a version that accepts driver 7.

## 3. Gates

- No new dependency or tool without approval (MongoDB server for the project, backup tool,
  nginx, ACME client, Node.js source, media copy tool, uptime service, MongoDB Compass: each with
  the license and advisory check). No npm `overrides` for the driver without a recorded decision.
- No provider choice, account creation, spending or production change without explicit owner
  approval. The DPO's answer alone does not create an account.
- `.env` may point at a MongoDB only for an approved test run, through a loopback address or SSH
  tunnel, and goes back to SQLite afterwards unless the owner decides otherwise.
- No public issue text is filed by the agent (I6).
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-042. Read AGENTS.md and docs/milestones/m1-042-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
