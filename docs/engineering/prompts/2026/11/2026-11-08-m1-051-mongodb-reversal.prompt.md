# Prompt — m1-051: back to MongoDB (D-DB-13 reversed) and a load test against it

| | |
|---|---|
| **Task** | m1-051 |
| **Date** | 2026-11-08 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

start m1-051 in a fresh session with the prompt at the end of docs/milestones/m1-051-handoff.md. It proposes how the project carries the adapter fix until upstream ships it. One way is patch-package, which is a new dependency and needs your approval.

---

**In-session decisions (2026-11-08, owner):**

1. The agent read the [m1-051 handoff](../../../../milestones/m1-051-handoff.md), checked that PR #53
   is merged (`f81cedb`) and its five CI checks are green, and asked three questions. The owner chose:
   - Upstream issue: "Filed" (no URL given yet).
   - Carry fix: no option chosen; the owner asked: "I don't have any idea, what adapter issues arise?"
   - Scope: "Fix only, then decide".

2. The agent explained the adapter problem and the three ways to carry the fix (a vendored adapter
   through `@apostrophecms/db`'s `adapters` option, `patch-package`, or an SQL-rewrite wrapper). The
   owner wrote:

   > so, apostrophe if actually built for mongodb - then i would suggest and reccomend please go with mongodb community edition with same docker contianer for assurer project.

3. The agent listed what the reversal brings back and asked, naming it an architecture gate. The
   owner chose:
   - "Yes, MongoDB (Rec.)": D-DB-13 reversed; MongoDB Community Edition 8.0.x in one container with
     the app (D-DB-8, D-DB-10 (b)).
   - m1-051: "Record + load test (Rec.)": record the decision, then run the m1-050 load test against
     MongoDB 8.0 on a disposable copy, with the image and tool use approved at that step.

4. The owner approved the image build and the disposable test run: "Approve (Rec.)". The issue URL
   answer was "In notes", but no URL came through.

5. The agent reported the results and asked to commit and push (D-GIT-49). The owner wrote:

   > please commit and push

6. After the push, the owner wrote:

   > please clean all image and container and stop dev server

   The agent removed the m1-051 test items and stopped the server, then listed what else "all" would
   remove (including the demo site's data). The owner chose "Everything". For the follow-up commit
   updating the clean-up records, the owner wrote:

   > i approve
