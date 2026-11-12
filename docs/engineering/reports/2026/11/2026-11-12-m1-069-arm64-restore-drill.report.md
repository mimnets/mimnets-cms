# m1-069 — The PITR restore drill that hung on `arm64`

| | |
|---|---|
| **Task** | m1-069 (item 1 of the [m1-069 handoff](../../../../milestones/m1-069-handoff.md)) |
| **Date** | 2026-11-12 |
| **Scope** | Find and fix the hang in `staging-arm64`, step "PITR restore into new, empty containers"; prove it on the PR. A drill on the OCI server is not part of it (owner's approval, PBM runbook §3) |
| **Prompt** | [2026-11-12-m1-069-arm64-restore-drill.prompt.md](../../../prompts/2026/11/2026-11-12-m1-069-arm64-restore-drill.prompt.md) |
| **Branch / commits** | `fix/m1-069-arm64-restore-drill` from `docs/m1-068-day-handoff` (`613587f`): `0a1deb7` (diagnostics), merged as PR #84 (`14e1d91`) with the handoff commit, before its `arm64` run had finished. The fix `2a498ec` was pushed to that branch after the merge, so it was not on `main`; the same commit was put on `fix/m1-069-pbm-resync` from `origin/main` as `49de4b7` for a new PR. Both pushes approved by the owner |

Checks marked agent-executed were run by the agent. They are not human approval.

## Cause

`restore-pbm-config` applies the PBM configuration to the new, empty database. Because the storage
is new, `pbm config --file` itself sends a resync command and does not wait for it
(`resyncIfNeeded`, PBM 2.17.0 `cmd/pbm/config.go`). The drill then sent
`pbmc config --force-resync --wait`. pbm-agent treats a second command of the same type with the
same timestamp, in whole seconds, as a duplicate and drops it (`checkDuplicateCmd`,
`pbm/ctrl/recv.go`). The CLI then waits for a "succeed" log entry for its own command, which never
comes (`sdk.WaitForResync`).

On the `arm64` runner both commands were sent at 04:53:27 UTC; the agent log shows one
`got command resync` and `[resync] succeed`, then nothing. On the owner's PC (`amd64`) the
configuration job took 3 s, so the two commands fell in different seconds and the drill passed.
The fault is timing, not the architecture: the same commands in PBM runbook §3 could hang on the
server.

## What changed

| File | Change |
|---|---|
| `docker/staging/backup-schedule.sh` | Restore mode (`ASSURER_BACKUP_INTERVAL_HOURS=0`): after configuring, wait one second, then `pbmc config --force-resync --wait --wait-time=2m`, up to three tries; logs "Backup list read from storage". Normal mode unchanged |
| `.github/workflows/staging-arm64.yml` | Each command of the restore step has a time limit and reports its exit code and time as an annotation; `--exit-code-from` makes a failed configuration job fail the step; the separate resync command is removed; diagnostics also run after a cancel, with time limits on the PBM calls and the PBM log tail as an annotation (readable from the public API without a login) |
| `docs/runbooks/pbm-backup-and-restore.md` §3 | The separate resync command is removed; the configuration job's two log lines are named |

## Results

| Check | Result |
|---|---|
| Workflow's exact restore commands, local, `amd64` (before the fix) | PASS, 43 s from the copy to a working site; marker page and upload (SHA-256 identical) back |
| `staging-arm64`, run `43156312446` (`0a1deb7`, diagnostics only) | FAIL as expected: `pbmc config --force-resync --wait` stopped by its limit (`rc=124` after 300 s); every other command 0–1 s; PBM log in the annotation shows the cause above |
| Fixed restore step, local, `amd64` | PASS: configuration job 4 s with "Backup list read from storage", restore 20 s, marker page and upload back |
| A command over its limit | PASS: fails with `rc=124` and names itself |
| `staging-arm64` on `49de4b7` (PR #85, run `43159524474`, 13 min 44 s) | PASS: every step; restore commands `rc=0` in 0–2 s, `pbmc restore` 17 s; 37 s from the copy to a working site, marker page and upload (SHA-256 identical) back. Read in Chrome on GitHub (the public API limit was used up) |
| `npm run lint` | PASS |
| `npm run test:smoke` / `test:workflow` / `test:persistence` (local SQLite dev server) | PASS 18/18, 15/15, 7/7 |

## Browser checks (Chrome, agent-executed)

No template or editor UI changed; the checks cover the restored site and the owner's layout questions.

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Restored site, logged out | Opened `http://127.0.0.1:3044/m1-060-restore-marker` from the fixed local drill | Marker page renders with header, breadcrumb and title; "Log in" shown, no admin bar; draft API answers 403; no horizontal overflow at 1440 px | PASS |
| Nested layout alignment (owner's question) | Home page draft of the local stack in preview mode (not edit mode, to keep the owner's edit lock), positions measured | Parent column, both nested columns and the sibling column start at the same top; nested columns plus gap fill the parent column exactly (260 + 32 + 260 = 552 px); the offset in the owner's screenshot is Apostrophe's edit controls in edit mode | PASS |
| Tablet and mobile widths | — | Not run: no layout or template changed | NOT TESTED |

## Implicit state review

| State | Where | Decision | Reason |
|---|---|---|---|
| Backup list in the restore database | `backup-schedule.sh` (restore mode) | **Made explicit** | Before, two commands raced to fill it and the outcome depended on the clock. Now the configuration job fills it, waits for the result, and says so; the job's exit code is the state |
| A sent PBM command versus one the agent accepted | the drill's PBM calls | **Bounded** | PBM gives no "dropped" answer. Every wait now has a limit (`--wait-time`, `timeout`) and a retry, so a dropped command shows as a failure, not a hang |
| Progress of the restore step | `staging-arm64.yml` | **Made observable** | One annotation per command with exit code and time; diagnostics after a failure or a cancel |

## Other requests in this session

Recorded in the prompt record and queued in INDEX ("Next free task ID"), in the owner's order:

1. **Database dashboard**, layer 1 of the m1-047 plan §4.6, on MongoDB (next, m1-070).
2. **Layout columns and layout options**: the column-friendly Assurer widgets in page layout
   columns; in nested columns the simple set plus the grids once they collapse to one column; more
   layout starters (2, 3, 4, 6 equal columns) as layout-widget variants through core options. The
   short column menus are configuration, not a bug (`docs/content/apostrophe-content-model.md`).
   The nested layout lines up with its sibling column outside edit mode (browser check above).
3. **Slideshow upgrade**: hero-banner slides first (heading, text, buttons, overlay, position),
   then other uses. Autoplay has no visible pause control (WCAG 2.2.2), to be fixed first.
4. **Staged rename to `mimnets-wms`** ("website management system"), everywhere including the
   brand, one step at a time without breaking the site; past records stay as written and a name
   map is added to INDEX. The GitHub repository is already renamed (same repository, old names
   redirect).
5. **Theme presets** (D-CONTENT-18, D-CONTENT-20).

## For the owner

1. Merge PR #85 once these records are pushed to it. PR #84
   was merged at 04:44 UTC with the diagnostics commit only, before its `arm64` run had finished.
2. The decision register has no entries for the m1-069 commits: the agent's edit to it was
   blocked by its tool's safety check. Your approvals are quoted in the prompt record.
3. A restore drill on the OCI server copy stays your decision (PBM runbook §3). After the merge, the
   server needs the new images (runbook §12) before the drill.

## Not done or not verified

- A restore on the OCI server.
- The `release` run for the merge.

## Left over

- Local Docker project `mimnets-cms` with tag `ci` images and volumes, used for the drill and by the
  owner for editing; to be removed when the owner is done (`down -v` on this local, disposable
  project only).
- The local dev server on port 3000 (SQLite), started for the suites.
- Scratch files outside the repository: the drill script and its logs.
