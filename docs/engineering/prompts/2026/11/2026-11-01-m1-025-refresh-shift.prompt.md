# Prompt — m1-025: One-frame shift on refresh

| | |
|---|---|
| **Task** | m1-025 |
| **Date** | 2026-11-01 |
| **Source** | Repository owner, typed into a new Claude Code session. Recorded as given; nothing redacted (the prompt contains no secrets). Owner replies are quoted as given unless noted. |

---

Start m1-025. Read AGENTS.md and docs/milestones/m1-025-handoff.md first, confirm the task with me, follow the gates, and stop for approval before any commit or push.

---

**In-session decisions and messages (2026-11-01, owner):**

1. Task: "option 1" (the one-frame shift on refresh). Branch `fix/m1-025-refresh-shift`.
2. Answers to the agent's questions (multiple choice): the shift also shows in Chrome ("Chrome
   too"); whether the page was scrolled before the refresh: "Don't know"; hosted CI on PR #27:
   "All green".
3. Further answers (multiple choice): signed in when the shift shows: "Both"; the owner would
   supply the m1-024 GIF again: "I'll give the path".
4. The owner gave the path of the second m1-024 GIF (a local file outside the repository; copied
   to the agent's scratch directory only, not into the repository).
5. Mid-task message, recorded as given except that the local file path is replaced by
   `<screenshot>`: "`<screenshot>` and also check this image where - acceptance test is above home
   same for all other navigation". The screenshot shows the breadcrumbs, with "Acceptance Test"
   (current page) set higher than the "Home" link.
6. Closing message, recorded as given: "i approve" (answer to the agent's request to commit, push
   and open the PR).
