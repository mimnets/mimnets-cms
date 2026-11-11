# m1-068 — Prompt

Owner's request, verbatim (2026-11-11, new session):

> Start m1-068. Read AGENTS.md and docs/milestones/m1-068-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.

The task is the item of the [m1-068 handoff](../../../../milestones/m1-068-handoff.md): the release
pipeline (D-DB-21) and one container per service in one Compose stack (D-DB-20), design note first.

## Further requests and answers in the same session (verbatim, in order)

- "yes, go ahead with the design note" (to the agent's confirmation of the task)
- Design note, §11 questions 1 to 4: "Approve all (Recommended)" (D-DB-22)
- To the project name clash with the demonstration stack (options `assurer-site` or renaming the demo): "mimnets-cms"
- ADR-0004 Amendment 1: "Accept (Recommended)" (D-DB-23)
- D-SEC-10: "Accept until fixed (Recommended)"
- Commit and push: "Commit and push (Recommended)" (D-GIT-72)
- After the merge: "i have login with github classic token here now what?"; the first release push had failed ("unknown blob"). Fix: "Flatten + retry (Recommended)"; commit and push: "Commit and push (Recommended)" (D-GIT-73)
- "i don't see the runbook 12.3 where actually it is?" … "but i don't see any command written like this … on the runbook" … "i approve" (D-GIT-74: §12.3 with the exact commands)
