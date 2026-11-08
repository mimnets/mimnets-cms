# m1-051 — Back to MongoDB (D-DB-13 reversed) and a load test against it

| | |
|---|---|
| **Task** | m1-051 |
| **Date** | 2026-11-08 |
| **Scope** | Planned: propose how to carry the db-connect SQLite adapter fix. Changed in session by the owner: reverse D-DB-13 to MongoDB Community Edition 8.0 in one container with the app, record it, and run the m1-050 load test against MongoDB |
| **Prompt** | [2026-11-08-m1-051-mongodb-reversal.prompt.md](../../../prompts/2026/11/2026-11-08-m1-051-mongodb-reversal.prompt.md) |
| **Handoff** | [m1-051 start handoff](../../../../milestones/m1-051-handoff.md) · next: [m1-052 handoff](../../../../milestones/m1-052-handoff.md) |
| **Branch / commit** | `fix/m1-051-mongodb-reversal` from `origin/main` `f81cedb` (the handoff's `fix/m1-051-sqlite-index-use` name no longer fits). Commit and push approved by the owner (D-GIT-49) |
| **Related** | D-GIT-48 · D-GIT-49 (new) · D-DB-8 · D-DB-10 · D-DB-12 · D-DB-13 · D-SEC-5 · D-SEC-6 · [results](../../../../milestones/m1-051-mongodb-load-test-results.md) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Precondition: PR #53 is merged (`f81cedb` on `origin/main`). The five hosted CI checks (lint, test,
  build, audit, secrets) are `success` on `f81cedb`, read through the public GitHub API.
- Engine change (architecture gate): the owner, in session, "Yes, MongoDB (Rec.)" (prompt record,
  item 3).
- Image and test run: the owner, in session, "Approve (Rec.)" for building `assurer-site:load-test-mongo`
  from the unchanged root `Dockerfile` and running the disposable test. Base images were already on
  this PC and pinned; `npm ci` used the existing lockfile. No new dependency, tool or package.
  Nothing was pushed. The demo container `assurer-site-1` and its image were not touched.

## Changes

| File | Change |
|---|---|
| `docker/mongodb-load-test/compose.yaml` | New. Disposable Compose project: the root image under its own tag and volumes on `127.0.0.1:3047`, with the m1-050 scripts mounted read-only and the loop probe in `NODE_OPTIONS` |
| `scripts/load-test.mjs`, `scripts/load-test-loop-delay.mjs` | Header comments name the new Compose file. No code change |
| `docs/milestones/m1-051-mongodb-load-test-results.md` | New. Results, comparison with m1-050, query plans, options |
| `docs/engineering/decision-register.md` | Notes on D-DB-8, D-DB-10, D-DB-12, D-DB-13, D-SEC-5, D-SEC-6; header |
| Records | This report, the prompt, INDEX, m1-052 handoff |

## Findings

Details are in the [results page](../../../../milestones/m1-051-mongodb-load-test-results.md).

1. **Every m1-050 lookup uses an index on MongoDB** (≤ 1 ms each, 1,325 docs). The SQLite adapter
   problem does not exist here; no adapter fix is carried.
2. **Agreed profile, 8 readers: HTTP p99 568 ms, event-loop p99 72.7 ms and 0 errors pass; saves
   fail**: 46 of 59 (78%), and 53 of 59 (89.8%) in a repeat, against ≥ 90%. At 4, 2 and 1 readers
   everything passes.
3. **The remaining limit is the single Node process** (about one full core in `top`; `mongod` about
   25% of a core). Apostrophe's own cluster mode (`APOS_CLUSTER_PROCESSES`) is the smallest next
   step; not measured, needs approval.
4. **Correction made in session:** the agent first said the suites had never run against MongoDB.
   They had: m1-043 and m1-046 passed smoke, workflow and persistence on MongoDB 8.0.34. The register
   note was corrected before this report.

## Tests executed and actual results

| Check | Where | Result |
|---|---|---|
| `npm run lint` | host | **PASS**, exit 0 |
| `npm run test:smoke` | local dev server (SQLite default) | **PASS**, 18/18 |
| `npm run test:workflow` | local dev server | **PASS**, 15/15 |
| `npm run test:persistence` | local dev server | **PASS**, 7/7 |
| `npm run test:unit` | host | **PASS**, 105/105 |
| Smoke, workflow against MongoDB | test container `:3047`, 3x data | **PASS**, 18/18 and 15/15 |
| Persistence against MongoDB after `docker restart` | test container | **PASS**, 7/7 |
| Load test (§2 of the results) | test container | Saves limit **FAIL** at 8 readers; all limits **PASS** at 4, 2, 1 |

## Browser checks (agent-executed, Claude in Chrome)

The task adds no user interface, so this is the short public-site check.

| Check | Steps | Result |
|---|---|---|
| MongoDB load-test copy, logged out | Open `http://localhost:3047/48` (a seeded level-3 page), read the page, read console errors | **PASS**: title "Load test page 6.5.2 (v10)", menu with the six seeded sections and their children; no admin bar; no console errors |
| Development site, logged out | Open `http://localhost:3000/`, read the page, read console errors | **PASS**: home page with hero, slideshow and product cards, "Log in" link; no console errors |
| Screenshots | `screenshot` on the tab, twice | **BLOCKED**: the extension's capture timed out both times ("renderer may be frozen"); the page itself answered `read_page`. Not retried further |
| Tablet and mobile layouts | — | **NOT TESTED**: no template or layout change |

Sanitized JSON results are under `evidence/m1-051/` (git-ignored). No screenshots were saved.

## Not done or not verified

- The upstream db-connect issue URL: the owner says it is filed; the URL did not come through and is
  not recorded.
- Cluster mode, the lighter menu query, a page cache, `arm64`, PBM and its S3 tests.
- The ADR-0002 amendment (or a new ADR) for the engine history; the runbooks that describe SQLite and
  Litestream for staging (m1-047 to m1-050) now need superseded notes.
- The m1-049 dump task stays in the code; it is harmless on MongoDB (Apostrophe's own dump works
  there) and useful for local SQLite. Whether to keep it is for a later task.

## Clean-up

The owner asked, after the push: "please clean all image and container and stop dev server", and
then chose "Everything" when the agent listed what that would remove. Done on 2026-11-08:

- The m1-051 test container `assurer-load-test-mongo-site-1`, its four volumes and the image
  `assurer-site:load-test-mongo`.
- The demo container `assurer-site-1` (m1-043), its four `assurer_*` volumes and its anonymous
  volume. Its data is deleted for good.
- Every other image on the PC: `assurer-site:local` and `-arm64`, the four `pbm-poc` images, the
  two `litestream-poc` images, `node:24-bookworm`, `mongo:8.0.34` and `hello-world`.
- Result: no containers, images or volumes left. Docker's build cache was not pruned.
- The test password in the session's scratch directory is deleted. The local development server is
  stopped.

The next Docker task rebuilds from scratch and downloads the pinned base images again.
