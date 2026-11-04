# Prompt — m1-040: owner's answers to the hardening runbook §12 choices

| | |
|---|---|
| **Task** | m1-040 |
| **Date** | 2026-11-04 |
| **Source** | Repository owner, typed into a new Claude Code session. Recorded as given; nothing redacted (the prompt contains no secrets). Owner replies are quoted as given. |

---

Start m1-040. Read AGENTS.md and docs/milestones/m1-040-handoff.md first, confirm the task with me, follow the gates, and stop for approval before any commit or push.

---

**In-session decisions (2026-11-04, owner):**

1. The agent listed four choices from the handoff: the local MongoDB test run (a), the MongoDB
   backup tool (b), recording the §12 answers (c), or a DPO or issue item (d/e/f). The owner
   chose:

   > (c) Record §12 answers

2. The agent asked the eight [hardening runbook](../../../../runbooks/server-hardening-and-patching.md)
   §12 choices, one question each, with the agent suggestion marked "(Recommended)" where the
   runbook has one. The owner answered (quoted as given):

   | # | Choice | Answer |
   |---|---|---|
   | 1 | Disk encryption | "B data volume (Recommended)" |
   | 2 | MongoDB member authentication | "x.509 prod, keyfile staging (Recommended)" |
   | 3 | TLS proxy | "nginx" |
   | 4 | Reboot handling | "Follow choice 1 (Recommended)" |
   | 5 | SSH source addresses | "Fixed admin addresses (Recommended)" |
   | 6 | MongoDB major version | "Defer to local test (Recommended)" |
   | 7 | `javascriptEnabled: false` | "Defer to local test (Recommended)" |
   | 8 | Uptime and alert monitoring | "External uptime check (Recommended)" |

3. The agent asked whether to commit and push the branch (D-GIT-38). The owner replied:

   > yes
