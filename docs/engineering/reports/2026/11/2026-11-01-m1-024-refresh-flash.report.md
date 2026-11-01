# m1-024 — Problem on page refresh

| | |
|---|---|
| **Task** | m1-024 |
| **Date** | 2026-11-01 |
| **Scope** | The unstyled flash and the slideshow fade seen on every refresh of the development site (owner report, analysed in m1-023) |
| **Prompt** | [2026-11-01-m1-024-refresh-flash.prompt.md](../../../prompts/2026/11/2026-11-01-m1-024-refresh-flash.prompt.md) |
| **Handoff** | [m1-024 start handoff](../../../../milestones/m1-024-handoff.md) · next: [m1-025 handoff](../../../../milestones/m1-025-handoff.md) |
| **Branch / commit** | `fix/m1-024-refresh-flash` from `origin/main` `1cf4c49` (m1-023 merged as PR #26). Commit, push and PR approved by the owner (D-GIT-22) |
| **Related** | D-GIT-21 · D-GIT-22 (new) |

## Approvals used

- Task chosen by the owner in session (see the prompt record).
- No package was added, removed or upgraded. `package.json` and the lockfile are unchanged.

## Start state

- m1-023 was merged (PR #26, `1cf4c49` on `origin/main`). Hosted CI for it was **not checked**
  by the agent (`gh` is not installed).
- A development server the agent did not start was listening on `:3000` (the owner's), and the
  m1-023 server was still on `:3004`. Both were left running and not restarted. The `:3000`
  server picked up the template and style changes by itself (nodemon and Vite HMR).

## Findings

Measured in Chrome (agent-executed) on the home page, logged out.

| # | Finding | Evidence |
|---|---|---|
| F1 | **Unstyled flash, development only.** On `:3000` the site CSS is injected by Vite's client script after the first paint. The page painted unstyled for about 110 ms (about 7 frames) on every load | First paint 188 ms after navigation start; site CSS applied at about 300 ms |
| F2 | **No flash in a production build.** `npm run build` + `npm run serve` (own port) serves `public-bundle.css` as a render-blocking `<link>` in `<head>` | `renderBlockingStatus: blocking`; CSS loaded at 641 ms, first paint at 688 ms |
| F3 | **Slideshow fade was a consequence of F1.** The first slide is already rendered `is-active` on the server. Before the CSS arrived, the inactive slides were visible (opacity 1); when the CSS arrived they faded to 0 over 0.5 s, which showed as the second block "changing colour". In production the inactive slides start at opacity 0 with no transition | Per-frame computed opacity: dev `1/1/1 → 1/0.98/0.98 → … → 1/0/0`; production `1/0/0` from the first styled frame |
| F4 | **Extra reload from a stale cookie (core behaviour).** Core sets the `vcl-assurer-group.loggedIn` cookie to `false` only on an explicit logout. If a session ends another way (expiry, server data reset, a session on another port of the same host, since cookies ignore ports), the cookie stays `true` while the visitor is logged out. Core's admin-bar script (`apostrophe/modules/@apostrophecms/admin-bar/ui/src/index.js`) then reloads the page once per URL per tab session ("Received logged-out content from cache while logged-in, refreshing the page"). This doubled the flash and also happens when not signed in | The agent's Chrome had the stale cookie on `127.0.0.1`; one extra document load per new URL. Not changed: core behaviour. Cleared on `127.0.0.1` by logging the test editor in and out |

## What was built

| Item | Implementation |
|---|---|
| Development style guard | `views/layout.jsx`: `DevStyleGuard` adds an inline `<style>` to `extraHead` **only when** `apos.asset.hasDevServer()` is true. It hides `body` (`:where(body)`, zero specificity) until the site CSS arrives, with a 3 s CSS-animation fallback that reveals the page if the CSS never loads. Production never renders it (checked: 0 occurrences on a production build, 1 on dev) |
| Reveal rule | `_assurer.scss`: `body { visibility: visible; }`. Vite appends its style tags after the guard in `<head>`, so the site rule wins as soon as it loads |
| Slideshow fade on interaction only | `_assurer.scss`: the slide `transition` now applies only under `.assurer-slideshow.is-ready`; the reduced-motion rule targets the same selector (`transition: none` kept). `assurer-slideshow-widget/ui/src/index.js`: the player adds `is-ready` one animation frame after showing the first slide. Without JavaScript nothing fades (as before, every slide is server-rendered) |

No automated test was added: the change is paint timing in the browser, which the API suites
cannot see. The browser checks below cover it.

## Test results

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run test:unit` | PASS, 92/92 |
| `npm run test:ci` (isolated, temporary SQLite database) | PASS, all 21 steps (smoke, workflow, content model, SEO, persistence, legacy redirects, form operations, security, security in HTTPS-proxy mode) |
| `npm run test:smoke` (`:3000`) | PASS, 18/18 |
| `npm run test:workflow` (`:3000`) | PASS, 15/15 |
| `npm run test:persistence` (`:3000`) | PASS, 7/7 |
| `npm run build` | PASS (three existing warnings: Roboto `url()` paths resolved at runtime, as before) |

Not run: `audit:check` (no dependency change).

### Browser checks (Claude in Chrome, agent-executed; not human approval)

Logged-out checks on `http://127.0.0.1:3000` (the owner's dev server). Production checks on the
agent's own production servers (`:3100` before the change, `:3101` after). Editor checks used a
disposable editor `m1024editor` (created with `node app @apostrophecms/user:add m1024editor
editor`) on the agent's own dev server `http://127.0.0.1:3005` (`APOS_BASE_URL` set to match).
`:3000` could not be used for the editor because logging in redirects to `localhost:3000`, a
different cookie host with an existing admin session; `:3004` was the m1-023 server. Layouts at
768 and 375 px used same-origin iframes of those widths (the window is maximized and could not be
resized).

| # | Check | Result |
|---|---|---|
| B1 | Reproduce the flash and the fade on dev before the change | PASS (reproduced): see F1, F3 |
| B2 | Production build before the change: flash or fade? | PASS: neither (F2, F3) |
| B3 | Owner GIF after the change (Edge, `localhost:3000`, about 12 s, several refreshes): unstyled frames? | PASS: none. The earlier GIF (m1-023) has them, for example frame 16. See Findings outside scope for the remaining one-frame shift |
| B4 | Dev after the change, logged out: site CSS applied in every sampled frame; slides go straight to `1/0/0`; `is-ready` added | PASS |
| B5 | Slideshow controls still fade: real clicks on Next and a dot | PASS: `transitionrun` for opacity and visibility on the outgoing and incoming slides; active slide changed |
| B6 | Layouts at 1440, 768, 375 px for `/`, `/test` and a 404 URL, logged out | PASS: no horizontal overflow; body visible; guard present on dev; Menu button below desktop width |
| B7 | Production build after the change: guard absent; `body` visibility rule and `.is-ready` transition (and its reduced-motion override) present in `public-bundle.css` | PASS |
| B8 | Editor at 1440, 768, 375 px (`/`) and `/test`: admin bar shown, body visible, slideshow ready, no overflow | PASS |
| B9 | Editor: switch to edit mode; slideshow re-rendered and still ready, first slide shown | PASS (nothing saved; Update not clicked) |
| B10 | Draft/published isolation | NOT TESTED: no content change in this task |
| B11 | Reduced motion | NOT TESTED in the browser (no emulation available in this tool); the compiled rule was checked in B7 |

No screenshots kept: the GIF frames showed the owner's browser chrome (bookmarks and profile).

## Clean-up

- Disposable editor `m1024editor` logged out in the UI and archived by the test admin through
  the REST API (`archived: true`; core prefixed the archived username). Its scratch password
  file (outside the repository) was deleted. The admin API token was logged out.
- The agent's servers on `:3100`, `:3101` and `:3005`, and a temporary local file server used to
  decode the GIFs, were stopped. The GIF copies (scratch directory) were deleted.
- `npm run build` left a production build in the git-ignored `public/apos-frontend/releases/`.
- No content or setting was saved. The owner's `:3000` server and the m1-023 `:3004` server were
  left running.

## Findings outside scope

- **One-frame shift on some refreshes (open).** In the owner's second GIF (Edge, after the
  change) one frame (about 70 ms) on two of the refreshes shows the page fully styled but about
  35 CSS px higher, with the yellow demo banner out of view. The next frame is normal. The same
  frame shape is in the m1-023 GIF (frame 54), so it existed before this task. The agent could
  not reproduce it in Chrome: `scrollY` stayed 0 on every sampled frame across repeated reloads,
  logged in and out (iframe sampling, which does not reproduce top-level paint holding exactly).
  No project script scrolls or focuses on load. Not fixed. Carried to the
  [m1-025 handoff](../../../../milestones/m1-025-handoff.md).
- **Stale `loggedIn` cookie (F4).** Core behaviour, not changed. To clear it on a host: log in
  and log out once, or delete the `vcl-assurer-group.loggedIn` cookie for that host.
- **Login redirect to `localhost`.** The default base URL is `http://localhost:<PORT>`, so
  logging in on `127.0.0.1:3000` lands on `localhost:3000` (a separate cookie host). Set
  `APOS_BASE_URL` when a test needs `127.0.0.1`.

## Open items

- D-GIT-22: commit, push and PR approved by the owner; hosted CI to be confirmed on the PR.
- D-GIT-21: m1-023 merged as PR #26; hosted CI not checked by the agent.
- D-CONTENT-11 and the m1-021 carry-over stay open (see the
  [m1-025 handoff](../../../../milestones/m1-025-handoff.md)).
