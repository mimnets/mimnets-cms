# m1-027 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-01, by the agent at the end of m1-026 (agent-executed; not a human approval) |
| **Task** | `m1-027`, an item the owner picks. Candidates: (a) **privacy page content** (CA-6; needs the notice text from the owner or DPO); (b) **CA-5 preparation** (content migration; needs owner-approved copy and D-CONTENT-4) |
| **Precondition** | The m1-026 PR is merged (D-GIT-24) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-027-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-4, D-CONTENT-11, D-CONTENT-12, D-CONTENT-14) · [m1-026 report](../engineering/reports/2026/11/2026-11-01-m1-026-admin-bar-jump.report.md) · [implementation plan](../content/implementation-plan-and-risks.md#2-prioritised-implementation-plan) |

## 1. State at the end of m1-026

- `fix/m1-026-admin-bar-jump` holds: project CSS reserves the admin bar's height until core
  mounts it (56 px, or 111 px with the context bar), a body class from `views/layout.jsx` for the
  context bar, records and this handoff. Commit, push and PR approved by the owner (D-GIT-24).
- All local suites pass, including `test:ci` (see the report). Browser checks at 768 and 375 px
  were not run.

## 2. Candidates

### 2.1 Privacy page content (CA-6)

As in the [m1-023 handoff §2.1](m1-023-handoff.md#21-privacy-page-content-ca-6): the text must
come from the owner or DPO; the agent must not write legal text.

### 2.2 CA-5 preparation (content migration)

As in the [m1-023 handoff §2.2](m1-023-handoff.md#22-ca-5-preparation-content-migration).

## 3. Carry-over

- After any Apostrophe upgrade: compare the admin bar height with the two values in
  `_assurer.scss` (m1-026 report, "Maintenance").
- D-CONTENT-11 (publishing workflow; editors publish and edit Global Content) still open before
  staff rollout.
- From m1-021: brand values (D-CONTENT-12), SVG logo master, header logo size review, literal
  paddings, card grids switch at 640 px (requirements say 768 px), no `/favicon.ico`.
- From m1-025: fallback font for one or two frames on the dev server (font preload would reduce
  it); `localhost:<port>` shares any admin session on `localhost` (test on `127.0.0.1`); start a
  second dev server only after the first has finished restarting (shared `apos-build/`).
- Stale `vcl-assurer-group.loggedIn` cookie causes one extra reload per URL (core behaviour, see
  the m1-024 report, F4).

## 4. Gates

- No new dependency without approval.
- Commit, push and PR need owner approval.

## 5. Prompt for the new session

> Start m1-027. Read AGENTS.md and docs/milestones/m1-027-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
