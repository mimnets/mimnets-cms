# Prompt — m1-042: Docker direction, OCI test guide and handoff for the local Docker test

| | |
|---|---|
| **Task** | m1-042 |
| **Date** | 2026-11-06 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

start from the handoff

---

**In-session decisions (2026-11-06, owner):**

1. The agent listed the handoff's candidates, recommended the MongoDB 8.0.x test run, and asked
   whether the open MongoDB on the OCI server was closed. The owner answered that it was closed
   ("Closed, please re-check") and asked:

   > i have a supabase self-hosted on OCI - can i add as another project for assurer website?

   The agent advised against it for staging and production (D-DB-5, D-DB-6, D-DB-8, unused
   services, Studio bypassing Apostrophe's APIs) and said a dev/test database was possible with
   approval. Nothing was set up.

2. The owner asked:

   > then please tell me - can we host this project web hosting like share hosting site like hostinger?

   The agent answered no for shared hosting, and that a VPS could work, citing Hostinger's and
   Apostrophe's documentation. Nothing was decided.

3. The owner asked:

   > then - tell me can build docker with complete postrophe cms and mongodb community version. so that we can run in the vps with multiple container that would save our cost right?

   The agent answered that the Docker setup is possible and useful, but that Docker alone does not
   save much, and recommended one VPS per environment. It asked for approval of Docker Engine and
   MongoDB 8.0.x for the check, and where to run it.

4. The owner replied:

   > approve, run the test on this PC. but what is the current monogodb open sorce version? and what others alternatives like FerretDB?

   The agent answered the questions and found that the PC had no Docker and no WSL. It offered A
   (MongoDB ZIP, no Docker), B (WSL2 with Docker Engine) or C (Docker Desktop), and recommended A.

5. The owner replied:

   > go with your recommendation and add a md file for guides to install and test the project on my OCI server.

6. While the agent was working, the owner asked:

   > so you picked no docker right?

   and then:

   > is it for local check would be easy for that's why you have choosed without docker?
   > then let me allow and make the handoff so that i will install docker and activate wsl on this local dev computer

   The agent confirmed the reason, stopped the ZIP run, and prepared the handoff and the OCI guide.
