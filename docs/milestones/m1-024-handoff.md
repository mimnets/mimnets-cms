# m1-024 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-01, by the agent at the end of m1-023 (agent-executed; not a human approval) |
| **Task** | `m1-024`, an item the owner picks. Candidates: (a) **problem on page refresh** (owner report in m1-023; analysed from the owner's GIF, not yet reproduced or fixed); (b) **privacy page content** (CA-6; needs the notice text from the owner or DPO); (c) **CA-5 preparation** (content migration; needs owner-approved copy and D-CONTENT-4) |
| **Precondition** | The m1-023 PR is merged (D-GIT-21) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-024-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-4, D-CONTENT-11, D-CONTENT-12, D-CONTENT-14) · [m1-023 report](../engineering/reports/2026/11/2026-11-01-m1-023-products-shortcut.report.md) · [implementation plan](../content/implementation-plan-and-risks.md#2-prioritised-implementation-plan) |

## 1. State at the end of m1-023

- `fix/m1-023-products-shortcut` holds: Products manager shortcut `G,R` → `G,Shift+P` (no clash
  with core's Redirects), records and this handoff. Commit, push and PR await the owner (D-GIT-21).
- All local suites pass, including `test:ci` (see the report). Hosted CI has not run on this branch.

## 2. Candidates

### 2.1 Problem on page refresh

The owner sees an issue when refreshing the site. From the owner's GIF (analysed in m1-023, see
its report, Findings outside scope): a one-frame **unstyled flash** on every refresh, and the
home-page **slideshow fading in** over 0.5 s. Likely causes: Vite dev mode injects the CSS by
script (dev only), and the slideshow's `opacity` transition also runs on the first slide at load.

1. Reproduce both in Chrome on the dev server.
2. Build and serve production (`npm run build`, `npm run serve`, own port) and check again. If the
   flash is gone, it needs no fix; record that. If it stays, find out why.
3. For the slideshow, show the first slide without the fade on load (for example, render it
   `is-active` on the server or turn the transition on only after start-up). Keep the
   reduced-motion rule (`_assurer.scss:247`).
4. Check at 1440, 768 and 375 px, logged out and as an editor.

### 2.2 Privacy page content (CA-6)

As in the [m1-023 handoff §2.1](m1-023-handoff.md#21-privacy-page-content-ca-6): the text must
come from the owner or DPO; the agent must not write legal text.

### 2.3 CA-5 preparation (content migration)

As in the [m1-023 handoff §2.2](m1-023-handoff.md#22-ca-5-preparation-content-migration).

## 3. Carry-over

- D-CONTENT-11 (publishing workflow; editors publish and edit Global Content) still open before
  staff rollout.
- From m1-021: brand values (D-CONTENT-12), SVG logo master, header logo size review, literal
  paddings, card grids switch at 640 px (requirements say 768 px), no `/favicon.ico`.

## 4. Gates

- No new dependency without approval.
- Commit, push and PR need owner approval.

## 5. Prompt for the new session

> Start m1-024. Read AGENTS.md and docs/milestones/m1-024-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
