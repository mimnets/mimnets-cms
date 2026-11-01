# Prompt — m1-024: Problem on page refresh

| | |
|---|---|
| **Task** | m1-024 |
| **Date** | 2026-11-01 |
| **Source** | Repository owner, typed into a new Claude Code session. Recorded as given; nothing redacted (the prompt contains no secrets). Owner replies are quoted as given unless noted. |

---

Start m1-024. Read AGENTS.md and docs/milestones/m1-024-handoff.md first, confirm the task with me, follow the gates, and stop for approval before any commit or push.

---

**In-session decisions and messages (2026-11-01, owner):**

1. Task: "Go ahead with option 1" (the problem on page refresh, recommended by the agent; the
   other two candidates need owner or DPO content). Branch `fix/m1-024-refresh-flash`.
2. Mid-task message: "for your info - this issue perist even no signed in".
3. The agent reported that a production build shows neither the flash nor the fade and asked
   whether to record only, add a small hardening, or turn off dev HMR. The owner answered:
   "nothing fix, i can still see the issues are there when i refresh the localhost:3000 it shows a
   broken stkeleton of the html links on the left side which i shared on the gif file." The agent
   read this as: fix it on the development server too.
4. Mid-task message: "no, no not skelton - i can't express the issue proerly. do you need the gif
   file agian to check?"
5. The owner supplied two local GIFs (paths outside the repository; not copied into it) and
   wrote: "I think it's now quite okay - but when reresh frequently it acting kind of similar
   thing. please check the second gif."
6. Closing message, recorded as given: "approved — commit, push and open the PR".
