# m1-050 load test results: SQLite with Litestream at the expected site size

| | |
|---|---|
| **Date** | 2026-11-08 |
| **Task** | m1-050, D-DB-13 condition 2 ([handoff](./m1-050-handoff.md)) |
| **Setup** | The m1-048 test image (`assurer-site:litestream-poc`, rebuilt in m1-049 from what is now `main` `9c40408`), under its own Compose project `assurer-load-test`, with its own volumes. Docker Desktop on the owner's Windows PC, 16 CPUs and 8 GB given to Docker; `amd64` only |
| **Scripts** | [`scripts/load-test.mjs`](../../scripts/load-test.mjs) (seed and run), [`scripts/load-test-loop-delay.mjs`](../../scripts/load-test-loop-delay.mjs) (event-loop probe), [`docker/litestream-poc/compose.load-test.yaml`](../../docker/litestream-poc/compose.load-test.yaml). Node built-ins only; no new dependency or load tool |
| **Result** | **FAIL** against the agreed limit. The cause is the SQLite adapter's query shape, not Litestream and not the menu. With a measurement-only adapter patch, HTTP p99 passes, but event-loop p99 and saves still fail at 8 readers |

All runs are **agent-executed**. They are not human approval.

## 1. What the owner agreed (2026-11-08, before any run)

| Item | Owner's answer |
|---|---|
| Task | "Load test (Recommended)" |
| Expected size | "~3x today (Recommended)": about 100 pages nested 3 levels deep, about 150 pieces, about 400 images, about 10 versions per doc |
| Limit | "HTTP 1 s, loop 200 ms (Recommended)": page request p99 ≤ 1 s, event-loop delay p99 ≤ 200 ms, 0 errors, at least 90% of saves complete, under the m1-048 P6 profile (60 s, 8 parallel readers, one save a second) |

## 2. Content built

Through Apostrophe's REST API only, as the admin, on the disposable copy (`load-test.mjs seed`,
739 s). Every title starts with "Load test".

| Kind | Count |
|---|---|
| Pages | 100 new (6 sections: 2 division pages, 4 default pages; 30 children, of which 10 are product category pages; 60 grandchildren; 4 at level 4), plus the demo home page. Each has rich text and an image widget |
| Pieces | 150: 60 products, 30 people, 15 organizations, 20 locations, 25 files (PDF) |
| Images | 400 image pieces with real PNG attachments (432 attachments in all) |
| Versions | 10 edit-and-publish rounds on each of the 225 pages, products, people, organizations and locations |
| Database | `aposDocs` 1,325 rows (draft and published), `aposDocsVersions` 2,688; 18.8 MB file plus a 41 MB WAL; average doc 4 KB, 5.3 MB of JSON |

The REST inserts sent no slug, so the seeded pages got short numeric slugs (for example `/48`), not
nested ones. This does not change the page tree or the queries; it makes the URLs look odd.

## 3. Results

### 3.1 The agreed test (8 readers), and the same load at 1, 2 and 4 readers

60 s each; readers fetch every published page logged out, round robin; one draft save a second as
the admin. "Saves" counts saves that completed inside the 60 s window.

| Run | Requests | Errors | HTTP p50 / p99 | Loop delay p50 / p99 / max | Saves in window | Pass |
|---|---|---|---|---|---|---|
| Demo content only, 8 readers | 1,344 | 0 | 319 / **855** ms | 160 / **428** / 865 ms | **43 / 59** | No (loop, saves) |
| **3x size, 8 readers (agreed)** | 368 | 0 | 1,278 / **2,461** ms | 578 / **956** / 967 ms | **12 / 59** | **No** (HTTP, loop, saves) |
| 3x size, 4 readers | 389 | 0 | 590 / 1,225 ms | 278 / 583 / 605 ms | 25 / 59 | No |
| 3x size, 2 readers | 323 | 0 | 350 / 776 ms | 138 / 381 / 586 ms | 51 / 59 | No (loop, saves) |
| 3x size, 1 reader | 312 | 0 | 164 / 406 ms | 141 / 263 / 1,425 ms | 57 / 59 | No (loop) |

Single requests with no load, 3x size (p50 of 5): home 196 ms, product category 221 ms, level-4 page
171 ms, 404 page 208 ms. With demo content only: home 35 ms, 404 page 29 ms.

The demo-only baseline already fails the loop limit and the saves at 8 readers. Eight readers that
never pause keep a single Node process busy all the time, so the event loop is never idle. 368
requests a minute is about 6 a second, or more than 500,000 a day; a corporate site of this size
normally sees much less. The agreed limit still applies, and this note is only to read the numbers.

### 3.2 Cause: the adapter's queries cannot use the indexes

A CPU profile of 10 requests (inspector; the profiled path turned out to be a not-found page, which
runs the same kind of queries) puts 1,428 of 2,023 ms profiled (about 70%) in better-sqlite3's
synchronous `Statement.all`, under db-connect's `toArray`. Rendering took about 30 ms.

A hook on better-sqlite3 counted the statements per request (home page, 3x size): **11 statements,
256 ms**, each 20–50 ms. For each equality or `$in` condition, db-connect 1.1.0 (the latest release on
2026-11-08) writes:

```sql
(json_extract(data, '$.slug') = ?
  OR (json_type(data, '$.slug') = 'array'
      AND EXISTS (SELECT 1 FROM json_each(json_extract(data, '$.slug')) WHERE value = ?)))
```

The `OR` with the array branch stops SQLite using the expression indexes that Apostrophe already
creates, so every statement scans the whole `aposDocs` table:

| Query | Plan | Time |
|---|---|---|
| `slug` with the array branch | `SCAN aposDocs`, correlated `json_each` | 14.7 ms |
| `slug` without it | `SEARCH … USING INDEX idx_aposDocs_slug_aposLocale` | 0.15 ms |
| `aposDocId` with the array branch | `SCAN aposDocs` | 14.2 ms |
| `aposDocId` without it | `SEARCH … USING INDEX idx_aposDocs_aposDocId_aposLocale` | 0.01 ms |

The cost grows with the total size of `aposDocs` (all docs, both modes, and every image), not with
the page shown. better-sqlite3 runs on the main thread, so while a scan runs the app serves nothing
else, saves included.

**Not the cause:** Litestream (m1-048 already showed no share), and at this size the two-level menu:
its path query took about 6 ms of the 256 ms.

### 3.3 Measurement with the adapter patched (disposable container only)

With the owner's approval ("Measure a fix, then decide (Recommended)"), the agent patched the
container's copy of `@apostrophecms/db-connect/adapters/sqlite.js` in place. Equality and `$in`
conditions on fields that Apostrophe always stores as scalars (`aposDocId`, `aposLocale`, `aposMode`,
`slug`, `type`, `level`, `path`, `redirectSlug`, `parkedId`) skip the array branch. Array fields
such as `historicUrls` keep it. Nothing in the repository was changed. Smoke on the patched copy: 18/18.

| Run (3x size, patched) | Requests | HTTP p50 / p99 | Loop delay p50 / p99 / max | Saves in window | Pass |
|---|---|---|---|---|---|
| **8 readers (agreed)** | 1,125 | 422 / **677** ms | 199 / **342** / 356 ms | **36 / 59** | **No** (loop, saves); HTTP passes |
| 4 readers | 965 | 224 / 548 ms | 72 / 293 / 457 ms | 59 / 59 | No (loop) |
| 2 readers | 965 | 109 / 331 ms | 50 / 156 / 495 ms | 58 / 59 | **Yes** |
| 1 reader | 974 | 55 / 139 ms | 53 / 95 / 297 ms | 59 / 59 | **Yes** |

Single requests with no load (p50 of 5): home 55 ms, product category 79 ms, level-4 page 53 ms,
404 page 55 ms; about 3.5 times faster. SQLite time per request fell from about 250 ms to 6–23 ms.

What is left, at about 50–100 ms a request:

- On pages below the home page, the menu's query for the home page's children and grandchildren
  (21 ms) and turning those docs back into objects. This is the m1-048 menu point again; it now
  matters because the rest is fast.
- Node work per doc: db-connect's `deserializeDocument` and `convertDates`, and Apostrophe's
  `walkBody`.
- On 404 pages, the soft-redirect lookup on `historicUrls` (14 ms), a real array field, which keeps
  its scan.

At 8 readers that never pause, one Node process is still saturated, so the loop limit fails even
with fast queries.

## 4. Options for the owner

| Option | What it changes | Expected effect | Cost and risk |
|---|---|---|---|
| A. Upstream fix in db-connect (issue in §5) | Index-usable SQL for scalar fields | As in §3.3: HTTP passes at 8 readers; loop and saves still fail at 8, pass at 1–2 | No project code. Timing is up to the maintainers |
| B. A project patch of the adapter until upstream fixes it | Same as A, now | As A | Patching `node_modules` needs a tool (for example `patch-package`, a new dependency) or a vendored copy; maintenance on every upgrade. Its own approval |
| C. Lighter menu query | `views/layout.jsx` menu: load only the fields the menu needs | Removes most of the 21 ms on inner pages | Small project change; its own approval |
| D. Logged-out page cache at the reverse proxy (for example nginx, a few seconds) | Repeat reads of the same page | Readers' p99 would fall to a few ms; the app's loop is mostly idle, so saves complete | Editors and logged-in pages still pay full cost; cache rules and purge to design; the image needs approval |
| E. Back to MongoDB (D-DB-13 option A) | Engine | Native indexes; not measured on this project | Reverses D-DB-13; architecture gate; PBM and its S3 tests return |
| F. Change the limit or the profile | What "pass" means | With the patch, 2 constant readers (about 16 requests a second) already pass | The owner's decision; the P6 profile is far above expected traffic (§3.1) |

The agent's view: A plus B (or A alone, if the owner can wait), with C, gives fast pages at the agreed
size. Whether to also add D, or to change the profile (F), depends on the traffic the owner expects.
E is not needed for speed if A or B is in place.

## 5. Upstream issue draft (not filed)

> **Title:** SQLite adapter: equality and `$in` on scalar fields cannot use expression indexes
>
> **Versions:** @apostrophecms/db-connect 1.1.0 (apostrophe 4.34.0), SQLite adapter, better-sqlite3
> as installed.
>
> **What happens:** For every equality and `$in` condition, the SQLite adapter emits
> `(json_extract(data,'$.f') = ? OR (json_type(data,'$.f') = 'array' AND EXISTS(SELECT 1 FROM json_each(…) WHERE value = ?)))`.
> Because of the `OR` branch, SQLite cannot use the expression indexes Apostrophe creates (for
> example `idx_aposDocs_slug_aposLocale`, `idx_aposDocs_aposDocId_aposLocale`), and every query scans
> `aposDocs`. With about 1,300 docs (about 5 MB of JSON), `EXPLAIN QUERY PLAN` shows `SCAN aposDocs`,
> and a `slug` lookup takes about 15 ms, against 0.15 ms with the index. A page request runs about
> 11 such queries, about 250 ms, on the main thread.
>
> **Expected:** Index use for fields that are never arrays (`_id`, `aposDocId`, `aposLocale`,
> `aposMode`, `slug`, `type`, `level`, `path`, …), as with MongoDB.
>
> **Measured with a local patch** that skips the array branch for those fields: page requests about
> 3.5 times faster (about 200 ms → 55 ms), and throughput about 3 times higher under load.
>
> **Possible approaches:** skip the array branch for known scalar core fields; or emit
> `json_extract(…) = ? OR rowid IN (SELECT … json_each …)`, or a `UNION`, so the scalar part can use
> the index; or record per field whether arrays occur.

## 5a. How to run it again

From the repository root, with Docker running. The test password lives outside the repository.

```sh
export ASSURER_ADMIN_PASSWORD=...   # any test value, first start only
C="-f docker/litestream-poc/compose.yaml -f docker/litestream-poc/compose.load-test.yaml -p assurer-load-test"
docker compose $C up -d --no-build site            # http://localhost:3045
docker exec -e LOAD_TEST_PASSWORD="$ASSURER_ADMIN_PASSWORD" assurer-load-test-site-1 node load-test/load-test.mjs seed
docker exec -e LOAD_TEST_PASSWORD="$ASSURER_ADMIN_PASSWORD" assurer-load-test-site-1 node load-test/load-test.mjs run --readers=8
docker compose $C down -v                          # removes this test's volumes for good; needs ASSURER_ADMIN_PASSWORD set (any value)
```

On Git Bash for Windows, prefix `docker exec` with `MSYS_NO_PATHCONV=1`. Build the image first if it
is missing (`docker compose -f docker/litestream-poc/compose.yaml build site`).

## 6. Limits of this test

- **Synthetic content.** Pages carry rich text and one image widget, not the full widget mix (hero,
  slideshow, product lists) of real pages, so render time is probably lower than on the real site.
- **One machine, Docker Desktop on Windows.** The load client ran inside the same container as the
  app (separate process, shared CPUs). A Hetzner server's CPU will differ.
- **Event-loop delay** uses a 10 ms resolution (as in m1-048), so values near 10 ms mean idle.
- **The CPU profiles and statement counts** were taken with the inspector open. Every load run was
  taken with it closed (the unpatched runs before the first profile, the patched runs after the
  container restart and before the next profile).
- **The adapter patch** was a measurement only. It was checked by the smoke suite, not by the full
  suites, and not reviewed upstream.
- **Not run:** `arm64`, MongoDB for comparison, a page cache, S3.

## 7. Owner's decisions on the results (2026-11-08)

| Question | Owner's answer | Recorded as |
|---|---|---|
| Next step after the failed run | "Measure a fix, then decide (Recommended)" | §3.3 |
| What D-DB-13 says now | "Keep SQLite, fix first (Recommended)": B stays. Before staging: the adapter fix (upstream issue §5, plus a project patch if upstream is slow), a lighter menu query, and a retest at the agreed size and limit. A page cache or a change to the profile is looked at after that retest | D-DB-13 note |
| Clean-up | "Remove all": container and the four `assurer-load-test_*` volumes removed; images kept | m1-050 report |
