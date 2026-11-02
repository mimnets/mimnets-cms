# m1-029 — Carry-over code items

| | |
|---|---|
| **Task** | m1-029 |
| **Date** | 2026-11-02 |
| **Scope** | The code items in [CA-5 checklist §7](../../../../content/ca5-migration-checklist.md#7-work-that-is-not-data-entry) (candidate 2.3 of the [m1-029 handoff](../../../../milestones/m1-029-handoff.md)): demo notice and demonstration footer line (B6), card grid breakpoint, `/favicon.ico`. Per-file PDF redirects are out of scope: they need the target database (D-CONTENT-16) |
| **Prompt** | [2026-11-02-m1-029-carry-over-items.prompt.md](../../../prompts/2026/11/2026-11-02-m1-029-carry-over-items.prompt.md) |
| **Handoff** | [m1-029 start handoff](../../../../milestones/m1-029-handoff.md) · next: [m1-030 handoff](../../../../milestones/m1-030-handoff.md) |
| **Branch / commit** | `feat/m1-029-carry-over-items` from `origin/main` `3bac077` (m1-028 merged as PR #31). Commit and push approved by the owner (D-GIT-27); PR opened by the owner |
| **Related** | D-GIT-26 · D-GIT-27 (new) · CA-5 checklist B6 |

## Approvals used

- Task chosen by the owner in session (see the prompt record).
- **Demo switch:** the owner chose an environment variable, off by default (prompt record, item 2).
- No package was added, removed or upgraded. `package.json` and the lockfile are unchanged. The
  favicon was built with a short Node script (built-ins only) kept outside the repository.

## Start state

- m1-028 was merged (PR #31, `3bac077` on `origin/main`). Hosted CI on PR #31 was not confirmed
  by the owner in this session, and the agent could not check it (`gh` is not installed).
- A dev server was already running on `:3000` (not started by the agent). It restarted through
  nodemon after the edits; the agent touched `app.js` once to make it re-read `.env`.

## What was built

| Item | Implementation |
|---|---|
| Demo switch | `lib/demo-site.js`, `readDemoSite(env)`: `APOS_DEMO_SITE=1` is on; unset, empty or `0` is off; any other value throws. `app.js` calls it at startup so a bad value stops the app. `views/layout.jsx` renders `DemoNotice` only when on, and omits the footer's legal line when Global Content has no copyright name and the switch is off. With a copyright name the legal line is unchanged |
| Configuration | `.env.example` documents `APOS_DEMO_SITE`. `scripts/run-ci-tests.mjs` sets it to `1`, because `test:smoke` checks for the notice. The agent added `APOS_DEMO_SITE=1` to the local, git-ignored `.env`. The new-site runbook says to leave it unset on real-content sites |
| Card grids | `_assurer.scss` (product cards area) and `_corporate.scss` (`.assurer-grid`, division and category pages): the two-column query moves from `min-width: 640px` to `768px`, as in the [editorial and design requirements](../../../../content/editorial-and-design-requirements.md). The `sizes` hint in the five card templates moves with it |
| Favicon | `public/favicon.ico`: the existing 32 × 32 `favicon-32.png` wrapped in an ICO container (PNG-in-ICO, 1,800 bytes). Served by Apostrophe's static `public/` route. The `<link rel="icon">` tags are unchanged; the file answers browsers and tools that ask for `/favicon.ico` directly |
| Tests | `scripts/demo-site.test.mjs`: unit tests for the switch's values |

**Effect on sites:** a new staging or production site shows no demo notice and no demonstration
footer line unless `APOS_DEMO_SITE=1` is set. A developer whose `.env` lacks the line sees neither
locally, and `npm run test:smoke` then fails its "demo notice rendered" check.

## Test results

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run test:unit` | PASS, 94/94 |
| `npm run test:smoke` (`BASE_URL=http://127.0.0.1:3000`) | PASS, 18/18 |
| `npm run test:workflow` (`:3000`) | PASS, 15/15 |
| `npm run test:persistence` (`:3000`) | PASS, 7/7 |
| `npm run test:ci` (isolated, temporary SQLite database) | PASS ("CI test run passed", 21 steps) |

Also by `curl` on `:3000`: with the switch off (the server before it re-read `.env`), no notice
and no footer legal line (local Global Content has no copyright name); with it on, both present.
`/favicon.ico` returns 200, `image/x-icon`, 1,800 bytes.

Not run: `npm run build`, `audit:check` (no dependency change).

### Browser checks (Claude in Chrome, agent-executed; not human approval)

On `http://127.0.0.1:3000`, logged out, in a new tab, closed afterwards.

| # | Check | Result |
|---|---|---|
| B1 | Home page at 1440 px with `APOS_DEMO_SITE=1` | PASS: notice above the header (screenshot viewed, not kept); product cards in 3 columns; no horizontal overflow |
| B2 | Breakpoint: home page in hidden same-origin iframes 768, 767 and 640 px wide; product card area measured, and a probe `ul.assurer-grid.assurer-grid--3` added to the frame's DOM and removed after measuring | PASS: 2 columns at 768 px, 1 column at 767 and 640 px (both grids). Before the change 640 px gave 2 columns |
| B3 | Tablet and mobile layout (frames 783 and 390 px, viewport 768 and 375 px) | PASS: 2 and 1 columns, no horizontal overflow, `sizes` shows `(min-width: 768px) 50vw` |
| B4 | `/favicon.ico` fetched from the page | PASS: 200, `image/x-icon` |
| B5 | Real window resize to 768 and 375 px | NOT TESTED: the window did not resize (maximized), as in m1-026. B2 and B3 used iframes instead |
| B6 | Division and category pages with real records | NOT TESTED in the browser: the local database has no corporate records. The `.assurer-grid` CSS was checked with the probe (B2); `test:ci` seeds those records and renders the pages |
| B7 | Notice off in the browser | NOT TESTED in the browser; checked by `curl` (above) |
| B8 | Editor capabilities as a non-administrator; draft/published isolation | NOT TESTED: no editor-facing or content change in this task |

## Clean-up

- No content, account or setting was created or changed. The browser tab was closed.
- The local `.env` keeps `APOS_DEMO_SITE=1` (needed for `test:smoke`). The dev server on `:3000`
  was left running as found.

## Findings outside scope

- None new.

## Open items

- D-GIT-27: commit and push approved; PR to be opened by the owner, hosted CI to be confirmed on it.
- D-GIT-26: hosted CI on PR #31 not confirmed. The owner asked the agent to check it; the agent
  could not (private repository, unauthenticated API 404, no `gh`).
- Per-file PDF redirects (checklist §7) wait for D-CONTENT-16.
- Other developers need `APOS_DEMO_SITE=1` in their `.env` for `test:smoke` (documented in
  `.env.example`).
