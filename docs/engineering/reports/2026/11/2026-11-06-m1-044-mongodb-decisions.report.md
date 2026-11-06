# m1-044 — MongoDB version, server-side JavaScript and the container decision

| | |
|---|---|
| **Task** | m1-044 |
| **Date** | 2026-11-06 |
| **Scope** | Record the owner's decisions on hardening runbook §12 choices 6 and 7 and on D-DB-10 (b), from the m1-043 results. Docs only |
| **Prompt** | [2026-11-06-m1-044-mongodb-decisions.prompt.md](../../../prompts/2026/11/2026-11-06-m1-044-mongodb-decisions.prompt.md) |
| **Handoff** | [m1-044 start handoff](../../../../milestones/m1-044-handoff.md) · next: [m1-045 handoff](../../../../milestones/m1-045-handoff.md) |
| **Branch / commit** | `docs/m1-044-mongodb-decisions` from `origin/main` `afd00a5`. Commit and push approved by the owner (D-GIT-42); PR opened by the owner |
| **Related** | D-DB-7 · D-DB-9 · D-DB-10 · D-DB-11 · D-GIT-41 · D-GIT-42 (new) · [hardening runbook](../../../../runbooks/server-hardening-and-patching.md) · [single-container runbook](../../../../runbooks/docker-single-container.md) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Task choice and all three decisions: owner, in session (see the prompt record).
- Precondition: PRs #45 and #46 are merged. The five hosted CI checks (secrets, lint, audit, test,
  build) completed with `success` on `afd00a5`, read through the public GitHub API (`gh` is not
  installed).
- No package, lockfile, `.env`, Docker file, volume, account or production system was changed.

## Decisions recorded

| ID | Decision | Owner's answer (2026-11-06) | Agent suggestion followed? |
|---|---|---|---|
| Runbook §12 choice 6 | MongoDB version for staging and production | **8.0.x**, at 8.0.34 or newer | Yes |
| Runbook §12 choice 7 | `javascriptEnabled: false` | **On** | Yes |
| D-DB-10 (b) | How staging and production run | **One container** for the app and MongoDB: "same container i would suggest" | No: the agent suggested separate containers |

## What the decisions rest on

- **Choices 6 and 7:** the m1-043 suites passed on MongoDB 8.0.34 with `javascriptEnabled: false`,
  and browser search through `$text` worked. `linux/arm64` ran under emulation only.
- **D-DB-10 (b):** the owner asked what the local Docker test had covered before deciding. It covered
  one container on the owner's PC. Neither that design on a server nor separate containers has been
  tested.

## Consequences of one container

These are the agent's assessment. None was tested in this task.

- **The m1-043 image is not ready for staging.** Its first start seeds demo content and falls back to
  the password `admin` (`docker/entrypoint.sh`). It has no database TLS, no x.509 and no backup tool.
  D-DB-11 still limits the default password and demo content to demo and test use.
- **The app and MongoDB fail, restart and patch together.** An app update or a MongoDB patch restarts
  both, so each causes a short outage. This is the risk of the choice the owner accepted over separate
  containers.
- **Backups need a design.** The continuous backup tool for the 15-minute RPO (D-DB-4) has to reach
  MongoDB inside the container, or run in it. It has not been chosen.
- **Docker's published ports go around a server's firewall** (m1-041). Keep the app port on
  `127.0.0.1` behind nginx, and MongoDB unpublished, as in the m1-043 Compose file.

## Work completed

| Item | Result |
|---|---|
| Hardening runbook | Status, §6, §7 and §12 updated. §6 and §7 are marked for rewriting; they were not rewritten |
| Single-container runbook | Scope line updated; first-start limit added to §5 |
| OCI test guide | Two notes updated; its test design is unchanged |
| Register | D-DB-7, D-DB-9, D-DB-10 and D-DB-11 updated; D-GIT-41 marked merged; D-GIT-42 new |
| Indexes | Runbooks README and INDEX (runbook rows, task row, next free ID) |
| Index correction | The single-container runbook row was in INDEX's task table by mistake (m1-043). Moved to the runbook table |
| Records | This report, the prompt record and the m1-045 handoff |

## Files changed

- A `docs/engineering/prompts/2026/11/2026-11-06-m1-044-mongodb-decisions.prompt.md`
- A `docs/engineering/reports/2026/11/2026-11-06-m1-044-mongodb-decisions.report.md`
- A `docs/milestones/m1-045-handoff.md`
- M `docs/engineering/INDEX.md`
- M `docs/engineering/decision-register.md`
- M `docs/runbooks/README.md`
- M `docs/runbooks/docker-single-container.md`
- M `docs/runbooks/project-test-on-oci-docker.md`
- M `docs/runbooks/server-hardening-and-patching.md`

## Tests executed and actual results

Server: `node --env-file=.env app` on port 3000 (SQLite; `.env` unchanged), started and stopped by
the agent.

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Lint | `npm run lint` | Exit 0 | PASS |
| Smoke | `npm run test:smoke` | 18/18 | PASS |
| Workflow | `npm run test:workflow` | 15/15 | PASS |
| Persistence | `npm run test:persistence`, same server, without a restart | 7/7 | PASS |
| One container on a server | — | Not run | NOT TESTED |
| Database TLS and x.509 | — | Not run | NOT TESTED |

No suite ran against MongoDB in this task, and the docs changes do not affect the code. The MongoDB
results are from m1-043.

### Browser acceptance

Claude in Chrome, owner's Chrome, dedicated tab group; logged out; agent-executed. No screenshots
were kept.

| # | Check | Role / viewport | Steps | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Public home page renders | logged out, default window | `http://127.0.0.1:3000/`; DOM read with JavaScript | title, H1, demo notice, no broken images, no horizontal overflow | Title "Home", H1 "Protection you can rely on", demo text present, 0 broken images, no overflow | PASS | none (DOM read) |
| 2 | No admin bar or user data when logged out | logged out | same page; check for admin-bar elements and a `"user":{` object in the HTML | neither present | neither present | PASS | none |
| 3 | Editor flows, 1440/768/375 layouts | — | — | — | Docs-only task; no template, layout or content change | NOT TESTED (not applicable) | — |

## Security observations

- The `admin` fallback in the entrypoint is safe only while the site is private. It must be gone
  before the image reaches a shared or public site (D-DB-11).
- MongoDB and the app share one container, so a compromise of the app is closer to the database and
  its secrets volume than with separate containers. The m1-043 separate users limit this. They were
  checked for file permissions only.

## Unresolved decisions

- Where nginx runs: on the host or in its own container.
- MongoDB dashboard: tool not chosen, and direct CRUD conflicts with ADR-0002.
- The backup tool.
- D-DB-2, D-DB-3, D-DB-7: still waiting for the DPO's answer to I1.
- D-GIT-42: approved; the owner opens the PR.

## Rollback guidance

Docs only. Revert the commit; no data or configuration changed. To change a decision, the owner says
so and a new note is added to the register row.

## Cleanup

The agent's server on port 3000 was stopped, its log files were removed and the Chrome tab was closed.
The suites wrote their usual test records to the local SQLite database. Container `assurer-site-1`
from m1-043 was not touched and stays running on `http://localhost:3042`.

## Recommended next step

The owner opens and merges the PR. A new session then starts from the
[m1-045 handoff](../../../../milestones/m1-045-handoff.md).
