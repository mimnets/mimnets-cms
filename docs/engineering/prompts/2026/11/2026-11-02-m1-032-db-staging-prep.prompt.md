# Prompt — m1-032: D-DB-5 mitigation and D-DB-6 staging blockers (provider-neutral)

| | |
|---|---|
| **Task** | m1-032 |
| **Date** | 2026-11-02 |
| **Source** | Repository owner, typed into a new Claude Code session. Recorded as given; nothing redacted (the prompt contains no secrets). Owner replies are quoted as given. |

---

Start m1-032. Read AGENTS.md and docs/milestones/m1-032-handoff.md first, confirm the task with me, follow the gates, and stop for approval before any commit or push.

---

**In-session decisions (2026-11-02, owner; multiple-choice answers):**

1. Which item m1-032 covers: "D-DB-5 / D-DB-6 prep".
2. Whether the five hosted CI checks on PR #34 passed: "Yes, all green".
3. What the sanitize task removes: "Auth secrets only (Recommended)" — sessions, bearer tokens,
   login-throttle counters and password-reset hashes; users, content, form submissions and media
   untouched.
4. How the connection-drop test is handled: "Write script, don't run (Recommended)" — the run
   waits for the chosen PostgreSQL major version (D-DB-2) and an approved disposable instance.
5. Closing message, recorded as given: "i accept all". It answered the agent's four closing items:
   (1) approval to commit and push (D-GIT-30); (2) owner review of the sanitize task (D-DB-6
   blocker); (3) the owner files the upstream issue (I6); (4) the question whether restored lower
   environments force a password reset. The agent read (4) as accepting that the question stays
   open, not as a decision either way.
