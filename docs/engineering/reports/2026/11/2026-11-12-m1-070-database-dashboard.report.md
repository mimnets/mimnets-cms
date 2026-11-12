# m1-070 — The database dashboard, layer 1

| | |
|---|---|
| **Task** | m1-070 (item 1 of the owner's queue in the m1-069 records) |
| **Date** | 2026-11-12 |
| **Scope** | Layer 1 of the [m1-047 plan §4.6](../../../../milestones/m1-047-sqlite-production-options.md) on MongoDB: design note, owner's approval, build, tests and browser checks. Not in scope (§11 of the design): backup status in the health panel, layer 2 (read-only MongoDB viewer) |
| **Prompt** | [2026-11-12-m1-070-database-dashboard.prompt.md](../../../prompts/2026/11/2026-11-12-m1-070-database-dashboard.prompt.md) |
| **Design** | [m1-070 database dashboard design](../../../../milestones/m1-070-database-dashboard-design.md), approved by the owner with every recommended answer (D-DB-24) |
| **Branch** | `feat/m1-070-database-dashboard` from `ba967d2` (the m1-069 records commit, which is not on `origin/main`: PR #85 was merged at `49de4b7` before it was pushed). Nothing committed or pushed |

Checks marked agent-executed were run by the agent. They are not human approval.

## What was built

| File | Change |
|---|---|
| `modules/assurer-data-dashboard/` | New module. Admin bar item "Data dashboard" (Site admin group), an admin modal with four tabs, and read-only API routes `overview`, `find`, `document`, `activity`, `health`, all `GET`, admin only, `404` for everyone else. `lib/` holds one file per tab plus `types.js`; the task `prune-activity` |
| `modules/assurer-data-dashboard/ui/apos/components/AssurerDataDashboard.vue` | The modal: core `AposModal`, `AposModalBody` and `AposButton`; Edit, New, Open and History open core's editor, manager and Document Versions |
| `modules/@apostrophecms/import-export/index.js` | New override: `importDraftsOnlyDefault: true`; `canImportOrExport`, `export`, `importFile`, `overrideDuplicates` refuse non-admins (`403`) and write activity entries; `insertDocs` gives the counts |
| `modules/@apostrophecms/doc/index.js`, `modules/@apostrophecms/page/index.js`, `modules/@apostrophecms/piece-type/index.js` (new) | `getBrowserData` leaves out the import and export menus for non-admins |
| `lib/site-admin.js`, `lib/import-export-access.js` | The admin check (same rule as the form submissions page) and the menu filter |
| `app.js`, `modules/@apostrophecms/admin-bar/index.js`, `modules/@apostrophecms/i18n/i18n/project/en.json` | Module registration, admin bar group, 68 `project:` strings |
| `package.json`, `package-lock.json` | `@apostrophecms/import-export` `^3.7.2` (D-DB-24) |
| `scripts/data-dashboard-test.mjs`, `scripts/run-ci-tests.mjs` | New suite, run by `npm run test:ci` |

### Dependency gate (`@apostrophecms/import-export` 3.7.2)

| Check | Result |
|---|---|
| Licence | MIT. 15 new packages in the lock file, all MIT or Apache-2.0 (`tar-stream`, `streamx`, `bare-*`, `b4a`, `csv-stringify`, …); nothing changed or removed |
| `npm audit` | Before and after: 0 critical, 0 high, 48 moderate, 3 low. No new finding |
| GitHub advisories | Read from the package changelog: seven advisories, all fixed in 3.7.1 and 3.7.2. The public GitHub API limit was used up (as in m1-069) and `gh` is not installed, so the advisory database was not queried directly; `npm audit` uses the same database for the installed versions |

## Changes from the design during the build

Also recorded in design note §12.

| Point | Design said | Built | Why |
|---|---|---|---|
| Users | override `modules/@apostrophecms/user` | none | The package's own `import-export-user` module already switches import and export off for users |
| Archive and restore in Find | separate buttons | through the editor's own menu (Edit) | Core's editor has Archive and Restore with their checks; separate buttons would duplicate them |
| Activity collection | `assurerActivityLog` | `dataDashboardActivity` | The owner's note during the build (prompt record): no brand in stored names, so the staged rename to `mimnets-wms` needs no data migration. Module names keep the `assurer-` prefix AGENTS.md requires until the rename task |
| Refused access | logged-in and anonymous | logged-in users only | Anonymous requests would let any visitor fill the log |
| Health | uploads folder size | media size from the attachment records (sum of `length`) | No folder walk; the records hold each file's size. The app's image commit is not available inside the app, so it is not shown |
| Overview | all piece types | without core's cross-type views Recently Edited and Submitted Drafts | They own no documents (found in the browser check) |

## Results

| Check | Result |
|---|---|
| `npm run lint` | PASS, no warnings |
| `npm run test:ci`, Windows (final code) | PASS. Data dashboard 38/38 with 5 checks SKIP (below); all other suites unchanged: smoke 18/18, workflow 15/15, content model 106/106, SEO 37/37, publishing 59/59, persistence 7/7 + 7/7 + 8/8, redirects 52/52, WordPress import, forms 84/84, security 65/65 and 15/15 |
| `npm run test:ci`, Linux (final code; throwaway `node:24-bookworm-slim` container, the app image's pinned base, on a copy of the tracked files without `.env`) | PASS. Data dashboard **42/42, nothing skipped**, including: an editor's import refused (`403`); the admin's import finds the existing product; "replace existing" as drafts; the draft becomes the imported version and **the published product is unchanged**; visitors get no draft; import and replacement in the activity log. All other suites as on Windows |
| `test:smoke` / `test:workflow` / `test:persistence` against a running server with the new code (a disposable server on port 3001; see Left over for port 3000) | smoke 17/18, workflow 15/15, persistence 7/7. The one smoke FAIL, "demo notice rendered", is configuration: that server ran without `APOS_DEMO_SITE=1`. `test:ci` sets it and passes 18/18 on both platforms |

**SKIP on Windows only.** `@apostrophecms/import-export` 3.7.2 builds uploadfs paths with
`path` instead of `path.posix` (`path.resolve('/import-export', …)` in `lib/methods/import.js`,
`path.join('/exports', …)` in `lib/methods/export.js`). On Windows an import fails with `EINVAL`
(`uploads\C:\import-export\…`) and the export URL has backslashes, which browsers still accept.
Linux, where CI and the OCI site run, is not affected. On Windows the suite checks the failure
path instead: the import answers `500` and the activity log records it as `failed` with its size.
Upstream issue text for the owner to file, if wanted:

> **Import fails on Windows: uploadfs paths built with `path` instead of `path.posix`.** In 3.7.2,
> `lib/methods/import.js` uses `path.resolve('/import-export', path.basename(exportPath))` and
> `lib/methods/export.js` uses `path.join('/exports', filename)` for uploadfs paths. On Windows
> these become `C:\import-export\…` and `\exports\…`; the local uploadfs backend then tries to
> create `public\uploads\C:\import-export`, and every import fails with `EINVAL`. Using
> `path.posix` for uploadfs paths fixes both.

## Browser checks (Chrome, agent-executed)

On a disposable server (port 3001, its own temporary SQLite database and uploads folder, no
`.env`, random secrets) with the project's guarded test tasks for the admin and editor. Desktop
at 1440 px; 768 and 375 px in a same-origin iframe of that width over the page, because the
browser window could not be resized.

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Admin: dashboard in the admin bar | Logged in as admin; opened Site admin | "Data dashboard" listed after Users and Redirects | PASS |
| Admin: Overview | Opened the dashboard | Counts per type (Products 4 live, 3 published, 1 with unpublished changes; Users total only); newest change and author; form submissions count and link; Open and New per type. First run listed Submitted Drafts and had misaligned action cells: fixed, checked again | PASS (after fix) |
| Admin: Find | Typed "demo DRAFT prod", pressed Enter | One result, the draft product, status "Draft only", with View data, Edit, History | PASS |
| Admin: View data | Clicked View data | Stored draft shown read-only as formatted JSON. First run inherited the site's CSS (white text, centred heading): fixed, checked again | PASS (after fix) |
| Admin: Edit from Find | Edit → changed the short description → Save Draft | Core's product editor; "Draft saved"; the result row and the open data view updated themselves (the data view did not update in the first run: fixed, checked again); status still "Draft only" | PASS (after fix) |
| Admin: History from Find | Clicked History | Core's Document Versions: the dashboard edit by the admin, field marked Modified | PASS |
| Admin: Health | Opened Health | Engine `sqlite`; values SQLite does not give say "Not available on this engine"; records counted (versions count wrong in the first run: fixed, 30 after); media 8 files; disk space; versions; backups note | PASS (after fix) |
| Admin: Open manager, Import and Export menus | Overview → Products → Open; ⋮ menu; Import; a row's ⋮ | Core's Manage Products; Import offered with "Import all documents as drafts" ticked by default (cancelled without a file); Export in the row menu | PASS |
| Admin: export and import through the UI | — | Not run: an export starts a file download (needs the owner's approval) and an import fails on Windows (above). Both are covered by the Linux suite through the same API | NOT TESTED |
| Editor: no dashboard | Logged in as the disposable editor | No Site admin group (Redirects only, as a plain button), no Data dashboard | PASS |
| Editor: no import or export | Content → Products; ⋮ on a row; browser data for pages, products and the context menu | No utility menu (no Import); no Export in the row menu; no import or export operation anywhere; the batch ⋮ holds only core's Localize | PASS |
| Editor: API | The editor's session called the four dashboard routes | `404` each; the admin then saw four "Refused access" entries by the editor in Activity | PASS |
| Logged out | Logged out, loaded the home page | No admin bar; dashboard `404`; draft products `403`; export `403` | PASS |
| Layout 1440 / 768 / 375 px | Every tab at each width | No horizontal page overflow; at 375 px the tabs wrap and the Overview table scrolls inside its own box | PASS (768 and 375 px by iframe, not window resize) |

## Implicit state review

| State | Where | Decision | Reason |
|---|---|---|---|
| Each tab's data | modal | **Made explicit**: `idle`, `loading`, `ready`, `error` per tab, with a retry button for `error` | No blank tab when a request fails; a tab loads once and reloads on Refresh, Search, filters and after an editor closes |
| The data view | modal | **Made explicit**: its state names its document; it reloads when that document is edited or restored | Found in the browser check: after an edit it showed the old JSON |
| Outcome of an import | import-export, recorded in the activity log | **Made observable**: `done`, `waiting-for-duplicates`, `waiting-for-locale`, `failed` | The package keeps this in a job and notifications; an admin can now see unfinished and failed imports |
| Who may import and export | package: anyone who may create and edit | **Made explicit and enforced on the server**, menus hidden for others | One rule (`lib/site-admin.js`) for the dashboard, the menus and the routes |
| Activity entries over time | `dataDashboardActivity` | **Bounded**: 365 days, pruned at each start and by a task | Append-only, so it would grow without end |
| A value the engine cannot give | Health | **Made explicit**: `null`, shown as "Not available on this engine" | SQLite (local) and the app's MongoDB user cannot give every statistic; an error would hide the rest |
| Export file | package: public URL for 10 minutes | **Left as is** | Package default, unguessable since 3.7.1 |
| Admin UI build in development | core: rebuilt only when packages change | **Left as is, reported** | A change to a project admin component needs `APOS_DEV=1` for `npm run dev`/`npm start` to rebuild it (`apostrophe/modules/@apostrophecms/asset/index.js`). Production builds (`npm run build`) always build. Found when a restart served an old modal |

## For the owner

1. Approve the commit, push and PR for this branch. The PR also carries the m1-069 records
   commit `ba967d2`, which is not on `main`.
2. After the merge, the OCI site needs the new images (`deploy.sh`, staging runbook) before the
   dashboard is there. Nothing on the server was changed in this task.
3. Optional: file the upstream issue above for the Windows path bug.

## Not done or not verified

- The dashboard on MongoDB (the Docker stack or the OCI site): every run used SQLite. The Health
  values for MongoDB (`buildInfo`, `dbStats`) are read through the app's own connection with its
  `readWrite` user, which MongoDB allows, but this was not run.
- Export and import through the browser UI (see the browser checks).
- GitHub advisory database queried directly (API limit; see the dependency gate).
- Backup status in Health and layer 2: later tasks (D-DB-24).

## Left over

- The local dev server on port 3000 (SQLite, started in m1-069), still running the m1-069 code.
  The agent's request to stop it was refused by the session's permission check; restart it to
  load m1-070.
- Scratch files outside the repository (test logs, the lock file copy). The disposable database,
  uploads and test passwords were removed.
- Local Docker project `mimnets-cms` from m1-069, unchanged.
