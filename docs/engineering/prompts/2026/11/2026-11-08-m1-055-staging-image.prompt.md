# Prompt — m1-055: staging image with PBM

| | |
|---|---|
| **Task** | m1-055 |
| **Date** | 2026-11-08 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

Start m1-055. Read AGENTS.md and docs/milestones/m1-055-handoff.md first, confirm the task with me,
follow the gates, and stop for approval before any commit or push.

---

**In-session decisions (2026-11-08, owner):**

1. The agent confirmed the precondition (PR #57 merged as `74c3052`; hosted CI partly running at
   that moment, all green before the branch was made) and asked which handoff §2 candidate to take.
   The owner chose **"Staging image + PBM"**.
2. The agent proposed the scope (staging build of the one-container image with PBM to a local
   `/backups` volume, staging Compose with nginx, `APOS_CLUSTER_PROCESSES=2` by default, a PBM
   runbook, the hardening runbook §6 and §7 rewrite, and a local check) and asked four questions.
   The owner chose each agent suggestion:
   - nginx placement: **"Own container (Recommended)"**
   - certificate renewal: **"certbot container (Recommended)"**
   - MongoDB on loopback: **"requireTLS (Recommended)"**
   - first admin password: **"Random, in secrets (Recommended)"**
3. The owner asked where the work stood and how long the project would take; the agent answered in
   session (no decision). The agent then asked for approval to build the image with PBM 2.17.0, pull
   the official `nginx` and `certbot/certbot` images after a license and advisory check, and run it
   on the owner's PC on `127.0.0.1` only under disposable names. The owner wrote:

   > approve, go ahead with the build and local run

4. During the local run, after looking at Docker Desktop, the owner asked whether MongoDB was missing
   from the container. The agent showed that `mongod` runs inside the `site` container (D-DB-10 (b));
   no decision changed. The owner wrote:

   > I don't see any mongodb in the container, isn't it required right now?

5. The agent reported the results and recommended committing, pushing and opening the PR (D-GIT-53),
   and trying to remove `gosu` and `esbuild` from the final image before any server use (D-SEC-8,
   option A). The owner wrote:

   > please do what would be the best by yourself

   The agent recorded option A as the D-SEC-8 direction. The commit and push stayed open: the
   session's permission check refused them on this general reply, and AGENTS.md asks for explicit
   approval of that action.

6. The agent asked for explicit approval of the commit and push. The owner wrote:

   > approve commit and push for m1-055
