# m1-025 — One-frame shift on refresh

| | |
|---|---|
| **Task** | m1-025 |
| **Date** | 2026-11-01 |
| **Scope** | The one-frame shift on some refreshes left open by m1-024 (candidate 2.1 of the [m1-025 handoff](../../../../milestones/m1-025-handoff.md)), and the breadcrumb misalignment the owner reported during the task |
| **Prompt** | [2026-11-01-m1-025-refresh-shift.prompt.md](../../../prompts/2026/11/2026-11-01-m1-025-refresh-shift.prompt.md) |
| **Handoff** | [m1-025 start handoff](../../../../milestones/m1-025-handoff.md) · next: [m1-026 handoff](../../../../milestones/m1-026-handoff.md) |
| **Branch / commit** | `fix/m1-025-refresh-shift` from `origin/main` `972c740` (m1-024 merged as PR #27). Commit, push and PR approved by the owner (D-GIT-23) |
| **Related** | D-GIT-22 · D-GIT-23 (new) |

## Approvals used

- Task chosen by the owner in session (see the prompt record). The breadcrumb fix was asked for
  by the owner during the task.
- No package was added, removed or upgraded. `package.json` and the lockfile are unchanged. The
  GIF was decoded with a throwaway Node script in the agent's scratch directory (Node built-ins
  only, not in the repository).

## Start state

- m1-024 was merged (PR #27, `972c740` on `origin/main`). Hosted CI for it was reported green by
  the owner; the agent could not check it (`gh` is not installed).
- The owner's development server was listening on `:3000`. It was not restarted by the agent;
  nodemon restarted it by itself after each template change.
- The owner answered: the shift also shows in Chrome; it shows both signed in and signed out;
  whether the page had been scrolled before the refresh is not known.

## Findings

| # | Finding | Evidence |
|---|---|---|
| F1 | **The shifted frame is a scrolled page, not a missing banner.** In the owner's GIF (Edge, `localhost:3000`, 181 frames, signed out) frames 52, 90 and 91 show the page about 53 GIF px (about 35 CSS px, the height of the demo notice) higher. The scrollbar thumb has the same length but sits 14 px lower, so the document is scrolled by about the notice's height. The same frames still use the fallback font | Per-frame pixel measurement of the hero edge and the scrollbar thumb (frames 51–53, 89–92) |
| F2 | **Cause: Chrome's scroll restoration during the unstyled phase (development only).** On the Vite dev server the page is laid out (hidden by the m1-024 guard) before the site CSS arrives. Unstyled, the default 8 px body margin and the inline "Skip to content" link push the demo notice down to 35 px. On reload, Chromium sometimes restores the scroll position by anchoring to the top element (the notice) at that moment, so `scrollY` becomes about 35. When the site CSS arrives the notice moves back to 0, but the page is still scrolled, so it shows with the notice out of view. At load end Chromium restores the saved offset (0) and the page jumps back | Reproduced in Chrome, signed out, on the agent's dev server: popup reloaded from a same-origin opener that sampled `scrollY` and the notice position every animation frame. Reload 1 of 4: `scrollY` 35.3 while hidden, visible at 661 ms with the notice at −35, back to 0 at `complete` (735 ms). All four reloads: notice at 35 px while unstyled |
| F3 | **Production is not affected.** The production CSS link blocks rendering, so the page is never laid out unstyled | Production build on `:3100`, 16 reloads, sampled only after the site stylesheet had loaded: `scrollY` 0 and notice at 0 in every frame. (A first probe that read layout before the stylesheet loaded did show one shift; that probe forced an unstyled layout that normal loading never does, so it is not counted) |
| F4 | **Signed in: the admin bar moves the page down after the first paint (core behaviour).** The page is painted with the notice at the top, then the admin bar mounts and its spacer moves everything down 111 px. `scrollY` stays 0 | Dev, signed in as a disposable editor: a 111 px layout shift (score 0.078) about 80 ms after first paint; 8 probe reloads after the fix: no scroll change, notice at 0 and then 111 |
| F5 | **Breadcrumbs: the links sit lower than the current page.** The list is a flex row aligned to the top; the links are `inline-block` with vertical padding (a larger tap target) and the current page is a plain `span` | Owner screenshot; the cause read from `_corporate.scss` |

## What was built

| Item | Implementation |
|---|---|
| Development style guard | `views/layout.jsx`, `DevStyleGuard`: the inline style (development only, as in m1-024) now also sets `margin: 0` on `body` and `position: absolute` on `.assurer-skip-link`, both at zero specificity, as the site CSS does. The unstyled layout then has the demo notice at 0, the same place as the styled layout, so a scroll restoration during loading puts the page at 0 |
| Breadcrumb alignment | `_corporate.scss`: `.assurer-breadcrumbs__list` has `align-items: baseline`, so the links and the current page share one text baseline. The tap target padding is unchanged |

No automated test was added: both changes are paint and layout in the browser, which the API
suites cannot see. The browser checks below cover them.

## Test results

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run test:unit` | PASS, 92/92 |
| `npm run test:smoke` (`:3000`) | PASS, 18/18 |
| `npm run test:workflow` (`:3000`) | PASS, 15/15 |
| `npm run test:persistence` (`:3000`) | PASS, 7/7 |
| `npm run test:ci` (isolated, temporary SQLite database) | First run FAIL at the port check only: port 3100 was held by the agent's production server. Rerun with `CI_TEST_PORT=3200`: PASS, all 21 steps |
| `npm run build` | PASS (the three existing Roboto `url()` warnings, as before) |

Not run: `audit:check` (no dependency change).

### Browser checks (Claude in Chrome, agent-executed; not human approval)

Signed-out checks on `http://127.0.0.1:3000` (the owner's dev server) unless noted. Before the
fix the agent's own dev server `http://127.0.0.1:3005` was used (`APOS_BASE_URL` set to match).
Editor checks used a disposable editor `m1025editor` (created with `node app
@apostrophecms/user:add m1025editor editor`). Reload timing was measured from a same-origin opener
sampling a popup window every animation frame; layouts at 768 and 375 px used same-origin
iframes (the window is maximized).

| # | Check | Result |
|---|---|---|
| B1 | Owner GIF: locate and measure the shifted frames | PASS: F1 |
| B2 | Reproduce in Chrome before the fix, signed out, with real reloads | PASS (reproduced): F2 |
| B3 | Dev, signed out, after the first change (skip link only), 12 reloads | FAIL: 1 reload restored to `scrollY` 8 (the body margin); led to the second change |
| B4 | Dev, signed out, after the final change, 16 reloads | PASS: notice at 0 and `scrollY` 0 in every sampled frame, hidden and visible |
| B5 | Production build, signed out, 16 reloads, sampled after the stylesheet loaded | PASS: no shift (F3). Guard absent from production HTML (0 occurrences) |
| B6 | Dev, signed in as the editor, 8 reloads after the fix | PASS for the scroll (always 0). The admin bar jump (F4) remains, as before; not in scope |
| B7 | Breadcrumbs on `/acceptance-test`, signed out, real page | PASS: "Home" and "Acceptance Test" have the same text top and bottom (133.5 / 152.2 px) |
| B8 | Breadcrumbs and overflow at 1440, 768, 375 px on every main menu page, `/` and a 404 URL | PASS: aligned on every row, no horizontal overflow, notice at 0 |
| B9 | Breadcrumbs as the editor on `/acceptance-test` (admin bar shown) | PASS: aligned (263.2 px each), no overflow |
| B10 | Draft/published isolation | NOT TESTED: no content change in this task |
| B11 | Breadcrumbs wrapping onto two lines | NOT TESTED: no page has a title long enough; baseline alignment applies per flex line |

No screenshots kept: the GIF frames show the owner's browser bar and bookmarks.

## Clean-up

- Disposable editor `m1025editor` logged out in the UI and archived by the test admin through the
  REST API (`archived: true`; core prefixed the archived username). The admin API token was logged
  out. The scratch password file (outside the repository) was deleted.
- The probe popup windows were closed. The agent's servers on `:3005` and `:3100` were stopped.
- The GIF copy, its decoded frames and crops (scratch directory) were deleted.
- `npm run build` left a production build in the git-ignored `public/apos-frontend/releases/`.
- No content or setting was saved. The owner's `:3000` server is running.

## Findings outside scope

- **Admin bar jump when signed in (F4, open).** Core mounts the admin bar after the first paint,
  so every signed-in page load moves the page down by the bar's height (111 px with the context
  bar). This is probably what the owner sees when signed in. Not changed: core behaviour, and
  reserving the space in project CSS would have to guess the bar's height. Carried to the
  [m1-026 handoff](../../../../milestones/m1-026-handoff.md).
- **Fallback font for one or two frames (development).** Roboto uses `font-display: swap`. On the
  dev server the fonts start loading only when the CSS arrives, so the first visible frames can
  use the fallback font. Not changed. Preloading the three font files would reduce it if wanted.
- **`localhost` shares the owner's admin session.** Cookies ignore ports, so any `localhost:<port>`
  page opens with the owner's admin session. During the checks the agent opened
  `localhost:3005/` and, through a main-menu link (absolute `localhost:3000` URL, the default base
  URL), `localhost:3000/acceptance-test`. It only read positions. Nothing was clicked or saved
  there. Later tests used `127.0.0.1` only.
- **Parallel dev servers share `apos-build/`.** Starting the agent's `:3005` server while nodemon
  restarted `:3000` failed once with `ENOENT … chmod` in `apos-build/`. A second start worked.
  Start a second dev server only after the first has finished restarting.

## Open items

- D-GIT-23: commit, push and PR approved by the owner; hosted CI to be confirmed on the PR.
- D-GIT-22: m1-024 merged as PR #27; hosted CI reported green by the owner.
- D-CONTENT-11 and the m1-021 carry-over stay open (see the
  [m1-026 handoff](../../../../milestones/m1-026-handoff.md)).
