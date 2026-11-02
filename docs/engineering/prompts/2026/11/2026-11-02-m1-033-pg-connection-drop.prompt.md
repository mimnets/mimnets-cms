# Prompt — m1-033: D-DB-5 connection-drop test on PostgreSQL 16 (Docker on the owner's OCI server)

| | |
|---|---|
| **Task** | m1-033 |
| **Date** | 2026-11-02 |
| **Source** | Repository owner, typed into a new Claude Code session. Recorded as given; nothing redacted (the prompts contain no secrets). Owner replies are quoted as given. |

---

Start m1-033. Read AGENTS.md and docs/milestones/m1-033-handoff.md first, confirm the task with me, follow the gates, and stop for approval before any commit or push.

---

**In-session decisions (2026-11-02, owner):**

1. The agent listed candidates (a)–(d) from the handoff and recommended (b). It noted that it
   could not check the m1-032 CI checks, because `gh` is not installed. The owner replied:

   > go with (b), use Docker with PostgreSQL 16 on my OCI server - can you please suggest me and write into mark down file how to run into OCI server with docker container and then connect with our local dev and also how can we import and export the db from OCI to others later?

   The agent's reading:
   - The task is candidate (b), the D-DB-5 connection-drop test, with PostgreSQL **16**.
   - The disposable PostgreSQL is a Docker container on the owner's own OCI server, not a local
     install. This is the owner's choice of test instance. It is **not** the D-DB-2 provider
     decision.
   - The first deliverable is a Markdown runbook covering the server setup, the connection from
     local development, and export/import. It is
     [docs/runbooks/postgresql-dev-on-oci-docker.md](../../../../runbooks/postgresql-dev-on-oci-docker.md).
   - Still open:
     - Explicit approval to point the app at that server (a non-local database, AGENTS.md).
     - A way to run `psql` on the PC (not installed).
     - The m1-032 CI status.

2. The agent explained that a local Docker container would also work, but that Docker and WSL
   are not installed. The owner replied:

   > please confirm if run with local docker and you can connect then and we can export the data later?

   The agent confirmed both, listed the installs needed, and asked for a choice. The owner replied:

   > i prefer for test free cloud like mongodb or anyother free tier postgres?

3. The agent advised against MongoDB Atlas (D-DB-5 is specific to PostgreSQL, and the owner had
   chosen PostgreSQL), recommended Neon, and asked for approval of a script change. The owner
   replied:

   > go with Neon, approve the script change

   The agent's reading: Neon's free plan is the disposable PostgreSQL 16 for the test. Pointing
   the app at it is approved for m1-033, with demo data only. The approved script change is
   `--allow-remote-host=<exact host>` and admin SQL through the `pg` client that db-connect
   already uses, instead of `psql`.

4. The owner then pasted Neon's onboarding prompt into the session (not reproduced here: it
   contains the Neon organization and project IDs). It asks the agent to install the `neon` CLI
   globally, run `neon init` and `neon deploy`, and wire a Neon driver into the app code. The
   owner's message did not ask the agent to follow it. The agent did not run it, because it would
   add a tool, files and a database driver that the gates and ADR-0002 do not allow. The agent
   proposed using the console's connection string in `.env` instead.

5. Closing message, recorded as given: "approve all". It answered the agent's three closing items:
   (1) approval to commit and push (D-GIT-31); (2) the m1-032 CI checks were green; (3) the agent
   may switch `.env` back to SQLite.
