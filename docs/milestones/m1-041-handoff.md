# m1-041 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-04, by the agent at the end of m1-040 (agent-executed; not a human approval) |
| **Task** | `m1-041`, an item the owner picks. Candidates: (a) **local MongoDB test run**: install MongoDB Community Server on the development machine (tool approval), run the project suites against it, check the server version against the Node driver, and settle [hardening runbook](../runbooks/server-hardening-and-patching.md) §12 choices 6 and 7; (b) **choose the MongoDB backup tool** for 7-day PITR, with the license and advisory check; (c) record D-DB-2, D-DB-3 and D-DB-7 once the DPO has answered I1; (d) privacy notice go-live after DPO review (D-CONTENT-15); (e) record the D-DB-5 and D-SEC-3 (a) and (c) issue URLs once the owner files them |
| **Precondition** | The m1-040 PR is merged (D-GIT-38) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-041-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-2 to D-DB-8) · [m1-040 report](../engineering/reports/2026/11/2026-11-04-m1-040-hardening-choices.report.md) · [hardening runbook](../runbooks/server-hardening-and-patching.md) · [hosting options paper](m1-031-hosting-options.md) §10 |

## 1. State at the end of m1-040

- Hardening runbook §12 choices 1–5 and 8 are decided by the owner (2026-11-04): LUKS data
  volume; x.509 member authentication on production with a key file acceptable on staging;
  nginx; weekly manual reboots; SSH from fixed admin addresses only; an external uptime check
  with email alerts. Recorded in the runbook and as a D-DB-7 note.
- Choices 6 (MongoDB major version) and 7 (`javascriptEnabled: false`) are deferred to the local
  MongoDB test run.
- The runbook is still **Draft, not yet executed**. No tool is approved by these choices: MongoDB,
  nginx, an ACME client for nginx (for example certbot), the backup tool, the media copy tool and
  the uptime service each need their own approval with the license and advisory check.
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO (I1).

## 2. Carry-over

- All items in the [m1-040 handoff §2](m1-040-handoff.md#2-carry-over) still apply: revoke the
  Neon API key, then remove the `NEON_*` lines from `.env` (owner); send the DPO question (I1)
  (owner); file the D-DB-5, D-SEC-3 (a) and D-SEC-3 (c) issues if wanted (owner).
- The runbook's `ufw` example in §3 allows port 22 from any address; with choice 5 decided, the
  first staging task should limit it to the admin addresses on the host firewall too.
- The admin addresses for choice 5 are supplied by the owner in the staging task.

## 3. Gates

- No new dependency or tool without approval (MongoDB server, backup tool, nginx, ACME client,
  Node.js source, media copy tool, uptime service: each with the license and advisory check).
- No provider choice, account creation, spending or production change without explicit owner
  approval. The DPO's answer alone does not create an account.
- `.env` may point at a local MongoDB only for the test run, and goes back to SQLite afterwards
  unless the owner decides otherwise.
- No public issue text is filed by the agent (I6).
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-041. Read AGENTS.md and docs/milestones/m1-041-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
