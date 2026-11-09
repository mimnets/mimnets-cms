# m1-057 — Decide the remaining staging findings

| | |
|---|---|
| **Task** | m1-057 |
| **Date** | 2026-11-09 |
| **Scope** | Candidate 2 of the handoff: analyse the 7 site findings and the nginx and certbot findings, record the owner's decision on each, and apply the two image changes chosen. Nothing deployed |
| **Prompt** | [2026-11-09-m1-057-staging-findings.prompt.md](../../../prompts/2026/11/2026-11-09-m1-057-staging-findings.prompt.md) |
| **Handoff** | [m1-057 start handoff](../../../../milestones/m1-057-handoff.md) · next: [m1-058 handoff](../../../../milestones/m1-058-handoff.md) |
| **Branch / commit** | `fix/m1-057-staging-findings` from `origin/main` `062b0fd`. Commit and push approved by the owner (D-GIT-55); merge not included |
| **Related** | D-SEC-8 (decided) · D-SEC-5 (unchanged, one point added) |

All checks below are **agent-executed**. They are not human approval.

## Status

**D-SEC-8 is decided, but the stack is still not ready for a server.** The nginx change is built and
tested. The `apt` change is written but **has not been built**, because a site rebuild needs a restart
and a tested way to stop it. `arm64` and the runbook commands as written are still open.

## Approvals used

| What | Owner's words or choice |
|---|---|
| Task | "Decide findings (Recommended)" |
| `async` (2), `x/net` in MongoDB's tools (1) | "Not affected (Recommended)" |
| `apt` | "Pinned upgrade (Recommended)" |
| nginx | "Remove libxml2, accept musl (Recommended)" |
| certbot (13) | "Accept, rescan (Recommended)" |
| Commit, push and PR; the agent's suggestion that the owner watches a site build | "i approve all" (D-GIT-55) |

## Change

- **`docker/staging/nginx/Dockerfile`:** removes `nginx-module-xslt`, `nginx-module-njs`, `libxslt` and
  `libxml2`, and the build fails if `libxml2` remains.
- **`docker/staging/Dockerfile`:** upgrades `apt` and `libapt-pkg6.0t64` to the pinned
  `2.8.4ubuntu0.1`. If Ubuntu replaces that version, the build fails at that step and the pin must be
  updated. **Not built.**
- **Records:** D-SEC-8 and D-SEC-5, the staging container runbook, INDEX, this report and the handoff.

## Findings and decisions

Docker Scout, critical and high only, `linux/amd64`, 2026-11-09. Reachability comes from reading
sources and package lists. **No exploit was attempted.**

| Finding | Count | Needs | Evidence | Decision |
|---|---|---|---|---|
| `async` 0.9.2 (`oembetter`), 1.5.2 (`uploadfs`), CVE-2021-43138 | 2 | `mapValues()` | Neither version has the function; GitHub's advisory GHSA-fwr7-v2mv-hh25 covers only 2.x and 3.x | **Not affected** |
| `x/net` 0.61.0 in `mongodump`, `bsondump`, CVE-2026-78661 | 1 | Crafted HTML, in `x/net/html` | Not in `mongo-tools`' `vendor/modules.txt`; project code does not call the tools | **Not affected** |
| `go-jose`, `compress`, `x/net` in PBM 2.17.0 | 3 | See D-SEC-5 | `v2.17.0` is still the latest. `x/net/html` is not in its vendor list. `go-jose` and `compress` paths not re-examined | **Accepted until a fix** (D-SEC-5, unchanged) |
| `apt` 2.8.3, CVE-2026-109518 | 1 | An `apt` install with an on-path attacker; can lead to root code execution | No project script runs `apt`. Ubuntu published 2.8.4ubuntu0.1 for noble | **Pinned upgrade**, not built |
| nginx `libxml2` 2.13.9-r2, CVE-2026-86140 | 1 | Reached through the XSLT and njs modules | No `load_module` line; the `nginx` binary does not link it; no fix listed | **Removed**; gone in the rescan |
| nginx `musl` 1.2.6-r3, CVE-2026-107891 | 1 | An untrusted regular expression passed to `regcomp` | Project config regexes are not user input. Agent's expectation that nginx uses PCRE2 was **not confirmed**. Alpine does not yet offer 1.2.6-r6 | **Accepted until Alpine offers the fix** |
| certbot `urllib3` 2.7.0 (2), `msgpack` 1.1.2 (3) | 5 | Only if `pip` runs | Certbot imports `urllib3` 2.8.0, which is fixed, and `msgpack` is not importable. The only other copies are in `pip/_vendor`; their versions were not read, so this attribution is likely, **not confirmed** | **Accepted, rescan** |
| certbot `sqlite` 3.53.4 (4), `binutils` 2.45.1 (3) | 7 | A crafted database or object file, or the SQLite shell | Only `sqlite-libs` is installed. No fix listed. Whether certbot uses SQLite was **not checked** | **Accepted, rescan** |
| certbot `setuptools` 70.3.0, CVE-2025-47273 | 1 | `PackageIndex` | **Copy not located**; the importable one is 84.2.1 | **Accepted, rescan** |

Certbot publishes no ports.

**Counts, by image:**

| Image | Before | After | State |
|---|---|---|---|
| Site | 7 | 6 expected: 3 accepted (D-SEC-5), 3 not affected | **Not rescanned**: no site image exists, and the upgrade is not built |
| nginx | 2 | 1 (`musl`, accepted) | Measured on the built image |
| certbot | 13 | 13 (accepted) | Measured on the built image; `zlib` critical stays fixed |

**Newer digests do not help today.** `mongo:8.0`, `nginx:1.30-alpine` and `certbot/certbot:latest` all
resolve to the digests already pinned.

**Limits of this evidence:**

- The site image's findings come from m1-056. Today's scan of the pinned `mongo` base shows the same
  `apt` and `x/net` versions.
- The `mongo-tools` list is from its `master` branch, not the exact shipped release. It has the same
  `x/net` version (0.61.0).
- "Accepted" and "not affected" are the owner's decisions on this evidence for staging. They should be
  scanned again before production.

## Agent errors in this task

- **A refused stop rule.** To follow the handoff, the agent tried to test a memory stop that
  force-killed every `docker.exe` by name. The permission check refused it. The agent did not retry
  it, and did not pull `mongo`. **There is still no tested stop rule.**
- **An unplanned pull.** A diagnostic ran the pinned nginx base image by digest, which pulled it. The
  image was already approved in m1-055 and was removed afterwards.
- **Invalid runs, repeated and not counted:** native `curl` could not write to `/tmp`; a first nginx
  test failed because the script called `openssl`, which the base image also lacks; the first page text
  read in Chrome ran before the page had loaded.

## Tests executed and actual results

| Check | Result |
|---|---|
| `npm run lint` | **PASS**, exit 0 |
| `npm run test:smoke`, local SQLite | **PASS**, 18/18 |
| `npm run test:workflow`, local SQLite | **PASS**, 15/15 |
| `npm run test:persistence`, local SQLite | **PASS**, 7/7, **without a server restart** |
| nginx image builds; the four packages are gone; `zlib` 1.4 stays | **PASS** |
| Project template rendered by the official entrypoint, no unfilled variable; `nginx -t`; reload | **PASS** |
| HTTP 301 keeps path and query | **PASS**, `https://localhost/a?b=1` |
| Other host names closed on 80 and refused at TLS | **PASS** (curl exits 52 and 35) |
| HTTPS over HTTP/2, no site running | **PASS**: 502, as expected with no upstream |
| nginx rescan: only `musl` left | **PASS** |
| certbot image builds; rescan shows 13 high, no critical | **PASS** |
| nginx proxying to a real site; upload limit and rate limit on the changed image | **NOT TESTED** |
| Site image build with the `apt` upgrade, on `amd64` or `arm64` | **NOT VERIFIED**: not built |
| Runbook `$S build` and the `$S` commands as written | **NOT TESTED** |
| `linux/arm64` build and start | **NOT TESTED** |

The suites do not exercise the Docker changes: they ran on the local app with SQLite. `npm run
test:unit` and `npm run test:ci` were not run, because only Docker files and documents changed. The
hosted checks on merge commit `062b0fd` were read through GitHub's public API, because `gh` is not
installed on this PC: `lint`, `build`, `audit`, `secrets` and `test` all passed.

## Browser checks (agent-executed, Claude in Chrome)

Short check of the public site, because no template or application code changed.

| # | Check | Result |
|---|---|---|
| 1 | `http://localhost:3000/` logged out: page "Home" with its demo content | **PASS** |
| 2 | No console error during a reload with tracking on | **PASS** |
| 3 | Editor login, editing, layouts | **NOT TESTED**: no user-visible change |
| 4 | Chrome through nginx on the changed image | **NOT TESTED**: needs the site image |

## Clean-up

- Removed the disposable container, the test certificate, and the images this task added:
  `assurer-nginx:staging-m1057`, `assurer-certbot:staging-m1057` and the nginx base. Stopped the local
  server and closed the Chrome tab. No editor account was created.
- `test:workflow` ran against the local SQLite database, as usual.
- **Build cache** grew from 155 to 169 entries (21.47 GB to 21.73 GB). Not pruned.

**A difference from the m1-056 report, explained.** At the start of this task Docker had **0 images
and 0 containers**, although that report lists images left on this PC. The owner cleared them: "yes i
clear the docker images to free up spaces or memory". Six anonymous or builder volumes (3.9 GB) remain,
untouched, with contents not inspected.

## Not done or not verified

- The `apt` upgrade build and the site image rescan.
- `arm64`: the owner's rule that all images support it is **still not proven for this stack**.
- The runbook commands as written, and a tested memory stop rule.
- From m1-055, still open: a real certificate; any server, firewall or LUKS step; backup removal by
  age; a failed backup's log line; RPO and RTO at real data sizes; off-site backups; alerts; a load test
  on this stack; `X-Forwarded-For` trust end to end; the secret rotation steps; x.509 for production.
