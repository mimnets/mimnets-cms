# m1-028 — CA-5 preparation (content migration): inventory and draft-entry checklist

| | |
|---|---|
| **Task** | m1-028 |
| **Date** | 2026-11-02 |
| **Scope** | Candidate 2.2 of the [m1-028 handoff](../../../../milestones/m1-028-handoff.md): CA-5 preparation, without entering or publishing anything ([m1-023 handoff §2.2](../../../../milestones/m1-023-handoff.md#22-ca-5-preparation-content-migration)) |
| **Prompt** | [2026-11-02-m1-028-ca5-preparation.prompt.md](../../../prompts/2026/11/2026-11-02-m1-028-ca5-preparation.prompt.md) |
| **Handoff** | [m1-028 start handoff](../../../../milestones/m1-028-handoff.md) · next: [m1-029 handoff](../../../../milestones/m1-029-handoff.md) |
| **Branch / commit** | `docs/m1-028-ca5-preparation` from `origin/main` `0fe607c` (m1-027 merged as PR #30). Commit, push and PR approved by the owner (D-GIT-26) |
| **Related** | D-CONTENT-16 (new) · D-CONTENT-2 · D-CONTENT-3 · D-CONTENT-4 · D-CONTENT-9 · D-CONTENT-12 · D-CONTENT-15 · D-DB-2 · D-DB-3 · D-GIT-25 · D-GIT-26 (new) |

## Approvals used

- Task chosen by the owner in session: "CA-5 preparation (Recommended)".
- No package was added, removed or upgraded. No code changed. No content was entered in any
  database.

## Start state

- m1-027 merged (PR #30, `0fe607c` on `origin/main`). Hosted CI on PR #30: **not checked** by the
  agent (`gh` is not installed). The owner confirmed in session that the checks are green.
- Privacy go-live (candidate 2.1) was not possible: the draft still has its `[[…]]` placeholders
  and no DPO review is recorded (D-CONTENT-15).
- The dev server was already running on `:3000`.

## Findings

| # | Finding | Evidence |
|---|---|---|
| F1 | **Content entered in the dev database cannot be migrated to another site.** Each site has its own database, and one site's database is never copied into another. No staging or production database exists yet. Recorded as **D-CONTENT-16** | AGENTS.md (Data and database safety); ADR-0002; `docs/runbooks/new-site-initialization.md`; D-DB-2, D-DB-3 open |
| F2 | **Category pages must be published before products can be linked to them** (core relationship picker offers only published pages), so the owner cannot review a category page with its products while both are drafts. This is not a problem on a pre-launch `noindex` site (D-CONTENT-16, option A) | ADR-0003 §4; m1-014 editor notes |
| F3 | **The demo notice is always rendered**, and the footer falls back to a demonstration line when Global Content has no copyright name. Real-content builds need a code change | `views/layout.jsx` (`DemoNotice`, footer legal line) |
| F4 | **People have no group field**, but the live Leadership page has three groups. Use one people widget per group (hand-picked) with a heading; no schema change needed | `modules/assurer-person/index.js`; `modules/assurer-people-widget/` |
| F5 | **20 legacy redirect records** are defined; the 8 PDF and 1 video upload URLs are not, because their targets exist only after upload in the target database | `modules/assurer-seo/lib/legacy-redirects.js`; SEO runbook §3 |

## What was done

| Item | Result |
|---|---|
| [CA-5 migration checklist](../../../../content/ca5-migration-checklist.md) | Blockers (B1–B6); page inventory (18 launch URLs plus deferred ones: type, sections, records, owner inputs, blocking decisions); record inventory (organizations, people, locations, products, files, images, Global Content, with the fields as built); media and redirect work; per-item draft-entry checklist (before entry, entry, review, publish, before launch); D-CONTENT-16 options; code work that is not data entry |
| Decision register | D-CONTENT-16 (new, open) · D-GIT-25 marked merged (PR #30, CI green per the owner) · D-GIT-26 (new, approved) |
| Records | Prompt, this report, INDEX row and next-task line, [m1-029 handoff](../../../../milestones/m1-029-handoff.md) |

Every business fact in the checklist is quoted from the m1-013 inventory and marked unconfirmed;
the agent wrote no business copy.

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
| B1 | Home page loads logged out | PASS: title "Home", one H1, header menu with 3 links, "Log in" button, no admin bar, no horizontal overflow (screenshot viewed, not saved) |
| B2 | Draft privacy page stays hidden | PASS: `/privacy` returns 404 without cookies |
| B3 | Legacy redirect `/downloads/corporate-profiles` | Expected 404 locally: the local database has no published `/downloads` page, so the seed task adds no record (SEO runbook §3). Not a regression |
| B4 | 768 and 375 px | NOT TESTED: no layout or template change |

## Clean-up

- The Chrome tab used for the check was closed. No accounts or content were created.
- The dev server on `:3000` is still running. The m1-027 draft page `/privacy` is still in the
  local database, unchanged.

## Open items

- D-CONTENT-16: where CA-5 content is entered (agent recommends option A, the target environment).
- Owner inputs listed in the checklist §2–§3 (D-CONTENT-2, -4, -5, -9, -12).
- D-CONTENT-15: privacy notice DPO review (unchanged).
- D-GIT-26: commit, push and PR approved by the owner; hosted CI to be confirmed on the PR.
