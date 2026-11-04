# m1-039 — server hardening and patching runbook

| | |
|---|---|
| **Task** | m1-039 |
| **Date** | 2026-11-04 |
| **Scope** | Candidate (c) of the [m1-039 handoff](../../../../milestones/m1-039-handoff.md), work that does not wait for the DPO: draft a server hardening and patching runbook for the owner's preferred stack (Hetzner Cloud, Singapore, self-hosted MongoDB, app under systemd behind a TLS proxy). Docs only |
| **Prompt** | [2026-11-04-m1-039-hardening-runbook.prompt.md](../../../prompts/2026/11/2026-11-04-m1-039-hardening-runbook.prompt.md) |
| **Handoff** | [m1-039 start handoff](../../../../milestones/m1-039-handoff.md) · next: [m1-040 handoff](../../../../milestones/m1-040-handoff.md) |
| **Branch / commit** | `docs/m1-039-hardening-runbook` from `origin/main` `73293c5` (m1-038 merged as PR #41). Commit and push approved by the owner (D-GIT-37); PR opened by the owner |
| **Related** | D-DB-2 · D-DB-3 · D-DB-4 · D-DB-7 · D-DB-8 · D-GIT-36 · D-GIT-37 (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Task choice: owner, in session ("Hardening runbook (c)").
- Precondition: PR #41 is merged into `main` as `73293c5`. The five hosted CI checks (lint, test,
  build, audit, secrets) completed with `success` on `6127e57` and `73293c5`, read through the
  public GitHub API (`gh` is not installed).
- No provider account created, nothing provisioned or installed, no money spent. No package,
  lockfile, `.env`, database, user account or production system changed. Nothing posted anywhere.

## Requirements

Draft a server hardening and patching runbook covering at least the firewall, MongoDB bound to
private interfaces with authentication and TLS, full-disk encryption, the TLS proxy and unattended
security updates (m1-039 handoff §1). It must not choose a provider, a tool or a setting that
needs the owner's approval.

## Work completed

| Item | Result |
|---|---|
| Runbook | New [server hardening and patching runbook](../../../../runbooks/server-hardening-and-patching.md), status **Draft, not yet executed**: target layout (§1), accounts and SSH (§2), Hetzner and host firewall (§3), Ubuntu baseline and automatic updates (§4), disk encryption options (§5), MongoDB configuration and users (§6), systemd unit (§7), TLS proxy requirements (§8), backups and media copy (§9), patching cadence (§10), verification checklist V1–V12, all NOT EXECUTED (§11), eight open choices (§12), sources (§13) |
| Register | D-DB-8 note (runbook and open choices); D-GIT-36 merged (PR #41, CI green); D-GIT-37 new |
| Indexes | Runbooks README and INDEX (runbook row, task row, next free ID) |
| Records | This report, the prompt record, [m1-040 handoff](../../../../milestones/m1-040-handoff.md) |

### Facts checked (vendor documentation, 2026-11-04)

- Hetzner Cloud Firewall: stateful; with no rules, inbound is blocked and outbound allowed; free.
  It does **not** filter private network traffic ("Not yet"), so the runbook adds a host firewall.
- Ubuntu Server: `unattended-upgrades` is installed and enabled by default for security updates;
  automatic reboots are off unless set in `50unattended-upgrades`.
- MongoDB (manual 9.0 is current): security checklist (authentication, least-privilege roles,
  TLS, `bindIp`, file-system encryption in Community, dedicated OS user, `--noscripting`);
  production notes (XFS, `vm.swappiness` 1, transparent huge pages enabled for 8.0 and later,
  64000 open files); Ubuntu 24.04 supported by 8.x and 9.x on x86_64.
- MongoDB's replica set tutorial says key files are for test and development and recommends x.509
  for production. This is open choice 2.
- Disk encryption on Hetzner Cloud: no Hetzner-provided option was found. The LUKS approaches in
  §5 come from community write-ups and are not tested.

## Files changed

- A `docs/runbooks/server-hardening-and-patching.md`
- A `docs/engineering/prompts/2026/11/2026-11-04-m1-039-hardening-runbook.prompt.md`
- A `docs/engineering/reports/2026/11/2026-11-04-m1-039-hardening-runbook.report.md`
- A `docs/milestones/m1-040-handoff.md`
- M `docs/engineering/decision-register.md`
- M `docs/engineering/INDEX.md`
- M `docs/runbooks/README.md`

## Tests executed and actual results

Server: `node --env-file=.env app` on `127.0.0.1:3000` (SQLite), started and stopped by the agent.

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Lint | `npm run lint` | No errors or warnings | PASS |
| Smoke | `npm run test:smoke` | 18/18 | PASS |
| Workflow | `npm run test:workflow` | 15/15 | PASS |
| Persistence | `npm run test:persistence`, same server | 7/7 | PASS |
| Runbook steps | — | No server exists; every row of runbook §11 is NOT EXECUTED | NOT TESTED |

### Browser acceptance

Claude in Chrome, owner's Chrome, dedicated tab group; logged out; agent-executed.

| # | Check | Role / viewport | Steps | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Public home page renders | logged out, default window | `http://127.0.0.1:3000/` in a new tab; DOM read with JavaScript | title, H1, "Demo" label, no horizontal overflow | Title "Home", H1 "Protection you can rely on", "Demo" present, no overflow | PASS | none (DOM read) |
| 2 | No admin bar or user data when logged out | logged out | same page; check for admin-bar elements and a `"user":{` object in the HTML | neither present | neither present | PASS | none |
| 3 | Editor flows, 1440/768/375 layouts | — | — | — | Docs-only task; no template, layout or content change | NOT TESTED (not applicable) | — |

## Security observations

- The runbook keeps MongoDB and the app on `127.0.0.1`, with authentication, TLS and per-purpose
  users. Port 27017 is never opened, on the Hetzner firewall or the host firewall.
- The Hetzner Cloud Firewall does not filter private networks. A host firewall is required, and
  matters as soon as a second server joins a private network.
- Disk encryption and unattended reboots conflict: an encrypted disk or volume needs someone to
  unlock it after each reboot. Choice 1 and choice 4 must be decided together.
- Key files for MongoDB member authentication are, by MongoDB's own guidance, for test and
  development. Production should use x.509 (choice 2), even on a single member.
- The runbook contains no secrets. Its connection string and file paths are placeholders.
- The in-house team's limited ops experience (I4) is still the main risk of self-hosting. The
  cadence in §10 is the minimum and needs a named person.

## Known limitations

- Not executed anywhere. The configuration blocks are outlines; every key must be checked
  against the chosen MongoDB, Ubuntu and proxy versions in the first staging task.
- MongoDB server and Node driver (`mongodb` 6.21.0) compatibility not checked (the compatibility
  page did not render its table); left to the local MongoDB task.
- Whether Apostrophe works with `javascriptEnabled: false` is not known (choice 7).
- Single-member replica set with authentication: whether a key file or x.509 is needed for one
  member is not verified.
- Hetzner Backups price and Singapore prices not checked.

## Unresolved decisions

- Runbook §12 choices 1–8 (owner, with ops). Not added to the register as separate entries; they
  belong with D-DB-7 when the hosting decisions are recorded.
- D-DB-2, D-DB-3, D-DB-7: still waiting for the DPO's answer to I1.
- Backup tool, TLS proxy, Node.js source, MongoDB install and media copy tool: each needs tool
  approval with the license and advisory check.
- D-GIT-37: approved; the owner opens the PR.

## Rollback guidance

Docs only. Revert the commit; no data or configuration changed.

## Cleanup

The agent's server on `:3000` was stopped and the Chrome tab was closed. No test account or test
content was created beyond what the suites write on every run to the local SQLite database.

## Recommended next step

The owner reviews runbook §12 and answers the choices that do not depend on the DPO (1–5, 8).
Next tasks that do not wait for the DPO: the local MongoDB test run (tool approval), which also
settles choices 6 and 7, and the backup tool choice. Start a new session
([m1-040 handoff](../../../../milestones/m1-040-handoff.md)).
