# m1-030 — D-CONTENT-16: where CA-5 content is entered (decided: option A)

| | |
|---|---|
| **Task** | m1-030 |
| **Date** | 2026-11-02 |
| **Scope** | Candidate 2.1 of the [m1-030 handoff](../../../../milestones/m1-030-handoff.md): record the owner's decision on D-CONTENT-16. Docs only; nothing entered in any database |
| **Prompt** | [2026-11-02-m1-030-content-entry-decision.prompt.md](../../../prompts/2026/11/2026-11-02-m1-030-content-entry-decision.prompt.md) |
| **Handoff** | [m1-030 start handoff](../../../../milestones/m1-030-handoff.md) · next: [m1-031 handoff](../../../../milestones/m1-031-handoff.md) |
| **Branch / commit** | `docs/m1-030-content-entry-decision` from `origin/main` `03a0a2c` (m1-029 merged as PR #32). Commit, push and PR approved by the owner (D-GIT-28) |
| **Related** | D-CONTENT-16 (closed) · D-DB-2 · D-DB-3 · D-DB-6 · D-GIT-26 · D-GIT-27 · D-GIT-28 (new) |

## Approvals used

- Task chosen by the owner in session: "D-CONTENT-16".
- D-CONTENT-16 decided by the owner in session: "A. Target environment (Recommended)". The
  register names "Business owner + architect" as decision owners; the owner gave the decision.
- No package was added, removed or upgraded. No code changed. No content was entered.

## Start state

- m1-029 merged (PR #32, `03a0a2c` on `origin/main`). Hosted CI on PR #32: **not checked** by the
  agent (`gh` is not installed); the owner confirmed in session that the five checks are green.
- `feat/m1-029-carry-over-items` had three uncommitted post-push record edits (D-GIT-26 row,
  m1-029 prompt message 4, m1-029 report open items: PR #31 CI green per the owner). They were
  carried onto this branch unchanged and are part of this task's commit.
- The dev server was already running on `:3000`.

## What was done

| Item | Result |
|---|---|
| Decision register | D-CONTENT-16 **closed: option A**. D-GIT-27 marked merged (PR #32, CI green per the owner). D-GIT-28 (new, open) |
| [CA-5 checklist](../../../../content/ca5-migration-checklist.md) | Header, B1, §5 and §6 now record the decision: entry through the UI on the staging or production site once it exists |
| Records | Prompt, this report, INDEX row and next-task line, [m1-031 handoff](../../../../milestones/m1-031-handoff.md) |

**Consequence:** CA-5 data entry, the PDF uploads and the per-file PDF redirects (checklist §7)
now wait for a staging site, which needs D-DB-2 and D-DB-3 and the D-DB-6 staging blockers.
Until then the owner prepares approved copy, images and confirmations against checklist §2–§3.

## Test results

| Command | Result |
|---|---|
| `npm run lint` | PASS (no output from ESLint) |
| `npm run test:smoke` (`:3000`) | PASS, 18/18 |
| `npm run test:workflow` (`:3000`) | PASS, 15/15 |
| `npm run test:persistence` (`:3000`) | PASS, 7/7 |

Not run: `test:unit`, `test:ci`, `build`, `audit:check` (no code or dependency change).

### Browser checks (Claude in Chrome, agent-executed; not human approval)

Docs-only task: short smoke check of the public site on `http://127.0.0.1:3000`, logged out,
window 1440 px wide.

| # | Check | Result |
|---|---|---|
| B1 | Home page loads logged out | PASS: title "Home", one H1, "Log in" button, no admin bar, demo notice shown (`APOS_DEMO_SITE=1`), no horizontal overflow (screenshot viewed, not saved) |
| B2 | Draft privacy page stays hidden | PASS: `/privacy` returns 404 without cookies |
| B3 | 768 and 375 px | NOT TESTED: no layout or template change |

## Clean-up

- The Chrome tab used for the check was closed. No accounts or content were created.
- The dev server on `:3000` is still running. The m1-027 draft page `/privacy` is still in the
  local database, unchanged.

## Open items

- D-GIT-28: commit and push approved; PR to be opened by the owner, hosted CI to be confirmed on it.
- D-DB-2, D-DB-3: staging and production database and media store; now on the CA-5 critical path.
- Owner inputs listed in checklist §2–§3 (D-CONTENT-2, -4, -5, -9, -12).
- D-CONTENT-15: privacy notice DPO review (unchanged). D-CONTENT-11 (publishing workflow) open.
