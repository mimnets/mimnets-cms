# m1-043 — The whole project in one Docker container

| | |
|---|---|
| **Task** | m1-043 |
| **Date** | 2026-11-06 |
| **Scope** | One Docker image with the Apostrophe app and MongoDB 8.0.34, for `linux/amd64` and `linux/arm64`. This also gave the first suite run against MongoDB. Demo and test use only |
| **Prompt** | [2026-11-06-m1-043-docker-one-container.prompt.md](../../../prompts/2026/11/2026-11-06-m1-043-docker-one-container.prompt.md) |
| **Handoff** | [m1-043 start handoff](../../../../milestones/m1-043-handoff.md) · next: [m1-044 handoff](../../../../milestones/m1-044-handoff.md) |
| **Branch / commit** | `feat/m1-043-docker-one-container`, from `docs/m1-042-docker-test-handoff` `d0d0ba4`. Commit and push approved by the owner (D-GIT-41); PR opened by the owner |
| **Related** | D-DB-8 · D-DB-9 · D-DB-10 · D-DB-11 (new) · [single-container runbook](../../../../runbooks/docker-single-container.md) (new) |

All checks below are **agent-executed**. They are not human approval.

## Changes from the handoff

- **Precondition not met:** the m1-042 PR is not merged. `origin/main` is still at `598f1da`. The
  branch is based on the m1-042 branch, so m1-042 must merge first.
- **Scope changed by the owner:** the handoff planned a test with Compose files outside Git, and the
  Dockerfile afterwards. The owner asked for the package now, in one container, so the files are in
  the repository. The handoff's separate-container design was not used.
- **Default password:** the owner asked for `admin`. This goes against the "Security by default"
  rule, so it is recorded as D-DB-11 and limited to demo and test use.

## Approvals used

- Docker and MongoDB 8.0.x on this PC: D-DB-10 (a). Base images `mongo:8.0.34` and
  `node:24-bookworm`, as named in the OCI guide. No npm package or lockfile changed.
- One container and the default password: owner, in session (prompt record).
- Commit and push of this branch: owner (D-GIT-41).
- Not approved or done: PR, registry push, OCI server use, volume removal.

## Findings

| # | Finding | How found |
|---|---|---|
| 1 | The PC has Docker Desktop 4.97.0, Engine and client 29.9.2, Compose 5.6.1, and WSL2. `hello-world` ran. The owner confirmed in session that the company meets Docker Desktop's license condition (under 250 employees and under $10 million revenue) | `docker version`, `wsl -l -v`; owner's statement |
| 2 | `mongo:8.0.34` is still the newest usable 8.0 patch. Tags 8.0.35 to 8.0.38 do not exist. MongoDB's notes list 8.0.37 as upcoming, without a date | Docker Hub through `imagetools`; release notes |
| 3 | "All architectures" means `linux/amd64` and `linux/arm64`. `mongo:8.0.34` is published for Linux on only those two (`node:24-bookworm` adds `ppc64le`). Its Windows images cannot host the Linux app | Image manifests |
| 4 | `user:add` echoes the characters it reads from standard input into its output. In the first build this put the first admin password's characters in the container log. Fixed: the output now goes to `/dev/null`. That password was replaced and the log removed by recreating the container | Reading the first-boot log |
| 5 | The agent printed the disposable editor's password into the session by a mistake in a command. The account existed only in this local container and is now archived; it can no longer log in. The value is not recorded here | Agent's own review |
| 6 | `assurer-demo:seed-corporate` refuses `NODE_ENV=production`, by design. The guard was left alone, so the image has only the home page demo content | `modules/assurer-demo/lib/guard.js` |
| 7 | `npm run audit:check` passes: 0 critical, 0 high, 52 moderate, 2 low. Three findings are not in the baseline (`minimatch`, `glob`, `deepmerge`), below the failing level | `npm run audit:check` |
| 8 | The login page shows a white bar about 56 px high above the form, and a "Production" label from core. The bar may be the admin bar space from m1-026 with the `loggedIn` cookie. Cause not checked, and not compared with the development site | Browser, not investigated |

## Evidence for D-DB-8 and hardening runbook §12

These are test results. They do not decide §12 choices 6 and 7, which stay with the owner.

- **MongoDB 8.0.34 works with the project's driver** with a replica set, access control and a key
  file: all suites pass.
- **`javascriptEnabled: false` stays on** in every run, with no failing check (choice 7).
- **The driver reconnects after MongoDB restarts.** With `mongod` stopped, a page request returned
  500 after 30 seconds. After `mongod` restarted, the page returned 200 within about 2 seconds, with
  the same app process (same PID). This test used the image with a one-line change, at run time, so
  that the entrypoint waited only on the app.
- **TLS on the database connection: NOT TESTED** (handoff step 8). It belongs to the staging task.

## Tests executed and actual results

| Check | `linux/amd64` (native, this PC) | `linux/arm64` (QEMU emulation on this PC) |
|---|---|---|
| Lint (`npm run lint`, on the host; the source is the same) | PASS, exit 0 | same source |
| Smoke, fresh first boot, `admin`/`admin` | PASS, 18/18 | PASS, 18/18 |
| Workflow | PASS, 15/15 | PASS, 15/15 |
| Container restart, then persistence | PASS, 7/7 | PASS, 7/7 |
| Architecture reported inside the container | image `linux/amd64` | `aarch64`; Node `arm64`; `sharp` loads |
| MongoDB version | 8.0.34 | 8.0.34 |
| Anonymous `listDatabases` | Refused | Refused |
| First start to HTTP 200 | About 20 s | About 235 s (emulated) |
| Password prompt lines in the log | 0 | 0 |

Suites ran from the host against the published port (`BASE_URL`), with test variables set for the
process only. **`linux/arm64` has not run on real ARM hardware.** Emulation does not show that a
given server's CPU meets MongoDB's ARMv8.2-A requirement.

Other checks, on `linux/amd64`:

| Check | Actual result | Status |
|---|---|---|
| No secrets in the image | No `.env`, `.sqlite` or `.db` outside `node_modules`; no secret in the image history (the build stage is not in the final image) | PASS |
| No secrets in the logs | Generated secrets and connection string not found in the site log. Scan ran before the default password change; the admin value is now the documented default | PASS |
| Secrets volume permissions | Secrets are root-only and the key file is `mongodb`-only. The app user cannot read them | PASS |
| Listening addresses | Host: `127.0.0.1:3042` only. Container: `mongod` on `127.0.0.1` only, app on `0.0.0.0` | PASS |
| Separate users | `mongod` as `mongodb`, app as `assurer` (uid 1001) | PASS |
| `mongod` stops under the real entrypoint | The container stopped, as designed | PASS |
| Developer's `.env` and SQLite | Not used and not edited. `git status` shows no change to tracked files outside the docs | PASS |

### Browser acceptance

Claude in Chrome, owner's Chrome, dedicated tab group, against `http://localhost:3042`.
Agent-executed. No screenshots were kept.

| # | Check | Role / viewport | Steps | Actual | Status |
|---|---|---|---|---|---|
| 1 | Home page renders | logged out, 1440 | Open `/`; read the DOM | Title, H1 and demo notice present, no broken images, no overflow | PASS |
| 2 | No admin UI or user data | logged out | Check the DOM and HTML; call the APIs without a login | No admin bar or user object. Draft-mode page API 403, user API 404 | PASS |
| 3 | Log in through the form | editor | Type in the fields, click Login | Reached the home page with the admin bar, as `m1-043-editor` | PASS |
| 4 | Draft is not public | editor | New Page, title, Save Draft | "Draft" label in the manager. Logged out 404, not in the navigation | PASS |
| 5 | Publish | editor | Edit, choose Publish | "Published" message. Logged out 200 with the title | PASS |
| 6 | Unpublished edit stays hidden | editor | Change the title, Save Draft | "Pending Updates" label. Public title unchanged, no draft text | PASS |
| 7 | Search (`$text`) | editor | Images manager, type "motor" | Filtered from 9 images to the 2 matching ones | PASS |
| 8 | Layouts | logged out, 1440, 768, 375 | Same-origin frames at those widths, because the window resize did not take effect | No overflow, no broken images | PASS |
| 9 | Image upload through the UI | — | — | Not run; a file dialog was not used. The workflow suite uploads through the API and the page shows the image | NOT TESTED |
| 10 | Contact form in the browser | — | — | Not run in the browser. The smoke suite covers the real submit route | NOT TESTED |
| 11 | Admin login in the browser | — | — | Not run in the browser. `admin`/`admin` returned 200 from the login API and the suites used it | NOT TESTED |

## Security observations

- **Default `admin` password (D-DB-11):** anyone who can reach the site can administer it. Compose
  limits it to this PC. Changing the `ports:` line would expose it. The runbook warns about this.
- **Docker's published ports go around a server's firewall rules.** This is what exposed the OCI
  MongoDB in m1-041. MongoDB is not published here at all.
- **One container shares one failure and patch cycle,** and the app runs next to the database. Use
  separate containers for any real site (D-DB-10 (b)).

## Unresolved decisions

- Hardening runbook §12 choices 6 and 7: bring these results to the owner.
- D-DB-10 (b): containers for staging and production.
- Running on the owner's own server: the owner plans this for later. Which server, and when, is not
  decided, and the run needs its own approval.
- MongoDB dashboard (owner's request): tool not chosen. Direct CRUD conflicts with ADR-0002, so it
  needs an owner decision.

## Rollback guidance

Revert the commit. Stop the site with `docker compose stop`. The Docker files can be removed without
affecting the development site. Removing the volumes deletes this demo data for good and needs approval.

## Cleanup and what is left

- Archived: test page "Zebra Unpublished Edit" (public 404) and account `m1-043-editor` (login refused).
- Removed: the throwaway containers and their volumes, and the editor password file. The Chrome tab
  was closed.
- **Left running for the owner:** container `assurer-site-1` on `http://localhost:3042`.
- Left in Docker: volumes `assurer_mongo-data`, `assurer_secrets`, `assurer_uploads`,
  `assurer_app-data` and one anonymous volume for `/data/configdb` (empty, from the base image); images
  `assurer-site:local`, `assurer-site:local-arm64`, `mongo:8.0.34`, `node:24-bookworm`, `hello-world`.
- Left in that database: the suites' "M0 Test Page" and contact form test submissions.

## Recommended next step

The owner merges m1-042, then opens and merges the m1-043 PR. Then a new
session starts from the [m1-044 handoff](../../../../milestones/m1-044-handoff.md).
