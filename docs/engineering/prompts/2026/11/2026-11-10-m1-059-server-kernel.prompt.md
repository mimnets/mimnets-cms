# Prompt — m1-059: decide the server kernel (D-DB-16)

| | |
|---|---|
| **Task** | m1-059 |
| **Date** | 2026-11-10 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

start from handoff

---

**In-session decisions (owner):**

1. The agent reported that the m1-058 records PR (#65) was merged (`97451d6`) and that all six hosted
   checks on its head commit passed. Of the four candidates in the m1-059 handoff §2, the owner chose
   **"Server kernel (D-DB-16) (Recommended)"**: the paper part first; any run on a server needs its
   own approval.
2. The agent presented the [m1-059 paper](../../../../milestones/m1-059-server-kernel.md) and asked
   which kernel rule the staging stack follows. The owner chose **"A now, B later (Recommended)"**.
3. A read-only check of the owner's OCI server: **"Not now (Recommended)"**.
4. Commit and push this branch; the owner opens the PR: **"approve"**. Merge not included.
