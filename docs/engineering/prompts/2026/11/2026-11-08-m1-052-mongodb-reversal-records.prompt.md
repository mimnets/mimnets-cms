# Prompt — m1-052: records for the MongoDB reversal

| | |
|---|---|
| **Task** | m1-052 |
| **Date** | 2026-11-08 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

start for m1-052 with the prompt at the end of docs/milestones/m1-052-handoff.md

---

**In-session decisions (2026-11-08, owner):**

1. The agent read the [m1-052 handoff](../../../../milestones/m1-052-handoff.md) and the Git state.
   It reported that PR #54 is merged (`df69603`), but that two m1-051 commits pushed after the merge
   (`cc0f457`, `f106750`, the Docker clean-up record) are not on `main`. The agent recommended
   candidate 3 (records for the reversal) and carrying those two commits on the m1-052 branch. The
   owner wrote:

   > go with your recommendation

2. The agent asked two questions. The owner chose:
   - The m1-049 dump task: "Remove it (Recommended)".
   - The Litestream proof-of-concept files: "Keep, mark superseded (Recommended)".

3. The agent reported the results and asked the owner to decide D-DB-14 (accept ADR-0004) and
   D-GIT-50 (commit and push). The owner wrote:

   > accept and aprrove
