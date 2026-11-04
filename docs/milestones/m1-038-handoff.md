# m1-038 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-03, by the agent at the end of m1-037 (agent-executed; not a human approval) |
| **Task** | `m1-038`, an item the owner picks. Candidates: (a) **record the hosting decisions** D-DB-2, D-DB-3, D-DB-7 and D-DB-4 once inputs I1–I5 exist ([hosting options paper](m1-031-hosting-options.md) §7); (b) **privacy notice go-live** after DPO review (D-CONTENT-15); (c) record the D-DB-5 and D-SEC-3 (a) and (c) issue URLs once the owner files them; (d) a submit notification for approvers, if the owner wants one (custom code; needs its own decision under D-CONTENT-11) |
| **Precondition** | The m1-037 PR is merged (D-GIT-35) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-038-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-11, D-SEC-3, D-DB-2 to D-DB-7, D-CONTENT-15) · [m1-037 report](../engineering/reports/2026/11/2026-11-03-m1-037-publishing-workflow.report.md) · [publishing workflow guide](../content/publishing-workflow-guide.md) |

## 1. State at the end of m1-037

- D-CONTENT-11 option B implemented: core `contributor` submits, `editor` publishes, one approval
  per change. Tested by `test:ci` (publishing-workflow suite) and in Chrome as contributor and
  editor (agent-executed).
- A project delete guard (`modules/@apostrophecms/doc/index.js`) works around a core gap: a
  contributor's delete of a published document's draft (D-SEC-3 (c)).
- Contributors cannot add images or files; editors add media (core roles). The options paper §8
  and the staff guide say so.
- Hosting, privacy notice and the other upstream issues: unchanged since m1-036.

## 2. Carry-over

- All items in the [m1-037 handoff §2](m1-037-handoff.md#2-carry-over) still apply, including:
  revoke the Neon API key from m1-034, then remove the `NEON_*` lines from `.env` (owner); file the
  D-DB-5 and D-SEC-3 (a) issues (owner).
- **Owner:** file D-SEC-3 (c) (text in the m1-037 report); review the staff guide; choose the
  approvers and the contributors, and how contributors tell approvers about waiting drafts. Names
  are not stored in the repository.
- Real staff accounts get roles only on the owner's instruction, through the supported user task
  or the Users manager.

## 3. Gates

- No new dependency or tool without approval.
- No role change on real staff accounts; staff names are not stored in the repository.
- No provider choice, account creation, spending or production change without explicit owner
  approval.
- No public issue text is filed by the agent (I6).
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-038. Read AGENTS.md and docs/milestones/m1-038-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
