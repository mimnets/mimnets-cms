# m1-049 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-07, by the agent at the end of m1-048 (agent-executed; not a human approval) |
| **Task** | `m1-049`: D-DB-13 condition 1, the `apos-db-dump` problem on a database that Litestream replicates ([m1-048 results §3.1](./m1-048-litestream-poc-results.md#31-apos-db-dump-stops-on-litestreams-tables)), as the owner chose: an upstream report and a project dump task |
| **Preconditions** | The m1-048 PR is merged (D-GIT-46) and its hosted CI checks are green |
| **Branch** | `feat/m1-049-dump-task` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-4, D-DB-13, D-SEC-6) · [m1-048 results](./m1-048-litestream-poc-results.md) (§3.1, §3.5) · [m1-048 report](../engineering/reports/2026/11/2026-11-07-m1-048-litestream-poc.report.md) |

## 1. Carry-over

- **D-DB-13:** SQLite with Litestream kept, with two conditions before staging: (1) the dump problem
  fixed; (2) a load test at the real site's expected size, with a p99 limit the owner agrees. The
  current WordPress site has 29 pages (m1-013 inventory).
- **D-SEC-6:** three high findings in Litestream 0.5.18 accepted until a fix; scan again before staging.
- **Page load time with many docs** (results §3.2): the SQLite adapter's queries cannot use an index,
  and the two-level menu loads every page in its two levels. Not a task yet; condition 2 decides it.
- **Media** is not in Litestream; the staging design needs the separate media copy (D-DB-4).
- Still to write: the ADR-0002 amendment or a new ADR for D-DB-13, and the superseded notes on the
  hardening runbook §6 and §7 and the single-container runbook.
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO's answer to I1.
- PoC images `assurer-site:litestream-poc` and `assurer-site:litestream-poc-arm64` are kept locally;
  their containers and volumes are removed.

## 2. The task

1. Draft the upstream issue text for `@apostrophecms/db-connect` (dump and restore treat
   `_litestream_seq` and `_litestream_lock` as collections). The owner files it; record the URL.
2. A project task, for example `node app assurer-backup:dump`, that writes the same NDJSON format as
   `apos-db-dump` but only for Apostrophe's collections, using the installed `db-connect` library
   (official APIs first; no new dependency). Exit code 0 only when every collection was written.
3. Test it on a disposable SQLite copy with Litestream tables (the m1-048 Compose setup can be
   rebuilt), and restore the result with `apos-db-restore` into a new, empty file only.
4. Check whether `apos-db-restore` clears Litestream's `_litestream_seq` (results §3.1, not confirmed).

## 3. Gates

- No new dependency without approval. Running the m1-048 test image again needs no new approval for
  Litestream (approved for local use), but any restore goes only into a new, empty path.
- Changing D-DB-4's "portable export" wording needs the owner.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-049. Read AGENTS.md and docs/milestones/m1-049-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
