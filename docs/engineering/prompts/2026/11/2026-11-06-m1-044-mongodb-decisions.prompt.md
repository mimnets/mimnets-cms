# Prompt — m1-044: MongoDB version, server-side JavaScript and the container decision

| | |
|---|---|
| **Task** | m1-044 |
| **Date** | 2026-11-06 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

start from m1-044

---

**In-session decisions (2026-11-06, owner):**

1. The agent listed the handoff's candidates and recommended settling the MongoDB decisions. The
   owner chose "Settle MongoDB decisions (Recommended)".

2. The agent asked for the three decisions, each with its suggestion. The owner chose
   "8.0.x (Recommended)" for hardening runbook §12 choice 6 and "On, JavaScript disabled
   (Recommended)" for choice 7. The agent suggested separate containers for D-DB-10 (b). In place of
   an option, the owner asked:

   > in the local docker what you have tested?

3. The agent answered that m1-043 tested one container holding the app and MongoDB, on the PC only,
   and listed what was not tested. It said its suggestion of separate containers was a judgement, not
   a test result, and offered separate containers, systemd and packages, or leaving it open. The owner
   replied:

   > same container i would suggest
