# m1-048 — Local proof of concept for SQLite with Litestream

| | |
|---|---|
| **Task** | m1-048 |
| **Date** | 2026-11-07 |
| **Scope** | Checks P1–P7 from the [m1-047 options paper §7](../../../../milestones/m1-047-sqlite-production-options.md#7-proposed-proof-of-concept-needs-separate-approval), with the settings checks of §4.5, local and disposable, in a new test image (`docker/litestream-poc/`). Replicas to a local directory only. No account, spending or server |
| **Prompt** | [2026-11-07-m1-048-litestream-poc.prompt.md](../../../prompts/2026/11/2026-11-07-m1-048-litestream-poc.prompt.md) |
| **Handoff** | [m1-048 start handoff](../../../../milestones/m1-048-handoff.md) · next: [m1-049 handoff](../../../../milestones/m1-049-handoff.md) |
| **Branch / commit** | `test/m1-048-litestream-poc` from `origin/main` `f336e7b`. Commit and push need the owner's approval (D-GIT-46) |
| **Related** | D-DB-4 · D-DB-13 · D-SEC-5 · D-SEC-6 (new) · D-GIT-45 · D-GIT-46 (new) · [results](../../../../milestones/m1-048-litestream-poc-results.md) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Litestream v0.5.18, pinned, for this local proof of concept only; Docker Compose; `arm64` under
  emulation: owner, in session (prompt record, item 1).
- Precondition: PR #50 is merged (`f336e7b` on `origin/main`); the five hosted CI checks are `success`
  on `f336e7b`, read through the public GitHub API (`gh` is not installed).
- Before installing, the agent checked: v0.5.18 (published 2026-11-03T17:27Z, not a pre-release) is the
  latest release; the license is Apache-2.0 (GitHub API); GitHub lists no security advisory for the
  repository. The release tarballs are pinned by the SHA-256 values in the release's `checksums.txt`.
- Clean-up: "Remove all PoC (Recommended)" (prompt record, item 2).
- No package, lockfile, `.env`, root `Dockerfile`, root `compose.yaml`, `docker/entrypoint.sh`, app
  code or production system was changed. `assurer-site-1` and its volumes were not touched. The local
  development database was not used: the test seeded its own demo content.

## Decisions recorded

| ID | Decision | Owner's answer (2026-11-07) | Agent suggestion followed? |
|---|---|---|---|
| D-SEC-6 | Three high denial-of-service findings in Litestream 0.5.18's Go libraries | **Accept until a fix** | Yes |
| D-DB-13 | SQLite with Litestream after the proof of concept | **Keep, with two conditions before staging**: the dump problem fixed; a load test at the real site's size with an agreed p99 limit | Yes |
| D-DB-13 | Handling of the `apos-db-dump` failure | **Upstream report and a project dump task** | Yes |
| — | Clean-up | Remove all test containers and volumes; images kept | Yes |

## Findings

Details are in the [results page](../../../../milestones/m1-048-litestream-poc-results.md).

- **Replication and restore work.** Lag median 0.47 s (max 1.49 s, 20 saves). `kill -9` of the app or
  of Litestream during a write burst: no gap, and the latest replica matches the live file in all
  14 tables. A point-in-time restore into a new, empty container returned the right moment on `amd64`
  and on emulated `arm64`, and all suites passed on the restored site.
- **`apos-db-dump` fails on a replicated database** (`no such column: _litestream_seq._id`, exit 1),
  after writing all of Apostrophe's collections. D-DB-4's portable dumps need a fix (m1-049).
- **Page requests slow down with about 1,000 pages**: about 0.5 s each instead of 0.03–0.07 s; under
  8 parallel readers, event-loop delay p99 1.5 s. The SQLite adapter's queries cannot use an index, and
  the two-level menu loads every page in its two levels. Pausing Litestream changed nothing.
- **Three high findings** in Litestream's Go libraries, the same CVEs as D-SEC-5 (D-SEC-6). The Go
  standard library 1.23.12 findings in the image come from esbuild (via `@apostrophecms/vite`), which is
  also in the demo image; m1-046 had put them down to MongoDB's tools.
- **Media is not replicated**; the restored site had broken images, as expected.
- **The form rate-limit counters travel with a restore**; `assurer-security:clear-form-rate-limit`
  clears them, `sanitize-after-restore` does not.
- **In one container, a Litestream crash restarts the app** (about 3–4 s offline) with this supervisor.
- **No SQLite setting needed changing** at this write rate: Litestream missed no frames with the
  default `wal_autocheckpoint`. The WAL file stays at its largest size (16 MB after 500 saves).

## Work completed

| Item | Result |
|---|---|
| Test files | New `docker/litestream-poc/`: `Dockerfile` (Litestream 0.5.18 pinned by SHA-256 for `amd64` and `arm64`, on the same pinned Node base as the root Dockerfile), `compose.yaml` (site and restore container, both platforms), `entrypoint.sh` (supervises the app and Litestream, restore mode), `litestream.yml` |
| Results page | New `docs/milestones/m1-048-litestream-poc-results.md` |
| Register | D-SEC-6 and D-GIT-46 new; D-DB-13 note; D-GIT-45 marked merged |
| Index | Task row, next free ID |
| Records | This report, the prompt record and the m1-049 handoff |

## Files changed

- A `docker/litestream-poc/Dockerfile`
- A `docker/litestream-poc/compose.yaml`
- A `docker/litestream-poc/entrypoint.sh`
- A `docker/litestream-poc/litestream.yml`
- A `docs/engineering/prompts/2026/11/2026-11-07-m1-048-litestream-poc.prompt.md`
- A `docs/engineering/reports/2026/11/2026-11-07-m1-048-litestream-poc.report.md`
- A `docs/milestones/m1-048-litestream-poc-results.md`
- A `docs/milestones/m1-049-handoff.md`
- M `docs/engineering/INDEX.md`
- M `docs/engineering/decision-register.md`

## Tests executed and actual results

Suites against the PoC sites ran from the host with `BASE_URL`, `APOS_TEST_USER` and
`APOS_TEST_PASSWORD` set for the process only. The test password was generated into the session's
scratch directory, outside the repository, and is not recorded here. Helper scripts for the
measurements (lag, burst, load, profile, table comparison) also lived there and are not part of the
repository.

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Lint | `npm run lint` | No errors | PASS |
| Smoke / workflow / persistence, source PoC site (`amd64`) | `BASE_URL=http://localhost:3045` | 18/18, 15/15, 7/7 | PASS |
| Smoke / workflow / persistence, restored site (`amd64`) | `BASE_URL=http://localhost:3046`; persistence after a container restart | Smoke 17/18, then 13/18 (form rate limit, HTTP 429), 18/18 after clearing the counters; workflow 15/15; persistence 7/7 | PASS (see results §3.5) |
| Smoke, source and restored site (`arm64`, emulated) | as above | 18/18; restored 13/18 (429), then 18/18 after clearing | PASS |
| Smoke / workflow / persistence, local development server | `http://localhost:3000`, `.env` credentials, after the PoC; persistence without a restart | 18/18, 15/15, 7/7 | PASS |
| P1–P7 | See the [results page §2](../../../../milestones/m1-048-litestream-poc-results.md#2-results) | P1–P5 PASS (P4 with the dump finding); P6 recorded, finding; P7 PASS under emulation | — |
| S3, SSE-C, object lock, retention for 7-day PITR | — | Not run; out of scope | NOT TESTED |
| Real ARM hardware | — | Emulation only | NOT TESTED |
| Docker Scout | `docker scout cves` on both test images | Litestream adds 3 high (D-SEC-6); the rest come from the base image and esbuild | Finding |

### Browser acceptance

Claude in Chrome, owner's Chrome, dedicated tab group; logged out; 1440 px; agent-executed. No
screenshots were kept.

| # | Check | Role / viewport | Steps | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Restored site renders | logged out, 1440 px | `http://localhost:3046/`, then the "M0 Test Page" menu link | demo home page, no admin bar | Home page with demo notice, hero and "Log in" button; the slide image is broken because media is not replicated (results §3.4); the menu link opened the test page with its breadcrumb | PASS | none |
| 2 | Source site renders | logged out, 1440 px | `http://localhost:3045/` | demo home page | Home page; the menu shows the 20 test sections from P6 | PASS | none |
| 3 | Editor flows, 768/375 layouts | — | — | — | No template, layout or content change | NOT TESTED (not applicable) | — |

## Security observations

- Litestream runs as the same unprivileged user as the app in this test image. In a staging setup
  with S3, the storage credentials and SSE-C key would be readable by the app's user unless Litestream
  runs as its own user (as PBM did in m1-046). Not designed yet.
- The replica holds the whole database, including sessions and bearer tokens, so it is a secret like
  any backup (AGENTS.md).
- The app's inspector was opened inside the disposable container (`SIGUSR1`, listening on
  `127.0.0.1` in the container, not published) for the P6 measurements. The container was removed.

## Unresolved decisions

- D-DB-13 conditions: the dump fix (m1-049) and the load test with an agreed p99 limit and page count.
- How the app should cope with page count: a shallower menu, page caching, or adapter changes upstream.
- The ADR for D-DB-13, and the superseded runbook notes.
- Litestream retention for the 7-day PITR, S3 tests, and how Litestream gets its credentials.
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO's answer to I1.
- D-GIT-46: commit and push of this branch.

## Rollback guidance

Revert the commit. The test files are separate from the demo image, so the demo image and
`assurer-site-1` are not affected.

## Cleanup

- Removed with `docker compose ... --profile restore down -v`: the containers, networks and 16 named
  volumes of the projects `assurer-litestream-poc` and `assurer-litestream-poc-arm64`, including all
  replicas, the disposable `pocEditor` account and the test content (markers, burst pieces and the
  1,000 test pages). No dangling volume was left.
- Kept: the images `assurer-site:litestream-poc` and `assurer-site:litestream-poc-arm64` (local only,
  no secrets).
- Still running and untouched: `assurer-site-1` on `http://localhost:3042`, and the local development
  server on `http://localhost:3000` (used only for the final suites).
