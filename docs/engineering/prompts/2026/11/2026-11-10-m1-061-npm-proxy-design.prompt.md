# Prompt — m1-061: the staging stack behind Nginx Proxy Manager (design)

| | |
|---|---|
| **Task** | m1-061 |
| **Date** | 2026-11-10 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

Start m1-061. Read AGENTS.md and docs/milestones/m1-061-handoff.md first, confirm the task with me,
follow the gates, and stop for approval before any commit or push.

---

**In-session decisions (owner):**

1. The agent reported that PR #67 was merged (`65e8f6b`) and that it could not read the hosted checks,
   because `gh` is not installed in the session's shell. Of the four candidates in the m1-061 handoff
   §2, the owner chose: **"NPM design paper (Recommended)"** (candidate 2).
2. The agent found that the m1-060 records commit `0dc9ce2` (report, prompt, INDEX, register, runbooks,
   m1-061 handoff) was committed after PR #67 was merged and is not on `main`. The owner chose **"Base
   m1-061 on it (Recommended)"**: the m1-061 branch starts from `origin/ci/m1-060-arm64-checks`, so its
   PR carries the m1-060 records into `main` as well.
3. D-DB-17 (paper §7): **"A for real, B for shared hosts (Recommended)"**.
4. Commit and push: **"yes, commit and push"** (D-GIT-59). The owner opens the PR.
