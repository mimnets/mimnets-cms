# m1-058 — Finish the staging proof

| | |
|---|---|
| **Task** | m1-058 |
| **Date** | 2026-11-09 |
| **Scope** | Candidate 1 of the handoff: the runbook's `$S` commands as written, the `apt` upgrade, a site rescan, nginx with the real site, and the `arm64` build and start. Nothing deployed |
| **Prompt** | [2026-11-09-m1-058-staging-proof.prompt.md](../../../prompts/2026/11/2026-11-09-m1-058-staging-proof.prompt.md) |
| **Handoff** | [m1-058 start handoff](../../../../milestones/m1-058-handoff.md) · next: [m1-059 handoff](../../../../milestones/m1-059-handoff.md) |
| **Branch / commits** | `fix/m1-058-staging-proof`: `b34b2f4`, `76f698c`, `ee3f18b`, `aa7f2f5`, merged by the owner through PRs #61 to #64; this report follows (D-GIT-56) |
| **Related** | D-DB-16 (new, open) · D-SEC-8 · D-DB-15 |

All checks below are **agent-executed**. They are not human approval.

## Status

**The staging proof is finished for `amd64` on the owner's PC and for `arm64` on a hosted runner. The
stack is still not ready for a server.** The main new finding: **MongoDB 8.0 refuses Linux kernels 6.19
to 7.0.13**, so the kernel of any host must now be chosen and checked (D-DB-16). Server items are in
"Not done".

## Approvals used

| What | Owner's words or choice |
|---|---|
| Task | "Finish staging proof (Recommended)" |
| Who stops a build | "You watch, I wait (Recommended)" |
| One clear of the Docker VM's file cache | "please try"; the agent took this as approval |
| How to prove `arm64` | "Hosted arm64 runner (Recommended)" |
| Delete the test stack's volumes | "Delete test volumes (Recommended)" |
| Commits, pushes, the second `amd64` run | "approve", "approve", "APPROVE" (D-GIT-56) |
| The older runner, then record | "Try older runner, then record (Recommended)" |

## Change

- **`.github/workflows/staging-arm64.yml` (new):** builds and starts the stack on GitHub's native
  `arm64` runner, one step per check, no secrets, prints diagnostics after a failure. It runs on pull
  requests that touch the staging files, and by hand. It does not block a merge.
- **`docker/staging/compose.yaml`:** `base` uses `scale: 0` in place of the `build-only` profile.
  **This is a bug fix:** on the runner's Compose, the profile stopped every `$S` command with
  `service "site" declares unknown service "base" as additional contexts staging-base`. The owner's
  Compose v5.7.0 accepted it, so earlier runs did not show it. `docker/pbm-poc/compose.yaml` has the
  same pattern and was left alone.
- **Records:** D-DB-16 and D-GIT-56, staging runbook §2, §7 and §8, hardening runbook §4, INDEX, this
  report and the handoff.

## The kernel finding

Three runs on `ubuntu-24.04-arm` got no further than MongoDB's start. MongoDB's log line, read through
the owner:

> MongoDB cannot start: Linux kernel versions 6.19 and newer has a known incompatibility with this version of MongoDB.

This is not about `arm64`. MongoDB's [production notes](https://www.mongodb.com/docs/manual/administration/production-notes/)
say a kernel from 6.19 through 7.0.13 can crash MongoDB, that it stops at startup to prevent that, on
every package including Docker, and that 7.0.14 or later resolves it. Its
[8.0 release notes](https://www.mongodb.com/docs/manual/release-notes/8.0/) list "Add linux the kernel
7.0.14 exemption for ubuntu" under the upcoming 8.0.37, and 8.0.34 is the newest `8.0` on Docker Hub
today, so **8.0.34 may still refuse Ubuntu's 7.0.14 kernels**. [SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912)
is closed as "Gone away", no fix version.

| Host | Kernel | Effect |
|---|---|---|
| This PC, Docker's VM | 6.18.54 | Works, one release below the limit. **A Docker Desktop update could stop MongoDB here** |
| `ubuntu-24.04-arm` | Refused; version not printed | MongoDB stops at startup |
| `ubuntu-22.04-arm` | Allowed; **version printed in the run, not read by the agent** | Works |
| A future server | Not chosen | Must be checked (D-DB-16); nothing tested |

## Tests executed and actual results

**`amd64`, the owner's PC, default project name and ports, before the Compose fix:**

| Check | Result |
|---|---|
| `$S build`; `apt` and `libapt-pkg6.0t64` at `2.8.4ubuntu0.1` inside the image | **PASS**, exit 0 in about 2.5 minutes |
| `$S up -d`; healthy with 2 web processes | **PASS** |
| `gosu`, `js-yaml`, `esbuild` binaries absent | **PASS** |
| HTTP 301; HTTPS 200, HSTS, `Secure` cookies, no `Server` version | **PASS** |
| Other host names closed or refused (curl exits 52 and 35) | **PASS** |
| `admin`/`admin` refused ("Your credentials are incorrect") | **PASS** |
| PBM agent OK, PITR on; "no backup found" clears after the first base backup | **PASS** |
| Site rescan, Docker Scout, critical and high | **PASS**: 6 high, 0 critical, as expected; `apt` gone |
| 34 MB upload through nginx | **PASS**: 413 |
| 5 MB upload through nginx, served back | **PASS**: identical SHA-256 |
| Rate limit: 300 requests from one HTTP/2 client | **PASS**: 103 got 429; normal 3 s later |
| Admin password file read, then deleted | **PASS** |
| `$S restart site`, data kept | **PASS**: answering in 11 s |
| `$S up -d --build`, data kept | **PASS**. It recreated the site and nginx containers with no code change; **cause not known** |

**`amd64`, after the Compose fix, ports on `127.0.0.1`:**

| Check | Result |
|---|---|
| `$S build` | **PASS**: 172 s, 14 steps cached |
| `$S up -d`, healthy; no `base` container | **PASS** |
| HTTP 301, HTTPS 200 with HSTS, `apt` version | **PASS** |
| Stop | **PASS**: exit code 0, MongoDB logged its shutdown, about 1 s |

The rescan, the upload and rate limit checks and the browser checks were **not repeated** after the
Compose fix.

**`arm64`, hosted runner, read from GitHub's public API:**

| Run | Runner | Result |
|---|---|---|
| [42605635658](https://github.com/mimnets/vcl-assurer-group/actions/runs/42605635658) | `ubuntu-24.04-arm` | **FAIL**: Compose refused the file |
| [42608356176](https://github.com/mimnets/vcl-assurer-group/actions/runs/42608356176) | `ubuntu-24.04-arm` | **FAIL**: built; MongoDB did not start |
| [42609335991](https://github.com/mimnets/vcl-assurer-group/actions/runs/42609335991) | `ubuntu-24.04-arm` | **FAIL**: same, with diagnostics; the kernel refusal |
| [42613016643](https://github.com/mimnets/vcl-assurer-group/actions/runs/42613016643) | `ubuntu-22.04-arm` | **PASS**: all steps below |

Passing steps: `$S build`; all three images `arm64`; `$S up -d`; site healthy; `apt` version and removed
files; HTTP 301; HTTPS 200 with HSTS; 413 on a 34 MB upload; 429 under load; first base backup with
`pbm-agent` OK; site answers after a restart. **Native, not emulated.** The kernel and Compose versions
are in the run's log, which needs a GitHub login; the agent did not read them.

**Local suites, on SQLite, which do not exercise the Docker changes:** `npm run lint` **PASS**;
`test:smoke` **PASS**, 18/18; `test:workflow` **PASS**, 15/15; `test:persistence` **PASS**, 7/7, **without
a server restart**. The hosted `lint`, `build`, `audit`, `secrets` and `test` checks passed on each PR.
`test:unit` and `test:ci` were not run locally.

## Browser checks (agent-executed, Claude in Chrome)

Account `m1058-editor`, role `editor`, created with `@apostrophecms/user:add`. Through nginx over HTTPS,
at 1440 px, on the `amd64` images before the Compose fix. The owner clicked through the certificate
warning.

| # | Check | Result |
|---|---|---|
| 1 | Login through the UI; editor's admin bar | **PASS** |
| 2 | Add a hero section, type a labelled test string, "Document saved" | **PASS** |
| 3 | Draft isolation: logged-out page without it; `?aposMode=draft` and the draft API 403; user API 404 (run with curl) | **PASS** |
| 4 | Publish through the UI; logged-out page shows it | **PASS** |
| 5 | Media upload in the UI: POST 200, resized versions served through nginx, shown in the manager | **PASS**. Save not clicked |
| 6 | Session survives a site restart | **PASS** |
| 7 | Logged-out page after logging out: edit shown, no admin bar | **PASS** |
| 8 | Console | **4 errors at 16:52:27–32, during the restart**, matching nginx's 502s. None outside that window. Two draft PATCH requests also got 502 there; whether anything was lost was **not checked** |
| 9 | 768 and 375 px layouts | **NOT TESTED**; no template changed |

## Memory on this PC

| Moment | Available |
|---|---|
| A few minutes after a restart | 488 MB |
| Start of the first `$S build` | 6,553 MB |
| Lowest, during that build | **137 MB**, under the agreed 1 GB line; the owner quit Docker Desktop after it finished |
| Stack idle, Chrome open | about 760 MB; 3.1 GB of the VM's 4.2 GB was file cache |
| Lowest, build after the Compose fix (started at 6,614 MB) | 1,168 MB |

**The stop rule was not tested.** The build ended by itself; quitting Docker Desktop was used only after
it. The 6 GB limit was not a safe margin. The owner closing Chrome freed most of the memory: available
was already 5.9 GB before the agent's cache clear, so the clear's own effect is not known. **`arm64`
under emulation was not tried on this PC.**

## Agent errors in this task

- **The first workflow was pushed untested against the runner's Compose**, so it failed in setup. A local
  check could not have shown it with v5.7.0.
- **The workflow hid MongoDB's error** by printing only `[assurer]` lines, which cost one extra run.
- **Invalid runs, repeated and not counted:** a first upload check fetched the home page, because the
  script looked for the wrong response field; a first rate limit check used one Windows `curl` process
  per request, too slow to pass the limit; first login clicks missed after the page's layout shifted.
- **An unplanned `git merge origin/main`** was included in a command. It changed nothing and was not
  repeated.
- **The test account's password appeared in this session's tool calls**, when it was read and typed. The
  account and its database are deleted. It is not in this report.
- **The agent asked the owner not to merge** while reading each run; the PRs were merged at once. Reading
  each run on its PR worked anyway, so nothing was lost, but D-DB-16 and these records reached `main`
  after the code.

## Findings to carry

- `$S` publishes 80 and 443 on **all network interfaces** by default. Right for a server, not for a local
  test: this ran open during the first `amd64` test. The Chrome requests seen at 16:27 were the owner's
  (owner's answer). Runbook §2 now gives the loopback settings.
- The arm64 workflow now runs on `ubuntu-22.04-arm`, chosen for its kernel. Ubuntu 22.04 will not last for
  ever, and GitHub may change that kernel; the check then fails with the error above.
- Findings on `arm64` were not scanned; the 6 high are from `amd64`.

## Clean-up

- **Removed:** both test stacks and their 7 named volumes each (`down -v`, approved), including the editor
  account and test content; the scratch password; the local server, stopped. Chrome was closed by the
  owner before the agent could close its tab.
- `test:workflow` ran against the local SQLite database, as usual.
- **Left on the owner's PC:** images `assurer-site:staging`, `assurer-site:staging-base`,
  `assurer-nginx:staging` and `assurer-certbot:staging` (4.67 GB in all); build cache 24.13 GB, 19.07 GB of
  it reclaimable; 14 volumes (3.92 GB): the 6 from before, untouched, and 8 more, which the agent believes
  are anonymous volumes from the site image's `VOLUME` lines, left by a plain `$S down`, **not inspected**.

## Not done or not verified

- **On `arm64`:** Chrome, an accepted upload, the suites, a restore, a scan.
- **After the Compose fix on `amd64`:** the rescan, upload and rate limit checks, Chrome.
- **D-DB-16** is open. No server's kernel is known or tested. The community workaround
  (`GLIBC_TUNABLES=glibc.pthread.rseq=1`) was **not tested**.
- From m1-055, still open: a real certificate; any server, firewall or LUKS step; backup removal by age; a
  failed backup's log line; RPO and RTO at real data sizes; off-site backups; alerts; a load test on this
  stack; `X-Forwarded-For` trust end to end; the secret rotation steps; x.509 for production.
- D-SEC-8's "accepted" and "not affected" were decided for staging; scan again before production.
