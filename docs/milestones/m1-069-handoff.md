# m1-069 start handoff (end of day, 2026-11-11)

| | |
|---|---|
| **Prepared** | 2026-11-11, 13:00 UTC, by the agent at the end of m1-068 (agent-executed; not a human approval). Replaces the first version of this file, written before the release run |
| **State of `main`** | `e79bb3c` (PR #83). m1-068 merged as PR #81 (`44ffb1b`), push fix PR #82 (`ea9c81d`), runbook fix PR #83 |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [m1-068 report](../engineering/reports/2026/11/2026-11-11-m1-068-release-pipeline.report.md) (with its follow-up) · [staging container runbook](../runbooks/staging-container.md) §12 · [PBM runbook](../runbooks/pbm-backup-and-restore.md) §3 · `.github/workflows/staging-arm64.yml` · decision register D-DB-20 to D-DB-23, D-SEC-10, D-CONTENT-18, D-CONTENT-20 |

## 1. Where things stand

**Done and verified**

- One container per service in the Compose project `mimnets-cms` (D-DB-20, D-DB-22; ADR-0004
  Amendment 1 accepted, D-DB-23). Tested locally on `amd64`: the four suites, a PITR restore drill
  (35 s), Chrome as an editor.
- The release pipeline works (D-DB-21). The run for `ea9c81d` built, checked and pushed all four
  images for `amd64` and `arm64` and wrote the tag
  `ea9c81df00dd3d227fa42d8b8c63adba45cf6d58` on `ghcr.io/mimnets/assurer-{app,mongo,nginx,certbot}`.
  The first run (`44ffb1b`) had failed at the push with `unknown blob`; flattening nginx and certbot
  fixed it (report, follow-up).
- Runbook §12.3 now gives the exact switch commands (PR #83). The release run for `e79bb3c` was
  still running at 13:00 UTC.

**Open, in priority order**

1. **The PITR restore drill hangs on `arm64` in CI.** Both `staging-arm64` runs on the m1-068 PRs
   (runs `43019001423` and `43022182312`) passed every step up to "PITR restore into new, empty
   containers" and then stayed in that step: from 12:30 and 12:52 UTC, against 35 s for the whole
   drill on `amd64` locally and 40 s on `arm64` with the old one-container image (m1-060). The job
   timeout (60 min) cancels them; a cancelled job skips the "Diagnostics after a failure" step.
   Cause unknown: the job logs need a GitHub login, which the agent does not have. **The OCI server
   is `arm64`, so until this passes, a restore of the new stack on the server is unproven.**
   Backups are written as before.
2. **The server switch** (owner's steps, runbook §12.3): `docker login ghcr.io` is done (owner,
   2026-11-11). `ip-setup.sh … --switch-from-one-container`, the new admin password and the import
   had not been reported as run at 13:00 UTC. Safe to run before item 1 is fixed: the new site starts
   empty and the old volumes stay; §12.3 step 5 has the way back.
3. **Owner's checks on GitHub:** the four `assurer-*` packages are private (GitHub → profile →
   Packages); the account's current storage terms for private packages (design note §6). Old tags
   are not cleaned up yet (keep the last 10, by hand).
4. Later, each with its own approval: removing the old `assurer-staging_*` volumes after the new
   site is checked; the §9.2 production items.

## 2. Recommended next task

**`m1-069`: fix the `arm64` restore drill** (item 1), then go on with the theme presets as `m1-070`.
The owner may swap them.

1. Get the step's log: the owner pastes the last lines of "PITR restore into new, empty containers"
   from run `43019001423` once it is cancelled, or reruns it.
2. Reproduce locally with the workflow's exact commands (the agent's local drill used a scratch
   script that differs slightly, for example in how it waits). Candidates to check, none confirmed:
   `$R up --no-deps restore-pbm-config` (attached) not returning; `pbmc config --force-resync --wait`
   or `pbmc restore --wait` waiting for an agent; the copy taken while the site's agent writes a PITR
   chunk.
3. Add a time limit to each wait in that step, so a hang fails fast and the diagnostics step runs.
4. Prove it on the PR (`staging-arm64`), then run the drill once on the OCI server's copy only with
   the owner's approval (PBM runbook §3).

**Theme presets (m1-070):** design from the owner's example sites (D-CONTENT-18) as switchable
presets with an admin "Theme" choice (D-CONTENT-20), design note first; details as in the first
version of this handoff (git history).

## 3. Left over on the owner's PC

- Images `ghcr.io/mimnets/assurer-*:local` and `assurer-app-build:local` from the local tests (no
  containers or volumes). Remove with `docker image rm` when not needed.
- The `m1-067-test` project and its `m1-067-test_edge` network from m1-067, untouched.

## 4. Limits

- No change to WordPress. Commit, push and PR need the owner's approval. Anything on the OCI server
  is run by the owner.

## 5. Prompt for the new session

> Start m1-069. Read AGENTS.md and docs/milestones/m1-069-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
