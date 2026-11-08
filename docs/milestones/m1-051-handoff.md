# m1-051 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-08, by the agent at the end of m1-050 (agent-executed; not a human approval) |
| **Task** | `m1-051`, recommended: the first part of "fix first" (D-DB-13, m1-050): the owner files the upstream db-connect issue, and the agent proposes, for approval, how the project carries the adapter fix until upstream ships it. The owner may pick another item from §1 instead |
| **Preconditions** | The m1-050 PR is merged (D-GIT-48) and its hosted CI checks are green |
| **Branch** | `fix/m1-051-sqlite-index-use` from `origin/main` after that merge (adjust the name if the owner picks another item) |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-4, D-DB-13, D-SEC-6, D-SEC-7) · [m1-050 results](./m1-050-load-test-results.md) §3–§5 and §7 · [m1-050 report](../engineering/reports/2026/11/2026-11-08-m1-050-load-test.report.md) |

## 1. Carry-over

- **D-DB-13 condition 2 failed** (m1-050). Owner: "Keep SQLite, fix first". Before staging: (a) the
  adapter fix, (b) a lighter menu query, (c) a retest at the agreed size and limit. A page cache or a
  profile change is looked at only after (c).
- **Upstream issue** drafted in the [m1-050 results §5](./m1-050-load-test-results.md#5-upstream-issue-draft-not-filed);
  the owner files it, and the URL is recorded there and in D-DB-13. The m1-049 dump issue
  ([m1-049 results §5](./m1-049-dump-task-results.md#5-upstream-issue-draft-not-filed)) is also still unfiled.
- **D-DB-13 condition 1** is met locally (m1-049).
- **D-SEC-6:** three high findings in Litestream 0.5.18 accepted until a fix; scan again before staging.
- Still to write: the ADR-0002 amendment or a new ADR for D-DB-13; the superseded notes on the
  hardening runbook §6 and §7 and the single-container runbook; the backup runbook's mention of the
  dump task; the media copy for staging (D-DB-4).
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO's answer to I1.
- Images `assurer-site:litestream-poc` and `-arm64` are kept locally. No test containers or volumes
  remain.

## 2. The task (recommended)

1. Ask the owner whether the issue is filed, and record its URL.
2. Propose how to carry the fix in the project until upstream ships it, with costs: for example
   `patch-package` (a new dependency, so the dependency gate applies), or another way the owner
   prefers. The m1-050 measurement patch (results §3.3) is the starting point: scalar core fields skip
   the array branch. A real patch needs unit tests that compare results with and without it.
3. After approval only: implement it, run all suites, and check the query plans use the indexes.
4. Item (b), the lighter menu query in `views/layout.jsx`, and item (c), the retest with
   `scripts/load-test.mjs`, can follow in the same task or the next, as the owner picks.

## 3. Gates

- No new dependency, load tool or image without approval. A disposable copy only for load tests.
- Changing D-DB-4 or D-DB-13 needs the owner.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-051. Read AGENTS.md and docs/milestones/m1-051-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
