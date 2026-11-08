# m1-051 results — load test of MongoDB in one container at the expected site size

| | |
|---|---|
| **Date** | 2026-11-08 |
| **Task** | m1-051 (agent-executed; not a human approval) |
| **Decision** | D-DB-8, back in force after the owner reversed D-DB-13 in this task |
| **Setup** | [`docker/mongodb-load-test/compose.yaml`](../../docker/mongodb-load-test/compose.yaml): the unchanged root `Dockerfile` (app and MongoDB 8.0.34 in one container), image `assurer-site:load-test-mongo`, its own volumes, `127.0.0.1:3047`. Same script, size, profile and limit as [m1-050](./m1-050-load-test-results.md) |
| **Machine** | The owner's PC, Docker Desktop on Windows, 16 CPUs visible to the container, `amd64` |

## 1. Summary

- **On MongoDB, every lookup uses an index**, at ≤ 1 ms; on SQLite the same lookups scanned
  `aposDocs` at 14–15 ms each (m1-050 §3.2). The adapter fix is not needed on MongoDB.
- **At the agreed profile (8 readers), HTTP p99, event-loop p99 and errors pass; saves fail
  narrowly**: 46 of 59 (78%) in the first run and 53 of 59 (89.8%) in a repeat, against ≥ 90%.
- **At 4, 2 and 1 readers, everything passes**, with all 59 saves.
- **What is left is the single Node process.** During an 8-reader run, `node app` used about one
  full core (110–115% in `top`, its main thread plus helper threads) and `mongod` about 25% of a
  core. Saves wait behind reader requests on that one process: at 8 readers the median save took
  6.2 s, with event-loop delay still low (p99 73 ms).

## 2. Results

60 s each; the same seed as m1-050 (101 published pages, 1,325 docs in `aposDocs`); readers fetch
every published page logged out, round robin; one draft save a second as the admin.

| Run | Requests | Errors | HTTP p50 / p99 | Loop delay p50 / p99 / max | Saves in window | Pass |
|---|---|---|---|---|---|---|
| Demo content only, 8 readers | 3,992 | 0 | 105 / 269 ms | 13.6 / 54.3 / 209 ms | 59 / 59 | **Yes** |
| **3x size, 8 readers (agreed)** | 1,391 | 0 | 334 / **568** ms | 27.4 / **72.7** / 100 ms | **46 / 59** | **No** (saves) |
| 3x size, 8 readers, repeat (with `top` sampling) | 1,772 | 0 | 273 / 428 ms | – / 56.9 / – ms | 53 / 59 | No (saves, by one) |
| 3x size, 4 readers | 1,777 | 0 | 132 / 224 ms | 15.3 / 35.8 / 60 ms | 59 / 59 | **Yes** |
| 3x size, 2 readers | 1,793 | 0 | 64 / 113 ms | 11.9 / 24.8 / 55 ms | 59 / 59 | **Yes** |
| 3x size, 1 reader | 1,533 | 0 | 38 / 61 ms | 11.3 / 22.8 / 32 ms | 59 / 59 | **Yes** |

Save times at 8 readers (first run): p50 6.2 s, p90 18.0 s, max 29.2 s; all 59 completed, 13 after
the 60 s window. At 4 readers: p50 573 ms, max 842 ms.

Single requests with no load, 3x size (p50 of 5): home 70 ms, product category 64 ms, level-4 page
47 ms, 404 page 47 ms.

### 2.1 Compared with SQLite (m1-050, same size and profile)

| 8 readers, 3x size | SQLite, adapter as released | SQLite, measurement patch | **MongoDB 8.0** |
|---|---|---|---|
| Requests in 60 s | 368 | 1,125 | **1,391** |
| HTTP p99 | 2,461 ms | 677 ms | **568 ms** |
| Event-loop p99 | 956 ms | 342 ms | **72.7 ms** |
| Saves in window | 12 / 59 | 36 / 59 | **46 / 59** (53 in the repeat) |
| Home page, single request | 196 ms | 55 ms | 70 ms |

On MongoDB, queries run in the `mongod` process and the driver waits for them asynchronously, so the
event loop is free while a query runs; better-sqlite3 runs every query on the event loop itself. That is why the loop limit passes on MongoDB and failed
on SQLite even with fast queries.

### 2.2 Query plans

`explain('executionStats')` on the 3x data, in the container, as the app's database user:

| Lookup | Plan | Docs examined | Time |
|---|---|---|---|
| `slug` + `aposLocale` | `IXSCAN slug_1_aposLocale_1` | 1 | 0 ms |
| `aposDocId` + `aposLocale` | `IXSCAN aposDocId_1_aposLocale_1` | 1 | 0 ms |
| `aposDocId $in` + `aposLocale` | `IXSCAN aposDocId_1_aposLocale_1` | 1 | 0 ms |
| `type` (60 products) | `IXSCAN type_1_aposLocale_1` | 60 | 0 ms |
| Home page's descendants, 2 levels (menu shape) | `IXSCAN level_1_rank_1` | 76 | 1 ms |
| `historicUrls` (404 soft redirect) | `IXSCAN historicUrls_1` | 0 | 0 ms |

## 3. Options for the saves limit

| Option | What it changes | Expected effect | Cost and risk |
|---|---|---|---|
| G. Apostrophe's cluster mode (`APOS_CLUSTER_PROCESSES`, core option, no new package) | 2 or more Node processes behind one port | The one-process limit goes; readers and saves spread over cores. Not measured | Configuration only; more memory per process (about 0.9 GB each at this size); the load test's process lookup and loop probe need small changes for several processes; its own approval |
| C. Lighter menu query (`views/layout.jsx`) | Load only the fields the menu needs | Less Node work per inner page | Small project change; its own approval |
| D. Logged-out page cache at the reverse proxy | Repeat reads of the same page | Readers' cost mostly leaves Node; saves complete | Cache rules and purge to design; image needs approval |
| F. Change the limit or the profile | What "pass" means | 4 constant readers (about 30 requests a second) already pass everything | The owner's decision; m1-050 §3.1 notes the profile is far above expected traffic |

The agent's view: the database is no longer the limit. G is the smallest change that addresses
what is left and uses only Apostrophe's own options; C helps either way. Measure G (and C) before
looking at D or F.

## 4. Limits of this test

- The same limits as m1-050 §6: synthetic content, one Windows PC under Docker Desktop, the load
  client in the same container, 10 ms loop resolution.
- **MongoDB and the app share the container's CPUs**, as on the one-container server (D-DB-10 (b)).
- The repeat run had `top` sampling at the same time, which may have cost it a little.
- **Suites on this container** (after the load runs, with the 3x data in place): smoke 18/18,
  workflow 15/15, and persistence 7/7 after a container restart, all PASS.
- **Not run:** `arm64`, cluster mode, a page cache, PBM.

## 5. How to run it again

From the repository root, with Docker running. The test password lives outside the repository.

```sh
export ASSURER_ADMIN_PASSWORD=...   # any test value, first start only
C="-f docker/mongodb-load-test/compose.yaml"
docker compose $C up -d --build site               # http://localhost:3047
docker exec -e LOAD_TEST_PASSWORD="$ASSURER_ADMIN_PASSWORD" assurer-load-test-mongo-site-1 node load-test/load-test.mjs seed
docker exec -e LOAD_TEST_PASSWORD="$ASSURER_ADMIN_PASSWORD" assurer-load-test-mongo-site-1 node load-test/load-test.mjs run --readers=8
docker compose $C down -v                          # removes this test's volumes for good; needs ASSURER_ADMIN_PASSWORD set (any value)
```

On Git Bash for Windows, prefix `docker exec` with `MSYS_NO_PATHCONV=1`.
