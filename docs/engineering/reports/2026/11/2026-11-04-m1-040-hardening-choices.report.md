# m1-040 — owner's answers to the hardening runbook §12 choices

| | |
|---|---|
| **Task** | m1-040 |
| **Date** | 2026-11-04 |
| **Scope** | Candidate (c) of the [m1-040 handoff](../../../../milestones/m1-040-handoff.md): record the owner's answers to the [hardening runbook](../../../../runbooks/server-hardening-and-patching.md) §12 choices. Docs only |
| **Prompt** | [2026-11-04-m1-040-hardening-choices.prompt.md](../../../prompts/2026/11/2026-11-04-m1-040-hardening-choices.prompt.md) |
| **Handoff** | [m1-040 start handoff](../../../../milestones/m1-040-handoff.md) · next: [m1-041 handoff](../../../../milestones/m1-041-handoff.md) |
| **Branch / commit** | `docs/m1-040-hardening-choices` from `origin/main` `5c9af72` (m1-039 merged as PR #42). Commit and push approved by the owner (D-GIT-38); PR opened by the owner |
| **Related** | D-DB-7 · D-DB-8 · D-GIT-37 · D-GIT-38 (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Task choice: owner, in session ("(c) Record §12 answers").
- §12 answers: owner, in session, one question per choice (quoted in the prompt record).
- Precondition: PR #42 is merged into `main` as `5c9af72`. The five hosted CI checks (lint, test,
  build, audit, secrets) completed with `success` on `04a64d3` and `5c9af72`, read through the
  public GitHub API (`gh` is not installed).
- No provider account created, nothing provisioned or installed, no money spent. No package,
  lockfile, `.env`, database, user account or production system changed. Nothing posted anywhere.

## Decisions recorded

| # | Choice | Owner's answer (2026-11-04) | Agent suggestion followed? |
|---|---|---|---|
| 1 | Disk encryption | B, LUKS data volume | yes |
| 2 | MongoDB member authentication | x.509 on production; key file acceptable on staging | yes |
| 3 | TLS proxy | nginx | no suggestion (either) |
| 4 | Reboot handling | follows choice 1: weekly manual, announced | yes |
| 5 | SSH source addresses | fixed admin addresses only | yes |
| 6 | MongoDB major version | deferred to the local MongoDB test run | yes |
| 7 | `javascriptEnabled: false` | deferred to the local MongoDB test run | yes |
| 8 | Uptime and alert monitoring | external uptime check with email alerts | yes |

## Work completed

| Item | Result |
|---|---|
| Runbook | Status and "Waits for" rows; §1 proxy row; §3 SSH rule; §4 reboot decision; §5 decision replaces the suggestion; §6 key file comment and step 1; §8 names nginx and the need for an ACME client; §12 gains a Decision column. Still **Draft, not yet executed** |
| Register | D-DB-7 note (the answers, as the m1-039 report planned); D-GIT-37 merged (PR #42, CI green); D-GIT-38 new |
| Indexes | Runbooks README and INDEX (runbook row, task row, next free ID) |
| Records | This report, the prompt record, [m1-041 handoff](../../../../milestones/m1-041-handoff.md) |

## Files changed

- A `docs/engineering/prompts/2026/11/2026-11-04-m1-040-hardening-choices.prompt.md`
- A `docs/engineering/reports/2026/11/2026-11-04-m1-040-hardening-choices.report.md`
- A `docs/milestones/m1-041-handoff.md`
- M `docs/engineering/decision-register.md`
- M `docs/engineering/INDEX.md`
- M `docs/runbooks/README.md`
- M `docs/runbooks/server-hardening-and-patching.md`

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
| 1 | Public home page renders | logged out, default window | `http://127.0.0.1:3000/` in the session's tab; DOM read with JavaScript | title, H1, "Demo" label, no horizontal overflow | Title "Home", H1 "Protection you can rely on", "Demo" present, no overflow | PASS | none (DOM read) |
| 2 | No admin bar or user data when logged out | logged out | same page; check for admin-bar elements and a `"user":{` object in the HTML | neither present | neither present | PASS | none |
| 3 | Editor flows, 1440/768/375 layouts | — | — | — | Docs-only task; no template, layout or content change | NOT TESTED (not applicable) | — |

## Security observations

- Choice 3 (nginx): nginx does not renew certificates by itself. Runbook §8 requirement 1 needs
  an ACME client as well (for example certbot), which is one more tool approval.
- Choice 5: the runbook's `ufw` example in §3 still allows port 22 from any address. The Hetzner
  firewall limits the source, but the host firewall should match it. Not changed here (it is a
  command change, not a recorded answer); carried over to the first staging task.
- Choice 2: x.509 on production means a private CA to run, and member certificates to rotate.
  This adds to the ops load that I4 already names as the main risk.
- Choices 1 and 4 are consistent: a LUKS data volume plus weekly manual reboots. Kernel and libc
  security fixes take effect only at the weekly reboot, so the gap is up to a week.
- No secrets or admin addresses are recorded in this task.

## Known limitations

- The answers are recorded; nothing is executed. LUKS on Hetzner Cloud is still untested.
- Choices 6 and 7 stay open until the local MongoDB test run.
- No uptime service is chosen; choice 8 sets only the approach.

## Unresolved decisions

- Runbook §12 choices 6 and 7: the local MongoDB test run.
- D-DB-2, D-DB-3, D-DB-7: still waiting for the DPO's answer to I1.
- Tool approvals: MongoDB, nginx, an ACME client, the backup tool, the media copy tool, the
  Node.js source and the uptime service.
- D-GIT-38: approved; the owner opens the PR.

## Rollback guidance

Docs only. Revert the commit; no data or configuration changed.

## Cleanup

The agent's server on `:3000` was stopped and the Chrome tab was closed. No test account or test
content was created beyond what the suites write on every run to the local SQLite database.

## Recommended next step

The local MongoDB test run (tool approval), which settles choices 6 and 7, or the backup tool
choice. Start a new session ([m1-041 handoff](../../../../milestones/m1-041-handoff.md)).
