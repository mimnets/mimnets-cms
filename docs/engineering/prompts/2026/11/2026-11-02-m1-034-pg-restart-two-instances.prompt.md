# Prompt — m1-034: finish the D-DB-5 tests on Neon (server restart, auto-suspend, two instances)

| | |
|---|---|
| **Task** | m1-034 |
| **Date** | 2026-11-02 |
| **Source** | Repository owner, typed into a new Claude Code session. Recorded as given; nothing redacted (the prompts contain no secrets). Owner replies are quoted as given. |

---

start from docs/milestones/m1-034-handoff.md

---

**In-session decisions (2026-11-02, owner):**

1. The agent listed candidates (a) to (d) from the handoff. It noted that `origin/main` contains
   the m1-033 merge (PR #36), and that it could not check the hosted CI checks, because `gh` is
   not installed. The owner chose:

   > (b) Finish D-DB-5 on Neon

2. The agent proposed this plan:
   - **Server restart:** use the existing `--stop-cmd`/`--start-cmd` flags with the built-in
     Windows `curl.exe` against the Neon API.
   - **Auto-suspend:** a new `--idle-wait=<seconds>` scenario in
     `scripts/pg-connection-drop-test.mjs`.
   - **Mitigation B:** a new `--instances=2` mode in the same script. It runs two supervised
     instances behind a health-checked proxy, built with `node:http` only.

   The agent asked for:
   - approval of the plan and of the script changes;
   - approval to point the app at the Neon PostgreSQL 16 project again, with demo data only;
   - `NEON_API_KEY`, `NEON_PROJECT_ID` and `NEON_ENDPOINT_ID` in `.env`, and the Neon
     `APOS_DB_URI` line made active;
   - the CI status of PR #36.

   The owner replied:

   > done

   The agent found that `.env` on disk had not changed, and asked again, explicitly, for the
   approvals and the CI status. The owner replied:

   > yes

   The agent's reading:
   - The plan, the two script changes and the use of the Neon PostgreSQL 16 project for m1-034
     (demo data only) are approved.
   - The m1-033 CI checks are reported green by the owner. The agent did not check them.

   At that point `.env` pointed at Neon, but the three `NEON_*` values were not present.

---

**Second session (2026-11-03, owner):**

The owner typed, in a new Claude Code session:

> start from the handoff

3. The agent found m1-034 in progress on branch `test/m1-034-pg-restart-two-instances`: the
   script changes, `scripts/neon-endpoint.mjs` and the runbook update were uncommitted, and there
   was no report or evidence. The one surviving full run log (2026-11-02) came from an earlier
   script version, and no two-instance run log survived. The agent proposed to repeat both runs
   with the current script on Neon, keep sanitized logs under `evidence/m1-034/`, correct the
   runbook to match, run the suites on SQLite, and then write the report and the m1-035 handoff.
   The owner replied:

   > yes

4. After both runs, the agent asked whether the owner or the agent should switch `APOS_DB_URI`
   in `.env` back to SQLite for the suites. The owner replied:

   > ok

   The agent read this as approval to make that two-line change itself, as in m1-033.

5. The agent asked for approval to commit and push (D-GIT-32). The owner replied:

   > commit and push
