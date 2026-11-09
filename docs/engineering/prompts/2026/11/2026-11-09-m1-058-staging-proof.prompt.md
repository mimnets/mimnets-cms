# Prompt — m1-058: finish the staging proof

| | |
|---|---|
| **Task** | m1-058 |
| **Date** | 2026-11-09 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

start from handoff

---

**In-session decisions (owner):**

1. The agent reported that the m1-057 PR was merged (`b3d6f30`, all five hosted checks green), and that
   this PC had 488 MB available a few minutes after a restart. The owner chose **"Finish staging proof
   (Recommended)"**.
2. Who stops a site build if memory runs out, and when it starts: **"You watch, I wait (Recommended)"**.
   The owner frees memory and watches the build and stops it if needed. The agent reads available
   memory first and starts only when it is high enough: at least 6 GB for `arm64`, and the same limit
   for the `amd64` build unless the owner sets another.
3. Available memory fell under 1 GB with the stack running. The agent offered a one-time clear of the
   Docker VM's file cache, or relying on closing Chrome tabs. The owner replied **"please try"**; the
   agent took that as approval for the clear.
4. How to prove `arm64`: **"Hosted arm64 runner (Recommended)"**.
5. The test stack's 7 volumes: **"Delete test volumes (Recommended)"**.
6. The Chrome requests in the nginx log at 16:27:13–15: **"Yes, mine"**.
7. Commit and push the workflow and this record; the owner opens the PR; the agent then records the
   results and commits and pushes those: **"approve"**. Merge not included.
8. The first `arm64` run failed before building: `service "site" declares unknown service "base" as
   additional contexts staging-base` (error pasted by the owner). The agent proposed replacing the
   `build-only` profile with `scale: 0`, a Compose version step, a rerun on `amd64` on `127.0.0.1` and
   `down -v` of that test stack: **"approve"**.
9. The next `arm64` run built the images, but the log showed `[assurer] MongoDB did not start`. The
   agent proposed a step that prints diagnostics after a failure, including MongoDB's own log lines in
   this public repository: **"APPROVE"**. The owner merged PRs #61 and #62 straight after opening
   them, so the agent reads each run on the PR that started it.
