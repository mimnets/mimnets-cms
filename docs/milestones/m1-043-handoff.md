# m1-043 start handoff: MongoDB 8.0.x test run in Docker on the local PC

| | |
|---|---|
| **Prepared** | 2026-11-06, by the agent at the end of m1-042 (agent-executed; not a human approval) |
| **Task** | `m1-043`: run the suites against MongoDB 8.0.34 or newer in a pinned Docker container on the owner's PC, then bring the results for runbook §12 choices 6 and 7 to the owner |
| **Preconditions** | (1) The m1-042 PR is merged (D-GIT-40) and its five hosted CI checks are green. (2) The owner has finished §2 below |
| **Branch** | `test/m1-043-mongodb-docker` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** after the reboot (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-8, D-DB-9, D-DB-10) · [m1-042 report](../engineering/reports/2026/11/2026-11-06-m1-042-docker-test-handoff.report.md) · [hardening runbook](../runbooks/server-hardening-and-patching.md) §6, §12 · [OCI test guide](../runbooks/project-test-on-oci-docker.md) |

## 1. State at the end of m1-042

- **No suite has run against MongoDB yet.** The ZIP run started in m1-042 was stopped before
  `mongod` started, at the owner's direction. That was a script problem, not a MongoDB result.
- This PC had no Docker and no WSL on 2026-11-06. It has 16 GB RAM and about 259 GB free on `C:`.
  Node is v24.21.0. Nothing was installed.
- Owner approvals so far: Docker Engine and MongoDB 8.0.x for this test (D-DB-10). Docker for
  staging and production is **not** decided.
- `mongo:8.0.34` exists on Docker Hub for amd64 and arm64 (checked 2026-11-06). 8.0.34 was the
  newest 8.0 release that could be downloaded. Check again before pulling.
- The OCI guide is written but has not been run.

## 2. Owner: install WSL and Docker on this PC

Finish this before starting the new session, because a reboot ends the running session.

### 2.1 Turn on WSL2

In **PowerShell as Administrator**:

```powershell
wsl --install
```

Reboot when asked. Ubuntu then finishes setting up and asks you to create a Linux username and
password. Check it:

```powershell
wsl --status
wsl -l -v      # Ubuntu must show VERSION 2
```

If this fails with a virtualization error, turn virtualization on in the BIOS. If this PC is itself
a virtual machine, its host must allow nested virtualization.

### 2.2 Install Docker: pick one

| | A. Docker Engine inside WSL Ubuntu | B. Docker Desktop for Windows |
|---|---|---|
| License | Apache 2.0, no subscription | Free only if the company has **under 250 employees and under $10 million** annual revenue. Otherwise a paid subscription is required |
| Install | [Docker's Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/), inside Ubuntu | [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/), with the WSL2 backend |
| Use it | From Ubuntu, or `wsl docker …` from Windows | `docker …` from PowerShell |
| Use this if | You are unsure of the company's size or revenue, or want no license condition | You confirm the company meets the condition and want a desktop app |

Use a current release in either case, and do not use a distribution's `docker.io` snap.

### 2.3 Check it

```powershell
docker version            # or: wsl docker version
docker compose version    # or: wsl docker compose version
docker run --rm hello-world
```

## 3. The agent's plan for m1-043

1. Confirm §2's checks and which Docker option was used. Record the versions.
2. Run the license and advisory check on the exact versions, and check MongoDB's release notes for
   a newer 8.0 patch. Anything older than 8.0.30 is excluded (CVE-2026-82067).
3. Keep Compose files and secrets in the scratch folder, outside Git. Use a pinned image, a port
   published on `127.0.0.1` only, a one-member replica set, access control with a key file,
   `javascriptEnabled: false`, and an `assurerApp` user with `readWrite` on the test database only.
4. Keep the owner's dev data apart. **Do not edit `.env`.** Set the variables for the test process
   only, because `dotenv` and `--env-file` do not override values that are already set:
   `APOS_DB_URI`, `APOS_SESSION_SECRET`, `APOS_TEST_USER`, `APOS_TEST_PASSWORD`, `APOS_DEMO_SITE=1`,
   `PORT=3042`, `BASE_URL=http://localhost:3042`, and `APOS_TEST_UPLOADS_PATH` under the scratch
   folder.
5. Fill the empty database: migrate, `assurer-demo:seed`, then `@apostrophecms/user:add` with the
   password sent through standard input.
6. Run lint, smoke, workflow, then restart the app and run persistence. Call the workflow script
   directly if the `npm` script's `--env-file` gets in the way. `assurer-test:ensure-admin` refuses
   anything but temporary SQLite, by design.
7. Restart MongoDB with the app idle. The app should stay up and keep serving, which D-DB-8 relies
   on and no test has shown yet.
8. Try the runbook's connection string with TLS if it is simple to do. Otherwise record it as
   NOT TESTED for the staging task.
9. Browser acceptance through Chrome as a disposable **editor**: draft, publish, unpublished edit,
   search in a manager (`$text`), and logged-out isolation. Files uploaded under
   `APOS_TEST_UPLOADS_PATH` are not served over HTTP, so an upload preview may be NOT TESTED here.
10. Clean up: archive test accounts and content, stop the containers, and confirm the owner's dev
    server still runs on SQLite with `.env` unchanged. Removing a Docker volume needs approval.

Report what really happened, including failures. A test result does not decide §12 choices 6 and 7:
bring the results to the owner.

## 4. Carry-over

- Owner: reported the OCI MongoDB closed. In m1-042, port 27017 gave no response from this PC. That
  does not show that access control is on or how the container is bound. Check the 9.0.4 install
  against MongoDB's security alerts before reusing it.
- Owner: remove the agent's key line (`m1-041-agent-…`) from the OCI server's
  `/root/.ssh/authorized_keys` when the agent no longer needs access. The agent's private key is at
  `~/.ssh/oci_m1041_ed25519` on this PC, outside the repository.
- All items in the [m1-042 handoff §2](m1-042-handoff.md#2-carry-over) still apply: revoke the Neon
  API key, then remove the `NEON_*` lines from `.env`; send the DPO question (I1); file the D-DB-5,
  D-SEC-3 (a) and D-SEC-3 (c) issues if wanted; limit SSH in the runbook's §3 `ufw` example in the
  first staging task. Note: m1-042's check of the `.env` variable names found no `NEON_*` line, so
  that part may already be done.
- Next after m1-043, if the owner agrees: the Dockerfile and Compose setup with a runbook update
  (D-DB-10), then the backup tool choice, proven by a restore test in that setup.
- Re-check D-DB-9 when Apostrophe releases a version that accepts driver 7.

## 5. Gates

- No new dependency or tool without approval (each with the license and advisory check): backup
  tool, nginx, ACME client, Node.js source, media copy tool, uptime service, MongoDB Compass. Docker
  images beyond those named in D-DB-10 need the same. No npm `overrides` for the driver without a
  recorded decision.
- `.env` stays on SQLite. MongoDB is used only by the test process, through a loopback address.
- Running the [OCI guide](../runbooks/project-test-on-oci-docker.md) needs separate approval.
- No provider choice, account creation, spending or production change without explicit owner
  approval. No public issue text is filed by the agent (I6).
- Commit, push and PR need owner approval.

## 6. Prompt for the new session

> Start m1-043. Read AGENTS.md and docs/milestones/m1-043-handoff.md first. I have installed WSL and
> Docker. Confirm the setup with me, follow the gates, and stop for approval before any commit or
> push.
