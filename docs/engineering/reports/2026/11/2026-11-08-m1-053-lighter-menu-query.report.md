# m1-053 — Lighter menu query

| | |
|---|---|
| **Task** | m1-053 |
| **Date** | 2026-11-08 |
| **Scope** | Candidate 2 of the handoff: the main menu loads only the fields it needs |
| **Prompt** | [2026-11-08-m1-053-lighter-menu-query.prompt.md](../../../prompts/2026/11/2026-11-08-m1-053-lighter-menu-query.prompt.md) |
| **Handoff** | [m1-053 start handoff](../../../../milestones/m1-053-handoff.md) · next: [m1-054 handoff](../../../../milestones/m1-054-handoff.md) |
| **Branch / commit** | `perf/m1-053-lighter-menu-query` from `origin/main` `363de89`. Commit and push approved by the owner (D-GIT-51) |
| **Related** | m1-048 and m1-050 menu findings · [m1-051 results](../../../../milestones/m1-051-mongodb-load-test-results.md) option C · D-GIT-51 (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Task choice: "Lighter menu query". Precondition: PR #55 merged (`363de89`); the five hosted CI
  checks are `success` on `363de89`, read through the public GitHub API.
- No package, tool, image or Docker use. No dependency change. Measurements on a disposable copy only.

## The m1-052 `secrets` failure

PR #55's `secrets` job (run #89) failed in its install step with `curl: (22) The requested URL
returned error: 504`. GitHub's release download answered 504 for
`gitleaks_8.30.1_linux_x64.tar.gz`; the agent got 504 four times from this PC as well, while the
release page answered 200. The workflow, the pin and the checksum were not the cause. The owner
re-ran the job; `secrets` is `success` on `363de89`.

The same failure hit the m1-053 PR. `github.com/…/releases/download/` answered 504 for every release
tried (another project's too) while githubstatus.com said "All Systems Operational"; the API's
download of the same file worked and matched the pinned SHA-256. Owner's choice: "Fallback, commit +
push". `ci.yml` now retries the release URL 3 times, then downloads the same file through
`api.github.com/repos/gitleaks/gitleaks/releases/assets/<id>` (new env `GITLEAKS_ASSET_ID`,
`378332058`). The checksum check is unchanged and verifies whichever download succeeded. No token,
secret, tool or dependency added. Tested locally: the workflow file parses; the step run in bash
failed on the release URL 4 times, took the fallback, printed `gitleaks.tar.gz: OK` and unpacked the
binary.

## Change

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | `secrets` job: retry plus the API fallback for the gitleaks download (above) |
| `modules/@apostrophecms/page/index.js` | The `ancestors` builder's `children` query (the two-level menu) gets a projection: `title`, `path`, `aposDocId`, `_url`. Core adds the fields `_url` needs, plus `type` and `metaType`. Comment explains that a template needing more of a menu item must add the field there |

Why there: the menu reads `home._children`, which core loads with the `ancestors` builders, both on
inner pages and, through the same builders, on the home page (`apostrophe/modules/@apostrophecms/page/index.js`,
`req.data.home`). Core passes every key except `depth` on to the children query as a query builder
(`applySubqueryOptions` in `any-page-type/index.js`), and `getServePageBuilders` applies the
builders without laundering, so `project` reaches the query. Apostrophe 4.34.0. The ancestors
themselves (`home`, breadcrumbs) and the page's own `children: true` are unchanged.

## Findings

1. **The projection is applied.** With `title` left out of the projection on a disposable copy,
   all 40 menu links rendered with empty text; with the committed projection all 40 have text and
   URLs.
2. **Rendered output is identical.** On the disposable copy, the logged-out home, a level-1 and a
   level-2 page were compared before and after the change: the only differences are per-request
   random values (tab id, widget wrapper ids, form field ids, the form-timing token).
3. **Less data, no measurable time change on local SQLite.** At the m1-050 size (3x today: about
   100 pages, 150 pieces, 400 images, 10 versions each), the menu's 40 documents are 21.5 KB as full
   documents and 10.4 KB with the projection, on every page view. Sequential HTTP timings (200
   requests each, logged out, no load) stayed within noise:

   | Run | Home p50 / p90 | Inner p50 / p90 |
   |---|---|---|
   | after-1 | 211 / 248 ms | 208 / 241 ms |
   | before-1 | 235 / 382 ms | 244 / 353 ms |
   | after-2 | 225 / 338 ms | 241 / 366 ms |
   | before-2 | 233 / 283 ms | 224 / 258 ms |

   The two pairs point in opposite directions. Local SQLite's per-query cost (m1-050) hides the
   difference. The load-test pages have little content, so a real site with full page areas saves
   more per document. **MongoDB was not measured**: that needs the pinned images downloaded again
   (Docker on the owner's PC is empty), which this task did not ask for.
4. **Limit to know:** any template that later reads another field of a menu item (for example an
   SEO field or an image) gets `undefined` until it is added to the projection. The comment at the
   setting says so.

## Tests executed and actual results

| Check | Where | Result |
|---|---|---|
| `npm run lint` | host | **PASS**, exit 0 |
| `npm run test:unit` | host | **PASS**, 101/101 |
| `npm run test:ci` | isolated temporary SQLite, port 3100 | **PASS**, every step ("CI test run passed") |
| `npm run test:smoke` | local server (SQLite, `.env`) | **PASS**, 18/18 |
| `npm run test:workflow` | local server | **PASS**, 15/15 |
| `npm run test:persistence` | local server | **PASS**, 7/7 |

## Browser checks (agent-executed, Claude in Chrome)

Local development site (`.env` database), `localhost:3000`. Disposable editor `m1053-editor`
(role `editor`, created with `@apostrophecms/user:add`; password in a scratch file outside the
repository). Test pages created through the UI: "M1053 Menu Parent" and a child.

| Check | Steps | Result |
|---|---|---|
| Editor login | Login form on `localhost:3000` | **PASS**: admin bar with `m1053-editor`. (Login on `127.0.0.1` redirects to `localhost`, the base URL, where that cookie does not apply; known behaviour) |
| Draft not public | Editor: New Page "M1053 Menu Parent", Save Draft and Preview | **PASS**: editor's menu shows it as current page; logged out, the menu lacks it and its URL returns 404 |
| Published page in menu | Editor: Edit, Publish | **PASS**: published |
| Two levels, submenu | Editor on the parent: New Page "M1053 Menu Child" (slug under the parent), Publish and View; click the submenu toggle | **PASS**: chevron on the parent; toggle `aria-expanded="true"`; submenu shows the child with the right URL; parent marked `is-current-branch`; child `aria-current="page"` |
| Unpublished edit hidden | Editor: child title "… Edited", Save Draft | **PASS**: "Pending Updates" in the page manager; logged out, the menu still shows the published title |
| Hide in Navigation | Editor: child "Hide in Navigation: Yes", Update | **PASS**: logged out, the child is gone from the menu, the parent has no submenu toggle, the child's page still answers 200. Set back to No and updated for the layout checks |
| Desktop 1440, logged out | Child page, click the parent's toggle | **PASS**: submenu opens, published edited title shown, parent marked current branch, no horizontal overflow, no admin bar |
| Tablet 768 and mobile 375 | Chrome would not resize the window (outer width equals the 1440 px screen). The page was loaded in a same-origin iframe at 768 and at 375 px inside Chrome, and clicked with real clicks | **PASS** at both: "Menu" button shown, menu opens with all items, submenu expands to show the child, no horizontal overflow. At 375 the click on the child link reloaded the same page (it was the current page), so navigation to a different page was not shown at that width |
| Clean-up | Editor: archive the parent "and all child pages"; log out. Admin (`.env` test admin) archives `m1053-editor` through the REST API | **PASS**: "Content Archived"; logged-out menu back to the three earlier pages; account `archived: true`, its login now answers 400 |

No screenshots were saved. Left over: the two archived test pages and the archived account
`m1053-editor` (core renamed it with a `deduplicate-…` prefix on archive) in the local development
database. The disposable benchmark copy was deleted.

## Not done or not verified

- A MongoDB measurement of the change (Docker images to download again).
- Cluster mode on the MongoDB load test; the staging image with PBM; the hardening runbook §6 and §7
  rewrite; the PBM S3 tests.
- The CI fallback is proven locally only, until the PR's `secrets` job runs.
- The upstream db-connect issue URL (m1-050 results §5, D-DB-13).
