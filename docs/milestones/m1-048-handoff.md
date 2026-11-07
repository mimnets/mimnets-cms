# m1-048 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-07, by the agent at the end of m1-047 (agent-executed; not a human approval) |
| **Task** | `m1-048`: local proof of concept of SQLite with Litestream (D-DB-13), as the owner chose in m1-047 |
| **Preconditions** | The m1-047 PR is merged (D-GIT-45) and its hosted CI checks are green |
| **Branch** | `test/m1-048-litestream-poc` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-4, D-DB-13) · [m1-047 options paper](./m1-047-sqlite-production-options.md) (§4, §7) · [m1-047 report](../engineering/reports/2026/11/2026-11-07-m1-047-sqlite-production-option.report.md) |

## 1. Carry-over

- **D-DB-13:** SQLite with Litestream for staging and production, subject to this test. MongoDB
  (D-DB-8) is superseded; PBM (D-DB-12) and D-SEC-5 are on hold.
- **Docker:** the owner keeps both ways: a Docker Compose setup and a plain systemd setup. Every image
  supports `linux/amd64` and `linux/arm64` (owner's rule, m1-046).
- **Dashboard:** both layers approved in principle (paper §4.6). Build layer 1 after this test.
  `@apostrophecms/import-export` and Datasette still need the dependency gate.
- **Still to write:** the ADR-0002 amendment or a new ADR for D-DB-13, and the superseded notes on the
  hardening runbook §6 and §7 and the single-container runbook.
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO's answer to I1. The EU-only bucket question is
  unchanged.

## 2. The test

Paper §7, checks P1–P7: Litestream replicating to a **local directory** (`file://`), in WSL2 on the
owner's PC with the database on the Linux file system, or in Docker Compose. Disposable copy of the
local database only. Include the settings checks from paper §4.5 (WAL growth, missed frames,
`apos-db-restore`'s `TRUNCATE` checkpoint).

## 3. Gates

- Installing Litestream needs the owner's approval, with the license (Apache-2.0) and advisory checks.
  Pin a version (v0.5.18 or later; recheck the release date).
- No S3 account, spending, server or registry push without explicit owner approval.
- A restore goes only into a new, empty path, never over the live file.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-048. Read AGENTS.md and docs/milestones/m1-048-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
