# m1-037 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-03, by the agent at the end of m1-036 (agent-executed; not a human approval) |
| **Task** | `m1-037`, an item the owner picks. Candidates: (a) **implement D-CONTENT-11 option B** (decided by the owner 2026-11-03; [options paper](m1-036-publishing-workflow-options.md) §5); the agent recommends this one; (b) **record the hosting decisions** D-DB-2, D-DB-3, D-DB-7 and D-DB-4 once inputs I1–I5 exist ([hosting options paper](m1-031-hosting-options.md) §7); (c) **privacy notice go-live** after DPO review (D-CONTENT-15); (d) record the D-DB-5 and D-SEC-3 (a) issue URLs once the owner files them |
| **Precondition** | The m1-036 PR is merged (D-GIT-34) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-037-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-11, D-M0-11, D-DB-2 to D-DB-7, D-CONTENT-15, D-SEC-3) · [m1-036 report](../engineering/reports/2026/11/2026-11-03-m1-036-publishing-workflow.report.md) · [publishing workflow options](m1-036-publishing-workflow-options.md) |

## 1. State at the end of m1-036

- D-CONTENT-11 options paper written: A direct publish · B review before publish (agent
  recommendation) · B1 as B with Global Content for editors only. **Owner decided B** (review before publish). The number of approvers is still open; ask before the implementation is finished
- The contributor flow is from source reading only; the implementation task must test it as a
  contributor and as an editor in Chrome.
- Hosting, privacy notice and the upstream issues: unchanged since m1-035.
- The repository is **public** (owner, 2026-11-03). The agent reads CI status through the public
  GitHub API without a token: `GET /repos/mimnets/vcl-assurer-group/commits/<sha>/check-runs`.
  The m1-035 merge (`6dca8dd`) has 5/5 checks green.

## 2. Carry-over

- All items in the [m1-036 handoff §2](m1-036-handoff.md#2-carry-over) still apply, including:
  revoke the Neon API key from m1-034, then remove the `NEON_*` lines from `.env` (owner); file the
  D-DB-5 and D-SEC-3 (a) issues (owner).
- The repository is public. The CI gitleaks job scans the full history on each run; nothing
  more is needed for secrets. Do not put personal data or secrets in any tracked file.

## 3. Gates

- No new dependency or tool without approval.
- No role change on real staff accounts; staff names are not stored in the repository.
- No provider choice, account creation, spending or production change without explicit owner
  approval.
- No public issue text is filed by the agent (I6).
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-037. Read AGENTS.md and docs/milestones/m1-037-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
