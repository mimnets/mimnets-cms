# m1-026 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-01, by the agent at the end of m1-025 (agent-executed; not a human approval) |
| **Task** | `m1-026`, an item the owner picks. Candidates: (a) **privacy page content** (CA-6; needs the notice text from the owner or DPO); (b) **CA-5 preparation** (content migration; needs owner-approved copy and D-CONTENT-4); (c) **admin bar jump on signed-in page loads** (left over from m1-025, core behaviour) |
| **Precondition** | The m1-025 PR is merged (D-GIT-23) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-026-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-4, D-CONTENT-11, D-CONTENT-12, D-CONTENT-14) · [m1-025 report](../engineering/reports/2026/11/2026-11-01-m1-025-refresh-shift.report.md) · [implementation plan](../content/implementation-plan-and-risks.md#2-prioritised-implementation-plan) |

## 1. State at the end of m1-025

- `fix/m1-025-refresh-shift` holds: the development style guard in `views/layout.jsx` now also
  sets the body margin and the skip link as the site CSS does (no one-frame shift on dev refresh),
  breadcrumbs aligned on one baseline (`_corporate.scss`), records and this handoff. Commit, push
  and PR approved by the owner (D-GIT-23).
- All local suites pass, including `test:ci` (see the report). Hosted CI has not run on this branch.

## 2. Candidates

### 2.1 Privacy page content (CA-6)

As in the [m1-023 handoff §2.1](m1-023-handoff.md#21-privacy-page-content-ca-6): the text must
come from the owner or DPO; the agent must not write legal text.

### 2.2 CA-5 preparation (content migration)

As in the [m1-023 handoff §2.2](m1-023-handoff.md#22-ca-5-preparation-content-migration).

### 2.3 Admin bar jump on signed-in page loads

Core mounts the admin bar after the first paint, so each signed-in load moves the page down by
the bar's height (111 px with the context bar; see the m1-025 report, F4). Visitors are not
affected.

1. Ask the owner whether it is worth changing; it affects editors only.
2. Read `apostrophe/modules/@apostrophecms/admin-bar` (`TheAposAdminBar.vue`, spacer) for a
   supported way to reserve the space before the bar mounts. Do not hard-code a height without
   owner approval, and do not edit `node_modules`.

## 3. Carry-over

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

> Start m1-026. Read AGENTS.md and docs/milestones/m1-026-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
