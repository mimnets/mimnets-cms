# m1-026 — Admin bar jump on signed-in page loads

| | |
|---|---|
| **Task** | m1-026 |
| **Date** | 2026-11-01 |
| **Scope** | The admin bar moving the page down after the first paint on every signed-in page load (candidate 2.3 of the [m1-026 handoff](../../../../milestones/m1-026-handoff.md); m1-025 report, F4) |
| **Prompt** | [2026-11-01-m1-026-admin-bar-jump.prompt.md](../../../prompts/2026/11/2026-11-01-m1-026-admin-bar-jump.prompt.md) |
| **Handoff** | [m1-026 start handoff](../../../../milestones/m1-026-handoff.md) · next: [m1-027 handoff](../../../../milestones/m1-027-handoff.md) |
| **Branch / commit** | `fix/m1-026-admin-bar-jump` from `origin/main` `729f10c` (m1-025 merged as PR #28). Commit, push and PR approved by the owner (D-GIT-24) |
| **Related** | D-GIT-23 · D-GIT-24 (new) |

## Approvals used

- Task chosen by the owner in session (see the prompt record).
- **Hard-coded heights.** The handoff required owner approval before hard-coding the bar's height.
  The owner left the choice to the agent ("you decide"). The agent chose to reserve both heights
  (56 px for the top row, 111 px with the context bar). Reason: reserving only the row would
  leave a 55 px jump on every editable page, which is most signed-in loads. The values and the
  need to re-check them after an Apostrophe upgrade are recorded in the code comment and below.
- No package was added, removed or upgraded. `package.json` and the lockfile are unchanged.

## Start state

- m1-025 was merged (PR #28, `729f10c` on `origin/main`). Hosted CI reported green by the owner;
  not checked by the agent (`gh` is not installed).
- No dev server was running. The agent started `npm run dev` on `:3000`. Claude Code stopped it after the checks because the system was low on memory.

## Findings

| # | Finding | Evidence |
|---|---|---|
| F1 | **Core has no supported way to reserve the space.** `outerLayoutBase.html` outputs an empty `<div id="apos-admin-bar">` for the `apos` scene (signed in). Vue mounts `TheAposAdminBar` into it after the scripts load; `setSpacer()` then measures the fixed bar and sets the spacer height in JavaScript. There is no option, CSS variable or hook for an initial height | `apostrophe` 4.34.0: `template/views/outerLayoutBase.html:31`, `admin-bar/ui/apos/apps/AposAdminBar.js`, `admin-bar/ui/apos/components/TheAposAdminBar.vue:73-80` |
| F2 | **The bar's height depends on the context bar.** Top row: 55 px plus a 1 px border, so 56 px. With the context bar: 111 px. The context bar shows when the doc type has the `contextBar` option (default `true`) and the user can edit the page or piece (or can localize, which needs more than one locale; this site has one) | Measured `.apos-admin-bar` heights: 111 on pages, 56 on a 404 URL; `TheAposContextBar.vue:134-141`, `admin-bar/index.js` `getBrowserData` |
| F3 | **The height does not depend on the viewport width.** The admin bar components have no media queries; the rows have a fixed height | `grep` of the admin-bar components |

## What was built

| Item | Implementation |
|---|---|
| Reserved height | `_assurer.scss`: `#apos-admin-bar:empty { height: 56px }` and, with the body class, `111px`. `:empty` stops matching as soon as Vue mounts the bar, and core's spacer takes over. Visitors are not affected: the element is only rendered when signed in |
| Body class | `views/layout.jsx`, `contextBarClass()`: passes `assurer-has-context-bar` to core's `bodyClass` block when a user is signed in, the page or piece has `_edit`, and its type has the `contextBar` option (core's own condition). Otherwise the prop is `undefined`, which the JSX bridge skips |

No automated test was added: the change is paint and layout in the browser, which the API suites
cannot see. The browser checks below cover it.

**Maintenance:** the two values (56 and 111 px) were measured with Apostrophe 4.34.0. After an
Apostrophe upgrade, sign in and compare `.apos-admin-bar` `offsetHeight` with them. A mismatch
only brings back a jump of the difference; nothing breaks.

## Test results

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run test:unit` | PASS, 92/92 |
| `npm run test:smoke` (`:3000`) | PASS, 18/18 |
| `npm run test:workflow` (`:3000`) | PASS, 15/15 |
| `npm run test:persistence` (`:3000`) | PASS, 7/7 |
| `npm run test:ci` (isolated, temporary SQLite database) | PASS ("CI test run passed") |

Not run: `npm run build`, `audit:check` (no dependency change).

### Browser checks (Claude in Chrome, agent-executed; not human approval)

On `http://127.0.0.1:3000` (dev server) as a disposable editor `m1026editor` (created with
`node app @apostrophecms/user:add m1026editor editor`), signed in through the login form. Layout
shifts were read with a buffered `PerformanceObserver` (`layout-shift`) after top-level page
loads. The window is 1440 px wide.

| # | Check | Result |
|---|---|---|
| B1 | Control, before the fix (change stashed): `/acceptance-test` and a 404 URL | Jump confirmed: 111 px (CLS 0.0795) on the page, 56 px (CLS 0.0399) on the 404 |
| B2 | After the fix: `/`, `/acceptance-test`, `/m0-test-page`, `/test`, 404 URL, 7 loads | PASS: no admin bar shift. Pages have the body class and a 111 px bar; the 404 has no class and a 56 px bar. Remaining CLS 0.0000–0.0007 (a 3 px move of the main menu text, or −7 px on the 404, unrelated to the bar) |
| B3 | Edit mode: click "Edit", reload in draft mode, click "Preview" | PASS: bar works, notice at 111 before and after, no shift on the draft reload (CLS 0.0004) |
| B4 | Logged out through the user menu | PASS: no `#apos-admin-bar`, no body class, notice at 0. `curl` of `/`, `/acceptance-test` and a 404 URL signed out: no class |
| B5 | Tablet and mobile (768, 375 px) | NOT TESTED: the window did not resize (maximized) and the sized popup was blocked. F3 says the heights do not change with width |
| B6 | Hidden-iframe measurement (first attempt) | Not used as evidence: the control in B1 showed 0 shift in the iframe before the fix, so that method cannot see this jump |
| B7 | A page the editor cannot edit, and piece show pages | NOT TESTED: editors can edit every page, and no piece type has a show page with a URL yet. On such pages the server and client conditions are the same (F2), so the 56 px value applies |
| B8 | Draft/published isolation | NOT TESTED: no content change in this task |

No screenshots kept.

## Clean-up

- Disposable editor `m1026editor` logged out in the UI and archived by the test admin through the
  REST API (`archived: true`; core prefixed the archived username). The admin API token was logged
  out. The scratch password file and script (outside the repository) were deleted.
- The Chrome tab used for the checks was closed.
- No content or setting was saved. The agent's dev server on `:3000` was stopped by Claude Code (low system memory) after the checks; no server is running.

## Findings outside scope

- None new. The m1-025 carry-over (fallback font frames on the dev server, `localhost` session
  sharing, shared `apos-build/`) is unchanged.

## Open items

- D-GIT-24: commit, push and PR approved by the owner; hosted CI to be confirmed on the PR.
- D-GIT-23: m1-025 merged as PR #28; hosted CI reported green by the owner.
- B5 (768 and 375 px) not run in a browser.
- D-CONTENT-11 and the m1-021 carry-over stay open (see the
  [m1-027 handoff](../../../../milestones/m1-027-handoff.md)).
