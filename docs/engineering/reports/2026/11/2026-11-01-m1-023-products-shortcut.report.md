# m1-023 — Products shortcut clash

| | |
|---|---|
| **Task** | m1-023 |
| **Date** | 2026-11-01 |
| **Scope** | Fix the `G,R` keyboard shortcut clash between the Products manager and core's Redirects manager (m1-022 finding) |
| **Prompt** | [2026-11-01-m1-023-products-shortcut.prompt.md](../../../prompts/2026/11/2026-11-01-m1-023-products-shortcut.prompt.md) |
| **Handoff** | [m1-023 start handoff](../../../../milestones/m1-023-handoff.md) · next: [m1-024 handoff](../../../../milestones/m1-024-handoff.md) |
| **Branch / commit** | `fix/m1-023-products-shortcut` from `origin/main` `b24ff5e` (m1-022 merged as PR #25). Commit, push and PR approved by the owner (D-GIT-21) |
| **Related** | D-GIT-20 (closed) · D-GIT-21 (new) |

## Approvals used

- Task chosen by the owner in session (see the prompt record).
- No package was added, removed or upgraded. `package.json` and the lockfile are unchanged.

## Start state

- m1-022 was merged (PR #25, `b24ff5e` on `origin/main`). Hosted CI for it was **not checked**
  by the agent (`gh` is not installed); the owner reported it green. D-GIT-20 is closed.
- A server the agent did not start was listening on `:3000`. It was left alone. This task used
  its own server on `:3004` (development database).

## What was built

| Item | Implementation |
|---|---|
| Products shortcut | `modules/assurer-product/index.js`: core `shortcut` option changed from `G,R` to `G,Shift+P`. Core uses the same `G,Shift+<letter>` form when two managers share a letter (Image Tags `G,Shift+I`, File Tags `G,Shift+F`); `G,P` is Pages. The comment now says why `G,R` is not used |

Before the change, the full admin bar shortcut map (read from the browser data of the
command-menu module, admin session) had one clash only: `G,R` for Products and Redirects. After
the change, the same check (the logic of core's `notifyConflicts`, across every modal) finds no
clash.

No automated test was added: the clash check runs in core per request and logs only a
development warning; the browser checks below cover the change.

## Test results

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run test:unit` | PASS, 92/92 |
| `npm run test:ci` (isolated, temporary SQLite database) | PASS: smoke 18/18, workflow 15/15, content model 106/106, SEO 37/37, persistence 7/7, content model after restart 7/7, legacy redirects 52/52, form operations 84/84, security 65/65, security in HTTPS-proxy mode 15/15 |
| `npm run test:smoke` (`:3004`) | PASS, 18/18 |
| `npm run test:workflow` (`:3004`) | PASS, 15/15 |
| `npm run test:persistence` (`:3004`) | PASS, 7/7 |

Not run: `npm run build` (no asset or template change) and `audit:check` (no dependency change).

### Browser checks (Claude in Chrome, agent-executed; not human approval)

Admin checks used an existing admin session on `http://localhost:3004` (looked only, nothing
saved). Editor checks used a disposable editor `m1023editor` (created with
`node app @apostrophecms/user:add m1023editor editor`) on `http://127.0.0.1:3004`, a separate
cookie host. Desktop width only: no public layout or template changed.

| # | Check | Result |
|---|---|---|
| B1 | Admin: shortcut map has no clash after the change | PASS |
| B2 | Admin: keys `G`, `Shift+P` open Manage Products; `Q` closes it | PASS |
| B3 | Admin: keys `G`, `R` open Manage Redirects | PASS |
| B4 | Editor: keys `G`, `Shift+P` open Manage Products | PASS |
| B5 | Editor: keys `G`, `R` open Manage Redirects | PASS. The first attempt, typed straight after `Q` in one sequence, opened nothing; pressed again on its own, it opened. Seen as input timing during the modal close, not a clash |
| B6 | Editor: the `?` shortcut list shows Product = `g` then `⇧` `p`, Redirect = `g` then `r` | PASS |
| B7 | Draft/published isolation | NOT TESTED: no content change in this task |

Evidence: `evidence/m1-023/editor-shortcut-list.jpg` (git-ignored).

## Clean-up

- Disposable editor `m1023editor` logged out in the UI and archived by the admin through the
  REST API (`archived: true`; core prefixed the archived username). Its scratch password file
  (outside the repository) was deleted.
- No content or setting was saved.
- The dev server on `:3004` was left running at the end of the session for the owner's review;
  stop it when done.

## Findings outside scope

- **Problem on page refresh (owner report, for later):** the owner reported an issue seen when
  refreshing the site and supplied a local screen recording. The agent played it in Chrome: every
  frame of the 9-second recording is black apart from the recorder's watermark (the same
  brightness through the whole file), so the recorder did not capture the browser window.
  The owner then supplied a GIF (101 frames, about 6.7 s, logged out, home page on the `:3000` dev
  server, three refreshes). The agent decoded it frame by frame in Chrome and saw:
  1. **Unstyled flash:** for about one frame per refresh the page shows without CSS (serif
     font, bulleted nav, unstyled hero). On the dev server the site CSS comes from Vite's client
     script (`/__vite/src/src.js`), which injects the styles after the first paint; only the Global
     Styles stylesheet is a `<link>`. This is how Vite dev mode works; a production build
     (`npm run build`, `npm run serve`) serves the CSS as stylesheet links. **Not yet checked**
     against a production build.
  2. **Second-section fade:** after each refresh the second home-page block changes from green
     to blue over about 0.5 s. That block is the slideshow; slides start at `opacity: 0` and fade
     in with `transition: opacity 0.5s` (`modules/asset/ui/src/scss/_assurer.scss:178-185`), so
     the first slide fades in on load. Not confirmed in a live browser.
  3. In some frames the demo banner is out of view; this looks like the browser restoring the
     scroll position on reload. Not confirmed.
  The owner asked for the fix later; nothing was changed. The GIF was not copied into the
  repository. Carried to the [m1-024 handoff](../../../../milestones/m1-024-handoff.md).

## Open items

- D-GIT-20 closed: the owner reported the m1-022 hosted CI green (not checked by the agent).
- D-CONTENT-11 (publishing workflow) and the m1-021 carry-over stay open (see the
  [m1-024 handoff](../../../../milestones/m1-024-handoff.md)).
