# Prompt — m1-029: carry-over code items

| | |
|---|---|
| **Task** | m1-029 |
| **Date** | 2026-11-02 |
| **Source** | Repository owner, typed into a new Claude Code session. Recorded as given; nothing redacted (the prompt contains no secrets). Owner replies are quoted as given unless noted. |

---

start (from docs/milestones/m1-029-handoff.md

---

**In-session decisions and messages (2026-11-02, owner):**

1. The agent reported that PR #31 (m1-028) is merged on `origin/main` (`3bac077`), asked which
   task m1-029 should be, and asked the owner to confirm the hosted CI result on PR #31 (multiple
   choice). Owner's answer: "Carry-over code items". The CI result was not confirmed in the answer.
2. The agent proposed: card grids at 768 px, `/favicon.ico`, and switching off the demo notice
   and the footer's demonstration line on real-content builds; PDF redirects stay blocked on
   D-CONTENT-16. It asked how the demo chrome should be switched off (multiple choice). Owner's
   answer: "Env var, off by default (Recommended)". The option text: the notice shows only when
   `APOS_DEMO_SITE=1`; local `.env` and CI set it to 1; without a copyright name the footer shows
   no legal line instead of the demonstration text.
3. Closing message, recorded as given: "please push d-git-27 and d-git-26 hosted ci checks on the
   pr #31" (answer to the agent's request to commit, push and open the PR, and to its question
   about hosted CI on PR #31). The agent read it as approval of D-GIT-27 and as a request to check
   PR #31's CI. It could not: the repository is private (unauthenticated GitHub API: 404) and `gh`
   is not installed.
4. Message after the push, recorded as given: "PR #31 checks are green".
