# m1-071 start handoff (2026-11-12)

| | |
|---|---|
| **Prepared** | 2026-11-12, by the agent at the end of m1-070 (agent-executed; not a human approval) |
| **State of `main`** | When this was written, `main` was `2a96ae8` (PR #85) and **PR #86 (m1-070) was still open**, not merged (checked on GitHub and with `git ls-remote`). This file is part of PR #86. Before starting, check that `6f35c32` and this file's commit are on `origin/main` (`git merge-base --is-ancestor <commit> origin/main`) |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [m1-070 report](../engineering/reports/2026/11/2026-11-12-m1-070-database-dashboard.report.md) · [m1-069 report](../engineering/reports/2026/11/2026-11-12-m1-069-arm64-restore-drill.report.md) "Other requests" · [content model](../content/apostrophe-content-model.md) (column menus) · `lib/area.js` · `modules/@apostrophecms/layout-widget/`, `modules/@apostrophecms/layout-column-widget/`, `modules/nested-layout-widget/`, `modules/nested-column-widget/` |

## 1. Where things stand

**Done in m1-070 (in PR #86)**

- The database dashboard, layer 1 (D-DB-24): `@apostrophecms/import-export` 3.7.2, admin only,
  imports as drafts by default; the admin-only "Data dashboard" (Overview, Find with read-only
  JSON, Activity, Health) that opens core's editors, managers and Document Versions.
- New suite `scripts/data-dashboard-test.mjs` in `test:ci`: Linux 42/42; Windows 38/38 with the
  import checks skipped, because import-export 3.7.2 builds uploadfs paths with `path` instead of
  `path.posix` (Windows only; upstream issue text in the m1-070 report).
- The m1-069 records commit `ba967d2` reaches `main` with PR #86.

**Open, for the owner**

1. **Merge PR #86** (it was still open when this was written).
2. **Deploy m1-070 to the OCI site** after the merge and the `release` run: `deploy.sh` with the
   merge commit (staging container runbook §12). Until then the OCI site has no dashboard. Then
   check as admin: Site admin → Data dashboard; Health shows `mongodb` and the database version.
   The dashboard has not run on MongoDB yet (m1-070 report, "Not done").
3. **The local dev server on port 3000** still runs the m1-069 code; restart it (`npm start`, or
   `npm run dev`). A change to a project admin component (`ui/apos/`) is rebuilt in development
   only with `APOS_DEV=1` set.
4. Optional: file the import-export Windows path issue upstream (text in the m1-070 report).
5. Still open from m1-069: a PITR restore drill on the OCI server's copy (PBM runbook §3), your
   decision.

## 2. Recommended next task

**`m1-071`: the Assurer widgets in layout columns, and more layout options**: the next item in
your order of 2026-11-12 (m1-069 prompt record). Design note first (the clean-architecture rule:
if the widget lists cannot be widened cleanly, propose the refactor before building).

What you asked for (m1-069 records):

1. The column-friendly Assurer widgets (hero, feature grid, stats, product cards and lists,
   people, locations, organisations, downloads, gallery, forms, …) in page **layout columns**.
   Today a layout column offers only Rich Text, Image, Video and Nested Layout: that is
   configuration, not a bug (`docs/content/apostrophe-content-model.md`).
2. In **nested columns**, the simple set, plus the grids once they collapse to one column on
   narrow widths.
3. **More layout starters**: 2, 3, 4 and 6 equal columns, as layout-widget variants through core
   options.

Points for the design note: which widgets suit a narrow column (and which need a minimum width);
one shared widget list in `lib/area.js` rather than copies per module; how the grids collapse in a
column; the editor's experience in the "Add Content" menu (grouping, order); browser checks at
1440, 768 and 375 px as an editor, not only as admin.

**After that, in your order:** the slideshow upgrade (hero-banner slides first; the autoplay pause
control for WCAG 2.2.2 first); the staged rename to `mimnets-wms` (a name map in INDEX first; stored
names stay brand-free, as the dashboard's `dataDashboardActivity` already is); the theme presets
(D-CONTENT-18, D-CONTENT-20). Later, from D-DB-24: backup status in the dashboard's Health tab, and
layer 2 (read-only MongoDB viewer).

## 3. Your question: does PBM have a UI?

No. PBM itself is command-line only (`pbm` / our `pbmc` wrapper) plus the `pbm-agent` service.
Percona's own graphical option is **Percona Monitoring and Management (PMM)**, a separate server
plus an agent next to MongoDB, which can run and list PBM backups. For us it would be a new,
large dependency (its own containers, a database user with backup rights, `arm64` support to
verify), through the dependency gate.

The agent's suggestion is the planned D-DB-24 follow-up instead: the `backup` service writes a
small status file after each run (last base backup, its result, PITR state), the app reads it
read-only, and the dashboard's Health tab shows it, with no new tool and no new rights for the
app. Restores stay deliberate command-line steps (PBM runbook §3), because a restore is
destructive. If you would rather have PMM, that is its own options paper first.

## 4. Left over on the owner's PC

- The local Docker project `mimnets-cms` from m1-069 (tag `ci` images and volumes).
- The dev server on port 3000 (above).
- Agent scratch files outside the repository (test logs). The m1-070 disposable database, uploads
  and test passwords were removed.

## 5. Limits

- No change to WordPress. Commit, push and PR need your approval. Anything on the OCI server is
  run by you.

## 6. Prompt for the new session

> Start m1-071. Read AGENTS.md and docs/milestones/m1-071-handoff.md first, check that PR #86 is
> on main, confirm the task with me, write the design note and stop for my approval.
