# Prompt — m1-054: cluster mode on the MongoDB load test

| | |
|---|---|
| **Task** | m1-054 |
| **Date** | 2026-11-08 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

Start m1-054. Read AGENTS.md and docs/milestones/m1-054-handoff.md first, confirm the task with me,
follow the gates, and stop for approval before any commit or push.

---

**In-session decisions (2026-11-08, owner):**

1. The agent confirmed the precondition (PR #56 merged as `bb76ac0`; hosted CI still running at
   that moment) and recommended candidate 1, cluster mode on the MongoDB load test, which also
   measures the m1-053 menu change on MongoDB. The owner wrote:

   > go with your recommendation

2. The agent made the load-test changes, then asked for approval of (1) cluster mode through
   `APOS_CLUSTER_PROCESSES` in the disposable load-test compose only, (2) building
   `assurer-site:load-test-mongo` from the unchanged root Dockerfile with the same pinned base
   images, (3) the runs (one process and 2 workers at 8 readers twice each, 2 workers at 4 readers,
   optionally 4 workers at 8 readers), and (4) the suites and a Chrome check on the cluster
   container, then `docker compose … down -v`. The owner wrote:

   > approve

3. The agent reported the results and asked the owner to decide D-GIT-52 (commit and push). The owner wrote:

   > commit and push all
