# m1-054 results — Apostrophe cluster mode on the MongoDB load test

| | |
|---|---|
| **Date** | 2026-11-08 |
| **Task** | m1-054 (agent-executed; not a human approval) |
| **Decision** | D-DB-8, ADR-0004 (unchanged). Follows [m1-051 results](./m1-051-mongodb-load-test-results.md) §3, options G and C |
| **Setup** | [`docker/mongodb-load-test/compose.yaml`](../../docker/mongodb-load-test/compose.yaml) with the new `APOS_CLUSTER_PROCESSES` setting (empty = one process). The unchanged root `Dockerfile` (app and MongoDB 8.0.34 in one container), built from `origin/main` `bb76ac0`, which includes the m1-053 menu projection. Same script, seed, size, profile and limits as m1-050 and m1-051 |
| **Machine** | The owner's PC, Docker Desktop on Windows, 16 CPUs and 7.6 GiB memory visible to Docker, `amd64` |

## 1. Summary

- **Every run passed every limit**, including one Node process at 8 readers, which failed on saves
  in m1-051.
- **One process, 8 readers (agreed profile): passes.** Saves 59/59 and 58/59 in the window, HTTP
  p99 354 / 350 ms, loop p99 43 ms. m1-051 (before the m1-053 menu projection) had 46/59 and 53/59.
  Throughput rose from 1,391–1,772 to 2,162–2,262 requests in 60 s. This is consistent with the
  m1-053 change, but it is not a controlled A/B: m1-051 ran on another image build and Docker start,
  and the old query was not run in this session.
- **Cluster mode, 2 workers, 8 readers: passes with margin.** 2,751 and 3,135 requests, HTTP p99
  306 / 268 ms, saves 59/59 with median 594–662 ms (one process: 860–875 ms). Container CPU about
  310% (one process: about 150%); memory 1.7 GiB (one process: 1.1 GiB).
- **4 workers add little at this profile**: 3,247 requests (+4–18% on 2 workers) for about 600% CPU
  and 2.6 GiB. The load client runs in the same container and takes CPU too.
- **Cluster mode works with the site's features as tested**: smoke, workflow and persistence
  suites pass on 2 workers, and an editor's session, draft, publish and logged-out isolation held
  across repeated requests (§4).

## 2. Results

60 s each; the m1-050 seed (101 published pages); readers fetch every published page logged out,
round robin; one draft save a second as the admin. Loop delay is the worst of the web processes
(each worker in cluster mode). CPU is the container's average of 8 `docker stats` samples from the
host during the run (100% = one core); memory is the last sample.

| Run | Processes | Requests | Errors | HTTP p50 / p99 | Loop p50 / p99 / max | Saves in window | Save p50 / p90 / max | CPU | Memory | Pass |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 readers | 1 | 2,162 | 0 | 216 / 354 ms | 18.4 / 42.9 / 58 ms | 59 / 59 | 860 / 1,031 / 1,185 ms | 152% | 1.12 GiB | **Yes** |
| 8 readers, repeat | 1 | 2,262 | 0 | 204 / 350 ms | 18.1 / 42.6 / 60 ms | 58 / 59 (59 ok) | 875 / 1,077 / 1,124 ms | 152% | 1.12 GiB | **Yes** |
| **8 readers** | **2 workers** | 2,751 | 0 | 168 / 306 ms | 15.9 / 43.1 / 84 ms | 59 / 59 | 662 / 807 / 979 ms | 308% | 1.66 GiB | **Yes** |
| **8 readers, repeat** | **2 workers** | 3,135 | 0 | 148 / 268 ms | 15.5 / 39.8 / 105 ms | 59 / 59 | 594 / 724 / 866 ms | 312% | 1.69 GiB | **Yes** |
| 4 readers | 2 workers | 2,936 | 0 | 78 / 154 ms | 12.2 / 29.4 / 67 ms | 59 / 59 | 315 / 397 / 466 ms | 279% | 1.70 GiB | **Yes** |
| 8 readers | 4 workers | 3,247 | 0 | 141 / 295 ms | 14.1 / 47.5 / 716 ms | 59 / 59 | 511 / 716 / 886 ms | 595% | 2.61 GiB | **Yes** |

Per-worker loop p99 was even: 43.1 / 41.6 ms and 38.5 / 39.8 ms on 2 workers; 46.7 / 45.7 / 42.0 /
47.5 ms on 4. The 716 ms maximum in the 4-worker run was one sample in one worker; its p99 was
45.7 ms. That run started about 30 s after the workers did, so it is probably warm-up (not checked).

Single requests with no load (p50 of 5, home / product category / level-4 page / 404): one process
22–52 / 28–46 / 33 / 33–45 ms; 2 workers 37–82 / 38–102 / 27–59 / 30–57 ms. m1-051 had 70 / 64 /
47 / 47 ms. These are 5 requests each and vary between runs.

### 2.1 Compared with m1-051 (MongoDB, before the m1-053 menu projection)

| 8 readers, 3x size | m1-051, 1 process | m1-054, 1 process | m1-054, 2 workers |
|---|---|---|---|
| Requests in 60 s | 1,391 · 1,772 | 2,162 · 2,262 | 2,751 · 3,135 |
| HTTP p99 | 568 · 428 ms | 354 · 350 ms | 306 · 268 ms |
| Event-loop p99 | 72.7 · 56.9 ms | 42.9 · 42.6 ms | 43.1 · 39.8 ms |
| Saves in window | 46 / 59 · 53 / 59 | 59 / 59 · 58 / 59 | 59 / 59 · 59 / 59 |
| Save p50 | 6.2 s (first run) | 860 · 875 ms | 662 · 594 ms |

## 3. What this means for staging

- The single-process limit from m1-051 no longer blocks the agreed profile. Cluster mode is still
  worth having in staging: it doubles the headroom for about 0.6 GiB more memory, and a worker that
  crashes is restarted by the primary while the other keeps serving.
- **Agent's suggestion, for the staging image task:** `APOS_CLUSTER_PROCESSES=2`, sized against the
  server's memory with MongoDB's cache (D-DB-10 (b)). More workers only help with more cores than
  this profile uses. Not a decision; the owner decides with the staging image.
- Things to know about cluster mode (Apostrophe 4.34.0, `node_modules/apostrophe/index.js`): it
  needs `NODE_ENV=production` (the image sets it); tasks such as migrations never cluster; the
  primary restarts a worker that exits with an error, waiting first if it failed within its first
  seconds; the entrypoint watches the primary, so the container still stops when the primary does.

## 4. Checks on the cluster container

With the 3x data in place and `APOS_CLUSTER_PROCESSES=2`:

| Check | Result |
|---|---|
| Process layout | `node app` (primary) with two `node /app/app` children; the load test found and measured both |
| `npm run test:smoke` against `:3047` | **PASS**, 18/18 |
| `npm run test:workflow` against `:3047` | **PASS**, 15/15 |
| `npm run test:persistence` after `docker restart` | **PASS**, 7/7 |
| Editor in Chrome (disposable `editor` account) | **PASS**, see the m1-054 report |

## 5. Limits of this test

- The same limits as m1-050 §6 and m1-051 §4: synthetic content, one Windows PC under Docker
  Desktop, the load client in the same container as the app and MongoDB, 10 ms loop resolution.
- The m1-053 effect is inferred across sessions, not measured A/B (§1).
- CPU figures come from `docker stats` samples, 3 s apart, for the whole container.
- **Not run:** `arm64`, 3 workers, a page cache, PBM during load, a worker crash during load.

## 6. How to run it again

As in [m1-051 results](./m1-051-mongodb-load-test-results.md) §5, with
`export APOS_CLUSTER_PROCESSES=2` before `docker compose … up -d site`. Changing it later recreates
the container and keeps the volumes. Leave it unset or empty for one process.
