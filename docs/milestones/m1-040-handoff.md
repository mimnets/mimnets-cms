# m1-040 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-04, by the agent at the end of m1-039 (agent-executed; not a human approval) |
| **Task** | `m1-040`, an item the owner picks. Candidates: (a) **local MongoDB test run**: install MongoDB Community Server on the development machine (tool approval), run the project suites against it, check the server version against the Node driver, and settle runbook §12 choices 6 and 7; (b) **choose the MongoDB backup tool** for 7-day PITR, with the license and advisory check; (c) record the owner's answers to the [hardening runbook](../runbooks/server-hardening-and-patching.md) §12 choices; (d) record D-DB-2, D-DB-3 and D-DB-7 once the DPO has answered I1; (e) privacy notice go-live after DPO review (D-CONTENT-15); (f) record the D-DB-5 and D-SEC-3 (a) and (c) issue URLs once the owner files them |
| **Precondition** | The m1-039 PR is merged (D-GIT-37) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-040-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-2 to D-DB-8) · [m1-039 report](../engineering/reports/2026/11/2026-11-04-m1-039-hardening-runbook.report.md) · [hardening runbook](../runbooks/server-hardening-and-patching.md) · [hosting options paper](m1-031-hosting-options.md) §10 |

## 1. State at the end of m1-039

- New [server hardening and patching runbook](../runbooks/server-hardening-and-patching.md),
  **Draft, not yet executed**. It covers SSH, the Hetzner and host firewalls, Ubuntu automatic
  updates, disk encryption options, MongoDB (loopback, authentication, TLS, one-member replica
  set, per-purpose users), the systemd unit, TLS proxy requirements, backups, the patching cadence
  and a verification checklist for staging.
- Eight open choices in runbook §12 for the owner: disk encryption, MongoDB member authentication,
  TLS proxy, reboot handling, SSH source addresses, MongoDB major version, server-side JavaScript,
  monitoring. Choices 1 and 4 go together; 6 and 7 are settled by the local MongoDB test run.
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO (I1).

## 2. Carry-over

- All items in the [m1-039 handoff §2](m1-039-handoff.md#2-carry-over) still apply: revoke the
  Neon API key, then remove the `NEON_*` lines from `.env` (owner); send the DPO question (I1)
  (owner); file the D-DB-5, D-SEC-3 (a) and D-SEC-3 (c) issues if wanted (owner).

## 3. Gates

- No new dependency or tool without approval (MongoDB server, backup tool, TLS proxy, Node.js
  source, media copy tool: each with the license and advisory check).
- No provider choice, account creation, spending or production change without explicit owner
  approval. The DPO's answer alone does not create an account.
- `.env` may point at a local MongoDB only for the test run, and goes back to SQLite afterwards
  unless the owner decides otherwise.
- No public issue text is filed by the agent (I6).
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-040. Read AGENTS.md and docs/milestones/m1-040-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
