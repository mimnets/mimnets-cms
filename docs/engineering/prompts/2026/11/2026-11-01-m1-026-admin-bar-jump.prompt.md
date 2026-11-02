# Prompt — m1-026: Admin bar jump on signed-in page loads

| | |
|---|---|
| **Task** | m1-026 |
| **Date** | 2026-11-01 |
| **Source** | Repository owner, typed into a new Claude Code session. Recorded as given; nothing redacted (the prompt contains no secrets). Owner replies are quoted as given unless noted. |

---

start from -  docs/milestones/m1-026-handoff.md

---

**In-session decisions and messages (2026-11-01, owner):**

1. Answers to the agent's questions (multiple choice): task "Admin bar jump"; hosted CI on PR #28:
   "Yes, all green". Branch `fix/m1-026-admin-bar-jump`.
2. The agent described the only supported way it found: a body class set by the server and a CSS
   rule that reserves the bar's height while the mount element is empty, with the heights copied
   from core. It asked whether to hard-code both heights, the top row only, or change nothing.
   Owner reply, recorded as given: "i don't know - you decide which one would be the write
   decision!" The agent chose both heights (see the report, "Approvals used").
3. Closing message, recorded as given: "i approve" (answer to the agent's request to commit, push
   and open the PR).
