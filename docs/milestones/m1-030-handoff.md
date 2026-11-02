# m1-030 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-02, by the agent at the end of m1-029 (agent-executed; not a human approval) |
| **Task** | `m1-030`, an item the owner picks. Candidates: (a) **D-CONTENT-16** (where CA-5 content is entered); (b) **privacy notice go-live** (CA-6; after DPO review, D-CONTENT-15); (c) **hosting decisions** D-DB-2/D-DB-3, which option A of D-CONTENT-16 needs |
| **Precondition** | The m1-029 PR is merged (D-GIT-27) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-030-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-11, D-CONTENT-12, D-CONTENT-15, D-CONTENT-16, D-DB-2, D-DB-3) · [m1-029 report](../engineering/reports/2026/11/2026-11-02-m1-029-carry-over-items.report.md) · [CA-5 checklist](../content/ca5-migration-checklist.md) |

## 1. State at the end of m1-029

- `feat/m1-029-carry-over-items`: the demo notice and the footer's demonstration line show only
  when `APOS_DEMO_SITE=1`; card grids switch to two columns at 768 px; `public/favicon.ico`.
  Records and this handoff.
- **Every developer `.env` needs `APOS_DEMO_SITE=1`**, or `npm run test:smoke` fails its
  "demo notice rendered" check. CI sets it. Real-content sites leave it unset.
- The unpublished draft page "Privacy notice" (`/privacy`, m1-027) is still in the local
  development database.

## 2. Candidates

### 2.1 D-CONTENT-16: where CA-5 content is entered

As in the [m1-029 handoff §2.1](m1-029-handoff.md#21-d-content-16-where-ca-5-content-is-entered).
The owner supplies approved copy, images and confirmations; the agent writes no business text.

### 2.2 Privacy notice go-live (CA-6)

As in the [m1-028 handoff §2.1](m1-028-handoff.md#21-privacy-notice-go-live-ca-6). Only after the
DPO's review and a recorded approval (D-CONTENT-15).

### 2.3 Hosting decisions (D-DB-2, D-DB-3)

Staging and production database and media store. Architecture gate: needs explicit owner
approval, and touches anything production-related only with approval.

## 3. Carry-over

- Per-file PDF redirects (CA-5 checklist §7) wait for D-CONTENT-16.
- From m1-026: after any Apostrophe upgrade, compare the admin bar height with the two values in
  `_assurer.scss`.
- D-CONTENT-11 (publishing workflow) still open before staff rollout.
- From m1-021: brand values (D-CONTENT-12), SVG logo master, header logo size review, literal
  paddings. The favicon is still the live site's 32 px PNG; replace it with the brand master
  when supplied.
- From m1-025: fallback font for one or two frames on the dev server; test on `127.0.0.1`, not
  `localhost` (m1-027 F4); start a second dev server only after the first has restarted.
- Stale `vcl-assurer-group.loggedIn` cookie causes one extra reload per URL (m1-024 report, F4).
- Chrome window resizing does not work while maximized; m1-029 used same-origin iframes for
  768/375 px checks.
- `gh` is not installed in the agent's environment: hosted CI is confirmed by the owner.

## 4. Gates

- No new dependency without approval.
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- No real content entered before D-CONTENT-16 is decided.
- Commit, push and PR need owner approval.

## 5. Prompt for the new session

> Start m1-030. Read AGENTS.md and docs/milestones/m1-030-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
