# m1-049 results: dump task without Litestream's tables, and the upstream issue

| | |
|---|---|
| **Task** | m1-049, D-DB-13 condition 1 ([m1-048 results §3.1](./m1-048-litestream-poc-results.md#31-apos-db-dump-stops-on-litestreams-tables)) |
| **Date** | 2026-11-07 |
| **Status** | Task built and tested locally (agent-executed). Upstream issue **drafted, not filed**: the owner files it and the URL is recorded here. **Superseded 2026-11-08:** the owner reversed D-DB-13 in m1-051; staging and production run MongoDB ([ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md), accepted in m1-052). Kept as a record. **The dump task was removed in m1-052** (owner's choice); the code is in Git history at `7344c51` |
| **Report** | [m1-049 report](../engineering/reports/2026/11/2026-11-07-m1-049-dump-task.report.md) |

## 1. Summary

- `node app assurer-backup:dump --output=<new file>` writes the same NDJSON as `apos-db-dump`,
  without Litestream's `_litestream_seq` and `_litestream_lock`. On the m1-048 test setup its file is
  **byte for byte** `apos-db-dump`'s output without the stray `{"_collection":"_litestream_seq"}` line.
  Exit code 0 only when every collection was written.
- Restored with `apos-db-restore` into a new, empty file: same tables (without Litestream's), same row
  counts, the same 30 index definitions, identical `aposDocs` rows. Started as a site, it passed the
  smoke suite (18/18).
- **Point 4 confirmed, with a worse effect than m1-048 saw.** `apos-db-restore` of a dump that
  contains the `_litestream_seq` header creates `_litestream_seq` as an Apostrophe collection table
  (`_id`, `data`). Litestream then cannot write to it: every checkpoint fails with
  `bump litestream seq: … table _litestream_seq has no column named id`, retried with growing back-off,
  while `litestream status` still says `ok`. Changes still reached the replica, late; the WAL was not
  checkpointed. The new task's dumps do not have that header, so they do not cause this.
- Dependency: `@apostrophecms/db-connect` is now a direct dependency (`^1.1.0`, the version Apostrophe
  already installs; owner approved, D-SEC-7).

## 2. The task

Module `modules/assurer-backup/` (registered in `app.js`), logic in `lib/dump.js`.

- Calls db-connect's own `dump()` (its public export) on a view of the database that lists every
  collection except names starting with `_litestream_`. No NDJSON code of our own.
- Opens **a new connection** with Apostrophe's `@apostrophecms/db` module (`connectToAdapter(uri)`),
  as `apos-db-dump` does. A first version used the app's own connection (`self.apos.db`). That dump had
  the same documents but different index names: on the connection that created them, the SQLite
  adapter reports indexes by their Mongo-style names (`expires_1`), and SQLite index names are
  database-wide. Restored, three of the 30 indexes were missing (`sessions`, `aposBearerTokens` and
  `aposJobs` lost their expiry index to `aposCache`'s and `aposNotifications`'), and one index changed
  direction. A unit test now covers this and fails on the first version.
- Any other table without an `_id` column still fails the dump on purpose. Only Litestream's tables are
  known to be safe to leave out.
- Writes to `<output>.partial` and renames it only on success, so a failed run leaves no file that
  looks complete. Refuses an existing `--output` file. Media are not included (D-DB-4).
- Like `apos-db-dump`, it reads a live database collection by collection; it is not a point-in-time
  snapshot across collections.

## 3. Tests (agent-executed, 2026-11-07)

| Check | Result |
|---|---|
| Unit tests `scripts/backup-dump.test.mjs` (temporary SQLite, Litestream-shaped tables, restore with db-connect's `restore()`, index names checked in `sqlite_master`) | PASS 4/4; the index test fails against the first version (checked) |
| `apos-db-dump` on the m1-048 Compose site, rebuilt with this branch | Exit 1, `no such column: _litestream_seq._id` (as in m1-048) |
| `assurer-backup:dump` on the same site | Exit 0; 12 collections, 81 documents; left out `_litestream_seq`, `_litestream_lock` |
| Task file against `apos-db-dump`'s file without its last line | Identical (`cmp`) |
| Existing `--output` file; no `--output` | Exit 1 each, clear message, nothing written |
| `apos-db-restore` of the task file into a new, empty file | Exit 0; 0 row-count differences; indexes 30/30 identical; `aposDocs` identical; no Litestream tables |
| Restored file as a site (restore service of the m1-048 Compose file, new volumes, no seed) | Starts; Litestream replicates it without errors and creates its own tables; `sanitize-after-restore` and `clear-form-rate-limit` run; smoke 18/18; the task dumps the restored copy too (exit 0, 81 documents) |
| Browser, logged out, restored copy (3046) and development site (3000) | Home page renders, no admin bar, no horizontal overflow. On the restored copy 6 of 7 images are broken, all under `/uploads/`: media are not in a database dump (D-DB-4). Development site: 0 broken |

## 4. Point 4: what `apos-db-restore` does to `_litestream_seq`

Done on `restore-check.sqlite`, a new, empty path that the m1-048 `litestream.yml` already watches.

1. `apos-db-restore` of `apos-db-dump`'s file (with the stray header) into the new path: exit 0. The
   file then has `CREATE TABLE "_litestream_seq" (_id TEXT PRIMARY KEY, data TEXT NOT NULL)`, empty.
   Cause, in `db-connect` 1.1.0 `lib/restore.js`: each header line opens that collection and runs
   `deleteMany({})`. In a new file this creates a collection table. In an existing file it would empty
   Litestream's table instead (code reading only; restoring into a non-empty database is not allowed).
2. Litestream picked the file up, created `_litestream_lock` in its own shape and left
   `_litestream_seq` as it was (Litestream's `(id INTEGER PRIMARY KEY, seq INTEGER)` was not created).
3. After a write burst of about 12 MB, every checkpoint failed:
   `level=ERROR msg="sync error" … error="checkpoint: bump litestream seq: SQL logic error: table
   _litestream_seq has no column named id (1)"`, with back-off growing to 32 s after 6 errors.
   `litestream status` showed `ok` throughout.
4. A later one-row write reached the replica about 19 s afterwards. A `litestream restore` of that
   replica into a new path passed `integrity_check` and had every row. The 12 MB WAL stayed
   uncheckpointed.

m1-048 saw an empty `_litestream_seq` and no warning because its write rate never triggered a
checkpoint. Not tested: how long the back-off grows, and how large the WAL gets on a busy site. A copy
restored from an old dump may need `_litestream_seq` dropped before Litestream starts (not tested).

## 5. Upstream issue draft (not filed)

**Where:** <https://github.com/apostrophecms/apostrophe/issues/new> (`@apostrophecms/db-connect` is
published from the monorepo, as in the m1-012 drafts).

**Duplicate check (2026-11-07, GitHub search API, read-only):** `litestream` 0 results;
`"no such column" sqlite` 0; `db-connect dump sqlite` 0; `apos-db-dump` 4, all closed and unrelated
(#2243, #5365, #4092, #1494). No duplicate.

**Sanitization:** no project code, paths, host names, credentials or personal data. Versions and
generic steps only.

> **Title:** db-connect: `apos-db-dump` fails on SQLite tables without an `_id` column (e.g. Litestream's), and `apos-db-restore` recreates them as collections
>
> **Versions:** @apostrophecms/db-connect 1.1.0 (apostrophe 4.34.0), SQLite adapter; Litestream 0.5.18.
>
> **What happens.** Litestream, a common continuous-backup tool for SQLite, adds two tables to the database it replicates: `_litestream_seq (id INTEGER PRIMARY KEY, seq INTEGER)` and `_litestream_lock (id INTEGER)`. `lib/dump.js` dumps every entry that `db.listCollections()` returns and pages through each one with `find().sort({ _id: 1 })`, so it stops with `no such column: _litestream_seq._id` and exits with code 1. By then it has written every Apostrophe collection and a header line `{"_collection":"_litestream_seq"}`.
>
> A script that checks the exit code reports every backup as failed. A script that does not keeps a dump that ends with that stray header. Restoring such a dump into a new database with `apos-db-restore` runs `db.collection('_litestream_seq')` and `deleteMany({})`, which creates `_litestream_seq` as a collection table (`_id`, `data`). Litestream then cannot update it, and every checkpoint fails with `bump litestream seq: SQL logic error: table _litestream_seq has no column named id`. Restored into an existing database, the same header would empty Litestream's table.
>
> **Reproduction.**
> 1. Run an Apostrophe site on SQLite and replicate its file with `litestream replicate`.
> 2. `apos-db-dump sqlite:///path/to/site.sqlite --output=dump.ndjson`: exit code 1, `no such column: _litestream_seq._id`.
>
> Without Litestream: `sqlite3 site.sqlite "CREATE TABLE extra (id INTEGER)"`, then dump.
>
> **Expected.** The dump contains only the database's collections and exits with 0. Restore never creates or clears a table it does not own.
>
> **Suggested fix.** In the SQLite adapter, have `listCollections()` return only tables that have the collection shape (`_id` and `data` columns), or at least skip names starting with `_litestream_` and `sqlite_`. Alternatively let `dump()` take an include or exclude list, with matching `--exclude` options on both command-line tools.
>
> **Also noticed.** On a connection that created an index, the SQLite adapter's `indexes()` reports its Mongo-style name (`expires_1`) instead of the SQLite name (`idx_<table>_expires`). SQLite index names are database-wide, so a dump made from that connection restores with missing indexes: `CREATE INDEX IF NOT EXISTS "expires_1"` on a second table is a no-op. The command-line tool is not affected because it opens its own connection.
>
> **Workaround.** We dump through `dump()` with a database view whose `listCollections()` leaves out `_litestream_*`, on a new connection.

**Filed:** not yet. Issue URL: _(the owner fills this in)_.

## 6. Clean-up and leftovers

- Containers and all eight `assurer-litestream-poc_*` volumes removed (`docker compose … down -v`),
  as the owner asked; they held only the disposable demo content and test data.
- The image `assurer-site:litestream-poc` was rebuilt with this branch; `-arm64` is unchanged.
- The test password and the dump file are in the session's scratch folder, outside the repository.
- No other content or accounts were touched. The development database got only the normal
  workflow-suite content.
