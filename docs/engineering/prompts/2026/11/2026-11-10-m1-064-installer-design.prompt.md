# Prompt — m1-064: an interactive installer for the stack on a server

| | |
|---|---|
| **Task** | m1-064 |
| **Date** | 2026-11-10 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

Start m1-064. Read AGENTS.md and docs/milestones/m1-064-handoff.md first, confirm the task with me,
follow the gates, and stop for approval before any commit or push.

---

**In-session decisions (owner):**

1. The agent reported that PR #73 was merged (`4544d1d`). `staging-arm64`, lint, test, audit, secrets
   and build were green on `7201a1e`, the last PR commit that touched `docker/staging/`. On the merge
   commit, all five checks (secrets, lint, audit, test, build) later passed. The agent read these results from the
   GitHub API, because `gh` is not installed on this PC. Of the four candidates in the m1-064 handoff
   §2, the owner chose: **"Installer design (Recommended)"**.
2. The agent wrote the design ([m1-064 paper](../../../../milestones/m1-064-installer-design.md)) and asked
   D-DB-18. The owner chose: **"Approve as written (Recommended)"**. The agent builds the script and the
   runbook section in this task, with local tests, and stops before any commit or push.
3. During the build the owner added, for later: **"please add an additional features which is not
   related i beleive - but for automation - can we have anything with a local ai agents to run and
   implements the vps server updates along with docker and docker contianer images updates regularly -
   please add into plan and memory for later discuss and plan and implement with your feedback and
   suggestions."** The agent adds it as a candidate in the next handoff, for a design first. It is not
   part of m1-064.
4. The owner's editor closed during the build. In a new session the owner asked: **"accidentally
   closed the vs code - can you check where we left?"** The agent listed what was done and what was
   left (runbook §10, local tests, records, approval before commit), and asked whether to continue.
   The owner replied: **"yes"**.
