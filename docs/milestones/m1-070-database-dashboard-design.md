# m1-070: the database dashboard, layer 1 (design)

| | |
|---|---|
| **Task** | m1-070 |
| **Date** | 2026-11-12 |
| **Author** | The agent (agent-executed; not a human approval) |
| **Status** | **D-DB-24 decided 2026-11-12 by the owner: approved with every recommended answer in §11** ("approve"). Built in m1-070 |
| **Related** | [m1-047 plan §4.6](m1-047-sqlite-production-options.md) (the approved two-layer plan, Q5) · [ADR-0002](../architecture/decisions/ADR-0002-database-strategy.md) §8 · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) follow-ups · m1-012 (form submissions page) · m1-022 (admin bar groups) |

This is a paper task. No server, container or database was changed. The facts come from the
repository at `ba967d2`, `apostrophe` 4.34.0 in `node_modules`, and the published
`@apostrophecms/import-export` 3.7.2 package (read, not installed).

## 1. The request and the limits

- **The owner's requirement** (m1-043, restated m1-047): a database dashboard with CRUD, export
  and import, plus the agent's suggested features. The plan in m1-047 §4.6 was approved with two
  layers (Q5): layer 1 in Apostrophe, layer 2 a read-only raw viewer. m1-070 is layer 1.
- **Limits:** content only through Apostrophe APIs; no raw writes, no ORM (ADR-0002, AGENTS.md).
  Admin only. No hard delete. Community Edition only. Each new package through the dependency gate.
  It must work on SQLite (local development and the test suites) and on MongoDB 8.0 (the OCI site).

## 2. What changed since the m1-047 plan

The plan was written for SQLite on 2026-11-07. Four facts are different now:

| Fact | Effect on the design |
|---|---|
| The engine for shared sites is **MongoDB** again (ADR-0004). SQLite is local only | The SQLite parts of §4.6 drop out: `VACUUM INTO` snapshots, Litestream lag, `-wal` size, Datasette. The health panel reads MongoDB through the app's own connection |
| Apostrophe core 4.34 ships **Document Versions** (`@apostrophecms/document-versions`, on for pages and pieces by default): every draft save and publication with its editor, a field-by-field change list, restore from any version, and Undo Publish | Most of the planned audit log and "one-click undo" already exist in core, per document. The dashboard does not rebuild them; it links to them |
| Core 4.34 ships the **Recently Edited** manager: one list across all document types, last 30 days, with filters | The planned "search across documents" and "what changed recently" are partly there already |
| `@apostrophecms/import-export` is now **3.7.2** (MIT, 2026-11-11). 3.7.1 and 3.7.2 fixed seven advisories, including unguessable export file names, import size limits, server-side duplicate lists and the publish-permission gap | Above the ADR-0002 §8 minimum (3.7.1). It has an "import all documents as drafts" option (`importDraftsOnlyDefault`) and one permission method, `canImportOrExport`, that the project can extend |

One more fact limits the health panel: on the OCI stack the app's MongoDB user has **`readWrite` on
the site database only** (`docker/staging/mongo-entrypoint.sh`). It can read database and collection
statistics, but not PBM's backup state in the `admin` database. This design keeps it that way (§7).

## 3. Summary

1. **CRUD stays in Apostrophe's own editors.** The dashboard finds any document and opens it in
   the normal editor, with schema validation, permissions, draft and publish, and Document Versions.
   It does **not** edit raw JSON. JSON is shown read-only. This differs from m1-047 §4.6, which said
   the dashboard "creates, edits, archives and restores documents"; it still does all four, through
   core (§5).
2. **Export and import through `@apostrophecms/import-export` 3.7.2**, admin only, imports as
   drafts by default, users never exported. It adds Export and Import to the existing page and
   piece managers; the dashboard links to them.
3. **One new admin-only module, `modules/assurer-data-dashboard`**: a "Data dashboard" item in the
   admin bar's Site admin group that opens an Apostrophe admin modal with four tabs:
   **Overview**, **Find**, **Activity** and **Health**.
4. **An append-only activity log** for what core does not record: exports, imports and refused
   access. Content edits are already recorded by Document Versions.
5. **No new snapshot mechanism.** Imports go into drafts, so the public site does not change until
   someone publishes; Document Versions undoes a single document; PBM point-in-time recovery covers
   the whole database (restore into a new, empty database only).
6. **Not in m1-070:** backup status in the health panel (it needs a change to the Compose stack,
   §7) and layer 2, the read-only MongoDB viewer (§9).

## 4. The four tabs

| Tab | Shows | Actions |
|---|---|---|
| **Overview** | Every document type the admin may see (pages, each piece type, images, files, global, users): count of drafts, published, archived, and drafts with unpublished changes; the newest change and who made it | "Open manager" opens the type's normal manager (where Export and Import also are). "New" opens the normal create modal |
| **Find** | Search by title, slug or `_id` across all types, with type and status filters. A result shows the document's fields as read-only, formatted JSON. Fields that hold secrets are never sent (§6) | "Edit" opens the normal editor; "History" opens Document Versions; "Archive" and "Restore" use the type's own archive action; "Copy JSON" |
| **Activity** | The activity log (§5.3): exports, imports, refused access. Filter by kind, user and date | None. The log cannot be changed from the dashboard |
| **Health** | Engine and version; database data, storage and index size; document, version and attachment counts; size of the uploads folder and free disk space; Apostrophe, Node and app versions | "Refresh" |

The Find tab exists because Recently Edited covers only 30 days and has no `_id` or slug search, and
because the owner asked to see a document's data directly. The JSON is read-only on purpose: a raw
edit would skip validation, permissions, versions and the search index (m1-047 §4.6).

## 5. Architecture

### 5.1 Where the code goes

| Path | Change |
|---|---|
| `modules/assurer-data-dashboard/index.js` | New module. Registers the admin bar item and the modal. API routes under `/api/v1/assurer-data-dashboard/`: `overview`, `find`, `doc/:id`, `activity`, `health`, all `GET`. Every route checks admin first and answers `404` otherwise, as the form submissions page does (m1-012) |
| `modules/assurer-data-dashboard/lib/overview.js`, `find.js`, `health.js`, `activity.js` | One file per tab, each a plain function taking `apos` and `req`, so each is testable alone |
| `modules/assurer-data-dashboard/ui/apos/components/AssurerDataDashboard.vue` | The modal, built from core admin components (`AposModal`, `AposTable`, `AposButton`, `AposTabs`). It opens editors with core's client API (`apos.doc.edit`) and managers with their admin-bar actions |
| `modules/@apostrophecms/import-export/index.js` | New override (core-override convention). `extendMethods` → `canImportOrExport`: admins only, then the package's own check. Option `importDraftsOnlyDefault: true` |
| `modules/@apostrophecms/user/index.js` | Option `importExport: { import: false, export: false }` (§6) |
| `modules/@apostrophecms/admin-bar/index.js` | Add `assurer-data-dashboard` to the `project:adminBarSiteAdmin` group |
| `app.js` | Register `@apostrophecms/import-export` and `assurer-data-dashboard` |
| `modules/@apostrophecms/i18n/i18n/project/en.json` | New `project:` keys |
| `package.json`, `package-lock.json` | `@apostrophecms/import-export` `^3.7.2`, after the gate (§8) |
| `scripts/data-dashboard-test.mjs`, `package.json` | New suite `npm run test:dashboard`, added to `test:ci` |

**Who is an admin.** The same check the form submissions page uses:
`self.apos.permission.can(req, 'edit', '@apostrophecms/user')`, which only the admin role passes.

**Why an admin modal, not a server page.** The form submissions page (m1-012) is a server-rendered
JSX page, which suits a read-only table. The dashboard opens Apostrophe's editors, managers and
Document Versions, which are client-side admin components, so it must live in the admin UI.

### 5.2 Reading data

Overview and Find use Apostrophe's query builder (`apos.doc.find(req, …)`, with `.archived(null)`,
`.locale()` and `.project()`), so the admin's permissions apply and SQLite and MongoDB behave the
same. Counts use `toCount()`. The JSON view uses `find(req, { _id })` with the type's own
projection, not the raw collection. Health uses `apos.db.stats()` and `apos.db.collection(name)
.countDocuments()`, both allowed for the app's `readWrite` user. If the adapter does not support a
statistic (SQLite may not), the panel says "not available on this engine" instead of an error.

### 5.3 The activity log

| | |
|---|---|
| **Records** | Export (user, time, types, count, format); import (user, time, file name and size, counts created, replaced and failed, drafts-only on or off); refused access to the dashboard or to import and export (user or anonymous, route, time). No document content, no file contents, no IP addresses |
| **How** | `extendMethods` on the import-export module's export and import methods (the exact method names are checked in the build; the package emits no events), and in the dashboard's admin check |
| **Storage** | Its own collection, `dataDashboardActivity` (no brand in stored names, for the staged rename), through `apos.db.collection()`, as core does for locks, notifications and caches. It is not content, so it is not a document type, is not in the managers and is never exported. Works on SQLite and MongoDB |
| **Append-only** | The module has insert and read code only. No route changes or deletes an entry |
| **Retention** | Entries older than 365 days are removed by a task, `node app assurer-data-dashboard:prune-activity`, run by the existing schedule or by hand (§11, question 4) |

Content edits are not duplicated here. Document Versions already records who saved or published
each page and piece, and when.

### 5.4 Undo

| Mistake | Undo |
|---|---|
| A wrong edit, publish or archive of one document | Document Versions (restore, Undo Publish) or the type's Restore action |
| A bad import | It went into drafts: the public site did not change. Discard the drafts, or restore the replaced documents from Document Versions. The activity entry lists what the import replaced |
| Damage to the whole database | PBM point-in-time recovery, into a new, empty database only (PBM runbook §3). The activity entry gives the time to restore to |

## 6. Security and personal data

1. **Admin only, enforced on the server** for every dashboard route and for import and export.
   Editors see no dashboard item and no Import or Export menus. Anonymous users get `404`.
2. **Users are never exported or imported** (`importExport` off on the user type). Password hashes
   are in `aposUsersSafe`, which import-export never reads. Sessions, bearer tokens and login
   throttle data are not documents and are not exported either.
3. **The JSON view leaves out secrets**: for users it shows only title, username, email, role and
   dates. It follows each type's `viewPermission` the same way the REST API does.
4. **Form submissions are not in the dashboard.** They are personal data in their own collection,
   with their own admin page and CSV export (m1-012). The Overview shows only their count, with a
   link to that page.
5. **Export files** are published under `/uploads/exports/<random id>` and removed after 10 minutes
   (package default). Since 3.7.1 the names cannot be guessed. The agent keeps the default.
6. **Import limits:** the package's `importLimits` defaults (100,000 entries, extraction at most
   100 times the archive size). The upload size is also limited by nginx (`client_max_body_size`),
   unchanged.
7. **No new route writes anything.** The dashboard's own routes are all `GET`; writes go through
   core and import-export routes, which have their own checks.

## 7. Backup status: not in m1-070

The health panel would be more useful with "last base backup, its result, last PITR slice". The app
cannot read PBM's state, and the agent does not recommend giving the app's user rights in `admin`.
The clean way is for the `backup` service, which already runs `pbm`, to write a small status file
after each run into a new volume that the app mounts read-only. That changes the Compose stack, the
images and the OCI site, so it is its own task with its own approval. Until then the panel says
"Backups: see `pbmc status` on the server".

## 8. The dependency gate (`@apostrophecms/import-export`)

| Check | Result so far | Still to do in the build |
|---|---|---|
| Licence | MIT. Direct dependencies: `bson`, `dayjs`, `lodash`, `bluebird`, `csv-parse`, `csv-stringify`, `tar-stream` | Licence of every new package in the lock file |
| Advisories | The changelog lists seven, all fixed in 3.7.1 and 3.7.2 | GitHub advisories for the package and its dependencies on the build day |
| `npm audit` | Today: 0 critical, 0 high, 48 moderate, 3 low | Run before and after; no new high or critical |
| Age | 3.7.2 is one day old | Pin `^3.7.2` |
| SQLite | Not proven with `@apostrophecms/db-connect` | Export and import round trip in the new suite, on SQLite and in the Docker stack on MongoDB |

## 9. Layer 2, the read-only MongoDB viewer: a later task

ADR-0004 lists it as a follow-up. The agent suggests, for that task: a read-only MongoDB user and
`mongosh` from the `mongo` image, reached through a script on the server or an SSH tunnel, with
MongoDB Compass on the owner's PC as an option. No web-based database tool on the server. This
needs no new server dependency.

## 10. Tests and proof

- **New suite** `npm run test:dashboard` (SQLite, the test guard's temporary database): each route
  as admin (`200`), editor (`404`) and anonymous (`404`); counts match the query builder; the JSON
  view of a user has no secret fields; the user type cannot be exported; export and import each add
  one activity entry; an import with drafts-only leaves published documents unchanged; an import as
  an editor is refused and logged.
- **The four required suites** plus `test:security`, `test:forms` and `test:unit`.
- **The Docker stack on MongoDB** (local `mimnets-cms`): the health panel's MongoDB numbers and one
  export and import round trip.
- **Browser checks (Chrome)**: as admin, every tab, an export, an import into drafts with an
  overwrite, opening the editor and History from Find, archive and restore. As a disposable
  editor: no dashboard item, no Import or Export menus, the API answers `404`. Logged out: no draft
  is public after the import. 1440, 768 and 375 px for the modal.
- **The implicit state review**, starting with: the import job (owned by the package), the export
  file's 10-minute life, the activity log, and the health panel's "not available" state.

## 11. Questions for the owner

1. **Approve this design** as written? (Recommended.) It keeps CRUD in Apostrophe's editors and
   shows JSON read-only, and replaces the planned snapshots with draft imports, Document Versions
   and PBM point-in-time recovery.
2. **Add `@apostrophecms/import-export` `^3.7.2`**, subject to the gate checks in §8? (Recommended.)
3. **Import and export for admins only?** (Recommended.) The alternative is the package's default:
   anyone who may create and edit a type, which includes editors.
4. **Keep activity entries for 365 days?** (Recommended.) Or another period.
5. **Backup status in the health panel as a separate, later task** (§7)? (Recommended.) Or in
   m1-070, which makes it touch the Compose stack and the OCI site.
6. **Layer 2 as a separate, later task** (§9)? (Recommended.)

## 12. Changes during the build (m1-070)

Found while building; none changes the approved design's intent. Details in the
[m1-070 report](../engineering/reports/2026/11/2026-11-12-m1-070-database-dashboard.report.md).

| Point | Design said | Built | Why |
|---|---|---|---|
| Users | override `modules/@apostrophecms/user` (§5.1, §6) | none | The package's own `import-export-user` module already switches import and export off for users |
| Archive and restore in Find (§4) | separate buttons | through the editor's own menu (Edit) | Core's editor has Archive and Restore with their checks |
| Activity collection (§5.3) | `assurerActivityLog` | `dataDashboardActivity` | The owner's note during the build: no brand in stored names, so the staged rename to `mimnets-wms` needs no data migration |
| Refused access (§5.3) | logged-in and anonymous | logged-in users only | Anonymous requests would let any visitor fill the log |
| `viewPermission` in the JSON view (§6) | follow each type's `viewPermission` | nothing extra | The view is admin only, and the admin role passes every `viewPermission` |
| Health (§4) | uploads folder size, app version | media size from the attachment records; Apostrophe, import-export and Node versions | No folder walk; the image commit is not available inside the app |
| Overview (§4) | every piece type | without core's cross-type views (Recently Edited, Submitted Drafts) | They own no documents |
| Import on Windows | — | fails in `@apostrophecms/import-export` 3.7.2 (uploadfs paths built with `path`, not `path.posix`); Linux is not affected | Proven on Linux; the suite skips those checks on Windows and checks the failure path instead |
