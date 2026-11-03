# m1-036 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-03, by the agent at the end of m1-035 (agent-executed; not a human approval) |
| **Task** | `m1-036`, an item the owner picks. Candidates: (a) **record the hosting decisions** D-DB-2, D-DB-3, D-DB-7 and D-DB-4 once the owner and DPO inputs exist (D-DB-7: automatic restart is required); (b) **privacy notice go-live** (CA-6, after DPO review, D-CONTENT-15); (c) **D-CONTENT-11** (publishing workflow); (d) after the owner files the D-DB-5 issue, record its URL and track the upstream response |
| **Precondition** | The m1-035 PR is merged (D-GIT-33) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-036-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-2 to D-DB-7, D-CONTENT-11, D-CONTENT-15, D-SEC-3) · [m1-035 report](../engineering/reports/2026/11/2026-11-03-m1-035-d-db-5-upstream-issue.report.md) · [D-DB-5 proposal](m1-d-db-5-postgresql-connection-loss-proposal.md) · [hosting options paper](m1-031-hosting-options.md) |

## 1. State at the end of m1-035

- The D-DB-5 proposal §2 issue text now includes the m1-033 and m1-034 results. A new duplicate
  search found no matching upstream issue (#5604 is related only). db-connect is still 1.1.0.
- The issue is **not filed**. The owner reviews the text and files it (I6). D-DB-5 stays **OPEN**.
- Hosting: nothing decided.

## 2. Carry-over

- All items in the [m1-035 handoff §2](m1-035-handoff.md#2-carry-over) still apply, including:
  revoke the Neon API key from m1-034, then remove the `NEON_*` lines from `.env` (owner).
- **Owner:** file the D-DB-5 issue (proposal §2) and the D-SEC-3 (a) issue
  ([m1-012 drafts](m1-012-upstream-issue-drafts.md)), and give the agent the URLs to record.
- `gh` is still not installed; CI status is stated by the owner.

## 3. Gates

- No new dependency or tool without approval.
- No provider choice, account creation, spending or production change without explicit owner
  approval.
- No public issue text is filed by the agent (I6).
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-036. Read AGENTS.md and docs/milestones/m1-036-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
