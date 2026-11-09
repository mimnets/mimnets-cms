# Prompt — m1-057: decide the remaining staging findings

| | |
|---|---|
| **Task** | m1-057 |
| **Date** | 2026-11-09 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

Start m1-057. Read AGENTS.md and docs/milestones/m1-057-handoff.md first, confirm the task with me,
follow the gates, and stop for approval before any commit or push.

---

**In-session decisions (owner):**

1. The agent reported that PR #59 was merged (`062b0fd`, hosted `test` check still running; all five
   green before the branch was made) and advised taking candidate 2 before candidate 1, because a
   changed image would repeat the `arm64` proof. The owner chose **"Decide findings (Recommended)"**.
2. `async` (2) and `x/net` in `mongodump` and `bsondump` (1): **"Not affected (Recommended)"**.
3. `apt` 2.8.3: **"Pinned upgrade (Recommended)"**.
4. nginx: **"Remove libxml2, accept musl (Recommended)"**.
5. certbot (13): **"Accept, rescan (Recommended)"**.
