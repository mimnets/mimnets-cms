# m1-039 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-04, by the agent at the end of m1-038 (agent-executed; not a human approval) |
| **Task** | `m1-039`, an item the owner picks. Candidates: (a) **record D-DB-2, D-DB-3 and D-DB-7** (owner prefers Hetzner, Singapore) once the DPO has answered I1 ([question in the m1-038 report](../engineering/reports/2026/11/2026-11-04-m1-038-hosting-inputs.report.md#question-for-the-dpo-i1)); (b) **privacy notice go-live** after DPO review (D-CONTENT-15); (c) MongoDB preparation that does not wait for the DPO (§1); (d) record the D-SEC-3 (a) and (c) issue URLs once the owner files them; (e) a submit notification for approvers, if the owner wants one (custom code; needs its own decision under D-CONTENT-11) |
| **Precondition** | The m1-038 PR is merged (D-GIT-36) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-039-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-2 to D-DB-8, D-CONTENT-15) · [m1-038 report](../engineering/reports/2026/11/2026-11-04-m1-038-hosting-inputs.report.md) · [hosting options paper](m1-031-hosting-options.md) |

## 1. State at the end of m1-038

- Owner inputs recorded: I2 not a factor; I3 about $50–100/month for staging and production; I4
  in-house, limited ops.
- **D-DB-4 decided** by the business owner: 7-day PITR, database RPO ≤ 15 min, media RPO ≤ 24 h,
  RTO ≤ 4 h, monthly exports (12 kept), quarterly restore drill.
- **D-DB-8 decided** by the owner: **MongoDB** (Community Server) for staging and production.
  D-DB-5 and the D-DB-6 blockers no longer block staging.
- Owner's hosting preference: **Hetzner Cloud, Singapore, self-hosted** (options paper §10):
  MongoDB as a replica set with a continuous backup tool (approved in principle), app under
  systemd behind a TLS proxy, media on the server disk with a nightly copy to a versioned Hetzner
  bucket in the EU. D-DB-2, D-DB-3 and D-DB-7 wait for the DPO (I1: Singapore, and the EU copies).
- Work that does not wait for the DPO, each a candidate task with its own approvals:
  - run the project suites against a local MongoDB (development only; the MongoDB server
    install is a tool that needs approval);
  - choose the MongoDB backup tool, with the license and advisory check;
  - draft a server hardening and patching runbook (firewall, MongoDB bound to private interfaces
    with authentication and TLS, full-disk encryption, TLS proxy, unattended security updates).

## 2. Carry-over

- All items in the [m1-038 handoff §2](m1-038-handoff.md#2-carry-over) still apply, including:
  revoke the Neon API key from m1-034, then remove the `NEON_*` lines from `.env` (owner); file the
  D-DB-5, D-SEC-3 (a) and D-SEC-3 (c) issues (owner).
- **Owner:** send the DPO question (I1).
- After D-DB-2, D-DB-3 and D-DB-7 are recorded, the path to staging in the options paper §8
  applies with MongoDB in place of PostgreSQL (steps 2 and 3 fall away), one task per step, each
  with its own approvals.
- The D-DB-5 upstream issue is still useful to the Apostrophe community but no longer blocks this
  project; filing it stays the owner's choice.

## 3. Gates

- No new dependency or tool without approval.
- No role change on real staff accounts; staff names are not stored in the repository.
- No provider choice, account creation, spending or production change without explicit owner
  approval. The DPO's answer alone does not create an account.
- No public issue text is filed by the agent (I6).
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-039. Read AGENTS.md and docs/milestones/m1-039-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
