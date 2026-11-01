# m1-025 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-01, by the agent at the end of m1-024 (agent-executed; not a human approval) |
| **Task** | `m1-025`, an item the owner picks. Candidates: (a) **one-frame shift on refresh** (left over from m1-024; not reproduced in Chrome); (b) **privacy page content** (CA-6; needs the notice text from the owner or DPO); (c) **CA-5 preparation** (content migration; needs owner-approved copy and D-CONTENT-4) |
| **Precondition** | The m1-024 PR is merged (D-GIT-22) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-025-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-4, D-CONTENT-11, D-CONTENT-12, D-CONTENT-14) · [m1-024 report](../engineering/reports/2026/11/2026-11-01-m1-024-refresh-flash.report.md) · [implementation plan](../content/implementation-plan-and-risks.md#2-prioritised-implementation-plan) |

## 1. State at the end of m1-024

- `fix/m1-024-refresh-flash` holds: a development-only style guard in `views/layout.jsx` (no
  unstyled flash on the Vite dev server), the slideshow fade enabled only after the player starts,
  records and this handoff. Commit, push and PR approved by the owner (D-GIT-22).
- All local suites pass, including `test:ci` (see the report). Hosted CI has not run on this branch.

## 2. Candidates

### 2.1 One-frame shift on refresh

From the owner's second GIF in m1-024 (Edge, `localhost:3000`): on some refreshes one frame
(about 70 ms) shows the page styled but about 35 CSS px higher (demo banner out of view). It was
already present before m1-024. Not reproduced in Chrome with iframe sampling.

1. Ask the owner whether it also shows in Chrome, and whether the page had been scrolled before
   the refresh.
2. Reproduce with top-level reloads (not iframes), for example with a GIF recording of the
   Chrome tab, on dev and on a production build (`npm run build`, `npm run serve`, own port).
3. If it shows only in Edge or only on dev, record it and stop. Do not use another browser
   without owner approval (AGENTS.md, Browser acceptance testing 12).

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
- Stale `vcl-assurer-group.loggedIn` cookie causes one extra reload per URL (core behaviour, see
  the m1-024 report, F4). Clear by logging in and out on that host.

## 4. Gates

- No new dependency without approval.
- Commit, push and PR need owner approval.

## 5. Prompt for the new session

> Start m1-025. Read AGENTS.md and docs/milestones/m1-025-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
