# m1-023 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-01, by the agent at the end of m1-022 (agent-executed; not a human approval) |
| **Task** | `m1-023`, an item the owner picks. Candidates, from the m1-021 owner list and m1-022 findings: (a) **privacy page content** (CA-6; needs the notice text from the owner or DPO); (b) **CA-5 preparation** (content migration; needs owner-approved copy and D-CONTENT-4); (c) **small fix: Products shortcut clash** (`G,R` is also core's Redirects shortcut) |
| **Precondition** | The m1-022 PR is merged (D-GIT-20) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-023-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-4, D-CONTENT-11, D-CONTENT-12, D-CONTENT-14) · [m1-022 report](../engineering/reports/2026/11/2026-11-01-m1-022-admin-tidy.report.md) · [implementation plan](../content/implementation-plan-and-risks.md#2-prioritised-implementation-plan) |

## 1. State at the end of m1-022

- `feat/m1-022-admin-tidy` holds: Global Styles restricted to admins (core `editRole` /
  `publishRole`), admin bar menus (core `groups` option), four new content-model checks, records
  and this handoff. Commit, push and PR await the owner (D-GIT-20).
- All local suites pass, including `test:ci` (see the report). Hosted CI has not run on this branch.
- Editors now see Pages · Content · Media · Forms · Redirects; admins see Site admin (Users,
  Redirects) and the Global Styles palette.

## 2. Candidates

### 2.1 Privacy page content (CA-6)

The Global "Privacy notice page" setting, footer link and form notice exist (m1-019). The page
text itself must come from the owner or DPO; the agent must not write legal text. Also list any
third-party providers (D-CONTENT-14, video embeds) if the DPO wants them named.

### 2.2 CA-5 preparation (content migration)

Needs owner-approved copy and D-CONTENT-4. Preparation could be an inventory and a draft-entry
checklist, without publishing anything.

### 2.3 Products shortcut clash

`modules/assurer-product/index.js:16` sets `shortcut: 'G,R'`, which core also uses for the
Redirects manager (warning at start-up). Choose a free shortcut and check it in the browser.

## 3. Carry-over

- D-CONTENT-11 (publishing workflow; editors publish and edit Global Content) still open before
  staff rollout.
- From m1-021: brand values (D-CONTENT-12), SVG logo master, header logo size review, literal
  paddings, card grids switch at 640 px (requirements say 768 px), no `/favicon.ico`.

## 4. Gates

- No new dependency without approval.
- Commit, push and PR need owner approval.

## 5. Prompt for the new session

> Start m1-023. Read AGENTS.md and docs/milestones/m1-023-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
