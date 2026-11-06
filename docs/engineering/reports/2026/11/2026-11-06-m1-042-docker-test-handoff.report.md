# m1-042 — Docker direction, OCI test guide and handoff for the local Docker test

| | |
|---|---|
| **Task** | m1-042 |
| **Date** | 2026-11-06 |
| **Scope** | Owner's questions on hosting and database options; approval of Docker and MongoDB 8.0.x for a test; a guide for installing and testing the project on the owner's OCI server; a handoff for the local Docker test. Docs only. **No suite ran against MongoDB** |
| **Prompt** | [2026-11-06-m1-042-docker-test-handoff.prompt.md](../../../prompts/2026/11/2026-11-06-m1-042-docker-test-handoff.prompt.md) |
| **Handoff** | [m1-042 start handoff](../../../../milestones/m1-042-handoff.md) · next: [m1-043 handoff](../../../../milestones/m1-043-handoff.md) |
| **Branch / commit** | `docs/m1-042-docker-test-handoff` from `origin/main` `598f1da` (m1-041 merged as PR #44). Commit and push approved by the owner (D-GIT-40); PR opened by the owner |
| **Related** | D-DB-8 · D-DB-9 · D-DB-10 (new) · D-GIT-39 · D-GIT-40 (new) · [OCI test guide](../../../../runbooks/project-test-on-oci-docker.md) (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Task and direction: owner, in session (see the prompt record).
- Docker Engine and MongoDB 8.0.x for the check: owner ("approve, run the test on this PC").
- ZIP run, then its replacement by the owner's own WSL and Docker install: owner (prompt, items 5
  and 6).
- Precondition: PR #44 is merged into `main` as `598f1da`. The five hosted CI checks (lint, secrets,
  audit, build, test) completed with `success` on that commit, read through the public GitHub API
  (`gh` is not installed).
- No package, lockfile, `.env`, project database, account or production system was changed. Nothing
  was posted anywhere. Docker and WSL were not installed.

## Findings

| # | Finding | How found |
|---|---|---|
| 1 | Port 27017 on the OCI server gave **no response** from this PC (8-second timeout). The m1-041 exposure is no longer reachable from here. This does not show that access control is on, or how the container is bound | Read-only TCP check from this PC; the owner reported it closed. The address is not recorded |
| 2 | This PC has no Docker, no WSL, no `mongod` and no `mongosh`. It has 16 GB RAM, about 259 GB free on `C:`, and Node v24.21.0 | Local read-only checks |
| 3 | The current stable MongoDB line is 9.0. The newest 8.0 release that could be downloaded is **8.0.34** (released 13 October 2026); 8.0.35 and 8.0.36 were not available | MongoDB release notes; HEAD requests to MongoDB's download server |
| 4 | MongoDB Community uses the SSPL (since October 2018), so it is source-available, not OSI-approved open source | MongoDB license page and history |
| 5 | MongoDB 8.0 before 8.0.30 has a critical flaw that can leave authorization off at startup (CVE-2026-82067, severity 9.2). 8.0.32 and 8.0.34 list more security fixes. Only the first part of the long alerts page was read, so 9.0.4 was **not** cleared | MongoDB security alerts; 8.0 release notes |
| 6 | `mongo:8.0.34`, `mongodb/mongodb-community-server:8.0.34-ubuntu2204` and `node:24-bookworm` exist for amd64 and arm64 | Docker Hub API |
| 7 | FerretDB 2.7 (Apache 2.0) lists transactions as not implemented, and its compatibility page does not mention `$text`, which Apostrophe's search uses. A quick search of Apostrophe's server modules found no transactions (not a full check). Apostrophe's docs list MongoDB, PostgreSQL and SQLite only. Not tested | FerretDB and Apostrophe docs; search in `node_modules/apostrophe/modules` |
| 8 | Percona Server for MongoDB is source-available and adds encryption at rest and auditing. Its version match with the driver was not checked | Percona's product page |
| 9 | Hostinger's shared plans offer MySQL only (MongoDB and PostgreSQL need a VPS), and their Node.js apps have a 120-second request limit and no always-running background workers. Shared hosting does not meet the project's needs. Not tried | Hostinger's support pages |
| 10 | Docker Engine is Apache 2.0. Docker Desktop is free only for a company under 250 employees and under $10 million annual revenue. The owner's company size was not confirmed | Docker's documentation and licensing guides |
| 11 | No `NEON_*` line remains in `.env`, so that carry-over may already be done. Whether the Neon API key was revoked is not known | Variable names only; values not read |

## Decisions recorded

| ID | Decision | Owner's answer (2026-11-06) | Agent suggestion followed? |
|---|---|---|---|
| D-DB-10 | Docker for the MongoDB test and the later stack | Test: Docker Engine and MongoDB 8.0.x approved, on this PC, with the owner installing WSL and Docker. Staging and production: **open** | Partly: the agent suggested the ZIP for this test, and the owner chose Docker |

D-DB-8 is unchanged: MongoDB on Hetzner. The owner's questions about Supabase, Hostinger and FerretDB
were answered in session and changed no decision. Runbook §12 choices 6 and 7 stay **open**.

## Work completed

| Item | Result |
|---|---|
| OCI guide | [project-test-on-oci-docker.md](../../../../runbooks/project-test-on-oci-docker.md), **draft, not yet executed** |
| Handoff | [m1-043 handoff](../../../../milestones/m1-043-handoff.md), with the owner's WSL and Docker steps and the test plan |
| Register | D-DB-10 new; D-GIT-39 marked merged; D-GIT-40 new |
| Indexes | Runbooks README and INDEX (runbook row, task row, next free ID) |
| Records | This report and the prompt record |

## Files changed

- A `docs/engineering/prompts/2026/11/2026-11-06-m1-042-docker-test-handoff.prompt.md`
- A `docs/engineering/reports/2026/11/2026-11-06-m1-042-docker-test-handoff.report.md`
- A `docs/milestones/m1-043-handoff.md`
- A `docs/runbooks/project-test-on-oci-docker.md`
- M `docs/engineering/decision-register.md`
- M `docs/engineering/INDEX.md`
- M `docs/runbooks/README.md`

## Tests executed and actual results

Server: `node --env-file=.env app` on port 3000 (SQLite; `.env` unchanged), started and stopped by
the agent.

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Lint | `npm run lint` | Exit 0, no errors or warnings | PASS |
| Smoke | `npm run test:smoke` | 18/18 | PASS |
| Workflow | `npm run test:workflow` | 15/15 | PASS |
| Persistence | `npm run test:persistence`, same server | 7/7 | PASS |
| Suites against MongoDB | — | Not run. The ZIP run stopped before `mongod` started, because the agent's setup script stopped on an OpenSSL message. The owner then chose Docker | NOT TESTED |
| `javascriptEnabled: false` (choice 7) | — | Not run | NOT TESTED |
| OCI guide | — | Written, not executed. Its commands, including the image entrypoint's handling of `bindIp`, are unverified | NOT TESTED |

The download of MongoDB 8.0.34 for Windows matched its published SHA-256 and reported `v8.0.34`. It
was deleted without being used as a server.

### Browser acceptance

Claude in Chrome, owner's Chrome, dedicated tab group; logged out; agent-executed.

| # | Check | Role / viewport | Steps | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Public home page renders | logged out, default window | `http://127.0.0.1:3000/`; DOM read with JavaScript | title, H1, demo notice, no horizontal overflow | Title "Home", H1 "Protection you can rely on", demo notice present, no overflow | PASS | none (DOM read) |
| 2 | No admin bar or user data when logged out | logged out | same page; check for admin-bar elements and a `"user":{` object in the HTML | neither present | neither present | PASS | none |
| 3 | Editor flows, 1440/768/375 layouts | — | — | — | Docs-only task; no template, layout or content change | NOT TESTED (not applicable) | — |

## Security observations

- The OCI exposure from m1-041 is no longer reachable from this PC (finding 1). The port check was
  the only contact with the server in this task. The agent's key is still on the server.
- MongoDB 9.0.4 on that server was not cleared against the 2026 advisories (finding 5). Check it
  before reusing it.
- The OCI guide avoids Docker's published ports entirely, because they go around the server's
  firewall rules. It also checks that both services listen on loopback only, and that MongoDB refuses
  anonymous access.
- The throwaway secrets generated for the ZIP run were never used by a database, and were deleted
  with the scratch folder.

## Unresolved decisions

- Runbook §12 choices 6 and 7: wait for the m1-043 test run.
- D-DB-10: Docker for staging and production. The hardening runbook assumes systemd today.
- D-DB-2, D-DB-3, D-DB-7: still waiting for the DPO's answer to I1.
- Tool approvals: nginx, an ACME client, the backup tool, the media copy tool, the Node.js source,
  the uptime service; MongoDB Compass if wanted. Running the OCI guide needs separate approval.
- D-GIT-40: approved; the owner opens the PR.

## Rollback guidance

Docs only. Revert the commit; no data or configuration changed.

## Cleanup

The agent's server on port 3000 was stopped and the Chrome tab was closed. The scratch folder (ZIP,
`mongod`, secrets) was removed, and no `mongod` process remains. No test account or test content was
created beyond what the suites write on every run to the local SQLite database.

Left over, for the owner: the agent's key line in the OCI server's `authorized_keys` (see the m1-043
handoff, §4).

## Recommended next step

The owner installs WSL and Docker, then starts a new session for the MongoDB test run
([m1-043 handoff](../../../../milestones/m1-043-handoff.md)).
