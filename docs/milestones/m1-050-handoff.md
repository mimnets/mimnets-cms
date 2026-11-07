# m1-050 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-07, by the agent at the end of m1-049 (agent-executed; not a human approval) |
| **Task** | `m1-050`, recommended: D-DB-13 condition 2, a load test at the real site's expected size with a p99 limit the owner agrees. The owner may pick another item from §1 instead |
| **Preconditions** | The m1-049 PR is merged (D-GIT-47) and its hosted CI checks are green |
| **Branch** | `test/m1-050-load-test` from `origin/main` after that merge (adjust the name if the owner picks another item) |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-4, D-DB-13, D-SEC-6, D-SEC-7) · [m1-048 results](./m1-048-litestream-poc-results.md) §3.2 and P6 · [m1-049 results](./m1-049-dump-task-results.md) · [m1-049 report](../engineering/reports/2026/11/2026-11-07-m1-049-dump-task.report.md) |

## 1. Carry-over

- **D-DB-13 condition 1 is met locally** by `node app assurer-backup:dump` (m1-049). The upstream issue
  is drafted in the [m1-049 results §5](./m1-049-dump-task-results.md#5-upstream-issue-draft-not-filed);
  the owner files it and the URL is recorded there and in D-DB-13.
- **D-DB-13 condition 2** is open: a load test at the real site's expected size, with a p99 limit the
  owner agrees. The current WordPress site has 29 pages (m1-013 inventory). m1-048 measured about
  0.5 s per request with 1,000 pages, because the SQLite adapter's queries cannot use an index and the
  two-level menu loads every page in its two levels (results §3.2).
- **Old `apos-db-dump` files** from a Litestream-replicated database carry a `_litestream_seq` header.
  Restoring one recreates that table as a collection, and Litestream's checkpoints then fail while
  `litestream status` says `ok` (m1-049 results §4). Use the new task for dumps.
- **D-SEC-6:** three high findings in Litestream 0.5.18 accepted until a fix; scan again before staging.
- **Media** are not in any database dump or in Litestream; the staging design needs the separate media
  copy (D-DB-4). The backup runbook does not mention the dump task yet.
- Still to write: the ADR-0002 amendment or a new ADR for D-DB-13, and the superseded notes on the
  hardening runbook §6 and §7 and the single-container runbook.
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO's answer to I1.
- PoC images `assurer-site:litestream-poc` (rebuilt in m1-049) and `-arm64` are kept locally. Their containers and
  volumes are removed.

## 2. The task (recommended)

1. Agree with the owner the expected size (pages, pieces, versions) and the p99 limit, before any run.
2. Build that content on a disposable copy, through Apostrophe's APIs only, and measure page requests
   and event-loop delay as in m1-048 P6.
3. If the limit is missed, report the cause and options (for example a menu that does not load every
   page, or an upstream index change); any code change is its own approval.

## 3. Gates

- No new dependency, load tool or image without approval. A disposable copy only; restores into new,
  empty paths only.
- Changing D-DB-4 or D-DB-13 needs the owner.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-050. Read AGENTS.md and docs/milestones/m1-050-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
