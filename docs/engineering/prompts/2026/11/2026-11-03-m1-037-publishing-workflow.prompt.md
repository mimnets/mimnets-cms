# Prompt — m1-037: publishing workflow, review before publish (D-CONTENT-11 option B)

| | |
|---|---|
| **Task** | m1-037 |
| **Date** | 2026-11-03 |
| **Source** | Repository owner, typed into a new Claude Code session. Recorded as given; nothing redacted (the prompts contain no secrets). Owner replies are quoted as given. |

---

start from  docs/milestones/m1-037-handoff.md

---

**In-session decisions (2026-11-03, owner):**

1. The agent read the m1-036 merge (`7baec46`, PR #39) and its CI checks through the public GitHub
   API (4 of 5 still running at first, then 5 of 5 green). It asked two multiple-choice questions:
   which handoff candidate to do, and how many approvals a change needs. The owner answered:

   > D-CONTENT-11 option B (Recommended)

   > One editor or admin (Recommended)

2. The suite showed that core deletes a published document's draft before it refuses a
   contributor's delete of the published copy. The agent asked how to handle it (project guard,
   known limitation only, or stop). The owner answered:

   > Add a project guard (Recommended)

3. After the final summary, the agent asked for approval to commit and push (D-GIT-35). The owner
   answered (2026-11-04):

   > i approve all
