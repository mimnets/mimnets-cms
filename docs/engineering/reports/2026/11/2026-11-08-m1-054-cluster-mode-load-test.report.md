# m1-054 — Cluster mode on the MongoDB load test

| | |
|---|---|
| **Task** | m1-054 |
| **Date** | 2026-11-08 |
| **Scope** | Candidate 1 of the handoff: Apostrophe's cluster mode (`APOS_CLUSTER_PROCESSES`) on the MongoDB load test, and the m1-053 menu change on MongoDB |
| **Prompt** | [2026-11-08-m1-054-cluster-mode-load-test.prompt.md](../../../prompts/2026/11/2026-11-08-m1-054-cluster-mode-load-test.prompt.md) |
| **Handoff** | [m1-054 start handoff](../../../../milestones/m1-054-handoff.md) · next: [m1-055 handoff](../../../../milestones/m1-055-handoff.md) |
| **Branch / commit** | `perf/m1-054-cluster-mode-load-test` from `origin/main` `bb76ac0`. Commit and push approved by the owner (D-GIT-52) |
| **Results** | [m1-054 cluster mode results](../../../../milestones/m1-054-cluster-mode-results.md) |
| **Related** | [m1-051 results](../../../../milestones/m1-051-mongodb-load-test-results.md) §3 options G and C · m1-053 · D-DB-8 · ADR-0004 · D-GIT-52 (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Task choice: the agent's recommendation, candidate 1 ("go with your recommendation").
  Precondition: PR #56 merged (`bb76ac0`); the hosted CI workflow on `bb76ac0` is
  `completed success`, read through the public GitHub API (`gh` is not installed on this PC).
- Owner's "approve" for: cluster mode in the disposable load-test compose only; building
  `assurer-site:load-test-mongo` from the unchanged root Dockerfile (same digest-pinned base images,
  pulled again because Docker was empty); the runs, including the optional 4-worker run; the suites
  and a Chrome check on the cluster container; `docker compose … down -v` afterwards.
- No package, tool or new image. No dependency change. No change to the site image, the entrypoint
  or the demo compose.

## Change

| File | Change |
|---|---|
| `scripts/load-test-loop-delay.mjs` | Each web process writes its own `/tmp/loop-delay-<pid>.json`, so the primary and every worker can be read |
| `scripts/load-test.mjs` | `appPids()` finds `node app`; if it has child processes (a cluster primary), the workers are measured, otherwise `node app` itself. `loopDelay()` signals each and reports the worst p50/p90/p99/max, with per-worker figures when there is more than one. Pass limits unchanged |
| `docker/mongodb-load-test/compose.yaml` | `APOS_CLUSTER_PROCESSES: ${APOS_CLUSTER_PROCESSES:-}` (empty = one process, as in m1-051) |
| `docs/milestones/m1-054-cluster-mode-results.md` | New: results |

Core facts used (Apostrophe 4.34.0, `node_modules/apostrophe/index.js`): the variable sets
`cluster: { processes: n }`; cluster mode is turned off unless `NODE_ENV=production` (the image sets
it); tasks never cluster (`!argv._.length`); workers are forked with the same arguments, so their
command line is `node /app/app` and the probe's web-process test matches them.

## Findings

Full tables in the results document.

1. **One process now passes the agreed profile** (8 readers): saves 59/59 and 58/59, HTTP p99
   354 / 350 ms, loop p99 43 ms; m1-051 had 46/59 and 53/59. Consistent with the m1-053 menu
   projection, but not a controlled A/B (other image build and Docker start; the old query was not
   run here).
2. **2 workers pass with margin**: 2,751 / 3,135 requests (one process 2,162 / 2,262), HTTP p99
   306 / 268 ms, save p50 594–662 ms, about 310% CPU and 1.7 GiB for the container.
3. **4 workers add little** at this profile: 3,247 requests for about 600% CPU and 2.6 GiB.
4. **Agent's suggestion** for the staging image task: `APOS_CLUSTER_PROCESSES=2`, sized against
   the server's memory with MongoDB's cache. The owner decides with that task.

## Tests executed and actual results

| Check | Where | Result |
|---|---|---|
| `npm run lint` | host | **PASS**, exit 0 |
| `npm run test:unit` | host | **PASS**, 101/101 |
| `npm run test:smoke` | local server (SQLite, `.env`) | **PASS**, 18/18 |
| `npm run test:workflow` | local server | **PASS**, 15/15 |
| `npm run test:persistence` | local server | **PASS**, 7/7 |
| Load runs (6) | test container `:3047`, 3x data | **PASS** all limits, every run |
| `npm run test:smoke` | test container, 2 workers | **PASS**, 18/18 |
| `npm run test:workflow` | test container, 2 workers | **PASS**, 15/15 |
| `npm run test:persistence` after `docker restart` | test container, 2 workers | **PASS**, 7/7 |

`npm run test:ci` was not run; the change touches only the load-test scripts and their compose,
which CI does not use.

## Browser checks (agent-executed, Claude in Chrome)

Test container `localhost:3047`, `APOS_CLUSTER_PROCESSES=2`, 3x data. Disposable editor
`m1054-editor` (role `editor`, created with `@apostrophecms/user:add` inside the container; password
in a scratch file outside the repository). Page: "Load test deep page 1" (`/956`), seeded test data.

| Check | Steps | Result |
|---|---|---|
| Editor login | Login form | **PASS**: admin bar with `m1054-editor`; seeded menu rendered |
| Draft save | Pages manager, row menu, Edit; title + " (m1-054 editor)"; Save Draft | **PASS**: "Draft saved" |
| Session across workers | Reloaded the page in draft mode 4 times | **PASS**: admin bar with `m1054-editor` and the draft title every time; no console errors |
| Draft not public | 4 logged-out requests, with and without `?aposMode=draft` | **PASS**: published title only; no admin bar or user name |
| Published change public | Edit mode, Update (publish); 4 logged-out requests | **PASS**: "Your changes have been published"; new title on all 4 |
| Layout 1440/768/375 | — | **NOT TESTED**: no template or style change |

No screenshots were saved.

## Clean-up

`docker compose -f docker/mongodb-load-test/compose.yaml down -v` removed the container, network and
the four test volumes, with the disposable editor and all test content in them (approved). The local
server started for the suites was stopped. **Left over:** the image `assurer-site:load-test-mongo`
and the pulled base images in Docker on the owner's PC; the test passwords in the session scratch
directory outside the repository.

## Not done or not verified

- A controlled A/B of the m1-053 change on MongoDB (old query in the same session).
- `arm64`, 3 workers, a worker crash during load, PBM during load, a page cache.
- The staging image with PBM, the hardening runbook §6 and §7 rewrite, the PBM S3 tests.
- The upstream db-connect issue URL (m1-050 results §5, D-DB-13).
