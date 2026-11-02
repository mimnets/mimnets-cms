# m1-031 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-02, by the agent at the end of m1-030 (agent-executed; not a human approval) |
| **Task** | `m1-031`, an item the owner picks. Candidates: (a) **hosting decisions** D-DB-2/D-DB-3 (and D-DB-4), which CA-5 entry now waits for; (b) **privacy notice go-live** (CA-6; after DPO review, D-CONTENT-15); (c) **D-CONTENT-11** (publishing workflow, before staff rollout) |
| **Precondition** | The m1-030 PR is merged (D-GIT-28) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-031-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-11, D-CONTENT-15, D-CONTENT-16, D-DB-2 to D-DB-6) · [m1-030 report](../engineering/reports/2026/11/2026-11-02-m1-030-content-entry-decision.report.md) · [CA-5 checklist](../content/ca5-migration-checklist.md) · [ADR-0002](../architecture/decisions/ADR-0002-database-strategy.md) |

## 1. State at the end of m1-030

- `docs/m1-030-content-entry-decision`: **D-CONTENT-16 closed, option A** (owner, 2026-11-02).
  CA-5 content is entered through the Apostrophe UI on the staging or production site once it
  exists; no scripted entry and no export/import module. CA-5 checklist updated. The m1-029
  post-push record edits are in this branch.
- Docs only; no code, dependency or content change.
- The unpublished draft page "Privacy notice" (`/privacy`, m1-027) is still in the local
  development database.

## 2. Candidates

### 2.1 Hosting decisions (D-DB-2, D-DB-3, D-DB-4)

Staging and production database provider and region, media store, backup targets. Architecture
gate: needs explicit owner approval, and nothing production-related is touched without it.
D-DB-6 (option B) also lists staging blockers: D-DB-5 resolved or mitigated, a repeat test on
Linux with the target managed-service version, and a reviewed "sanitize after restore" task.
The agent can prepare an options paper; it does not choose a provider or create accounts.

### 2.2 Privacy notice go-live (CA-6)

As in the [m1-028 handoff §2.1](m1-028-handoff.md#21-privacy-notice-go-live-ca-6). Only after the
DPO's review and a recorded approval (D-CONTENT-15).

### 2.3 Publishing workflow (D-CONTENT-11)

Direct publish or review before publish, with the role design, before staff rollout.

## 3. Carry-over

- CA-5 entry, PDF uploads and per-file PDF redirects (CA-5 checklist §7) wait for the staging
  site (D-CONTENT-16, option A). The owner prepares copy against checklist §2–§3 meanwhile.
- Every developer `.env` needs `APOS_DEMO_SITE=1` for `npm run test:smoke` (m1-029).
- From m1-026: after any Apostrophe upgrade, compare the admin bar height with the two values in
  `_assurer.scss`.
- From m1-021: brand values (D-CONTENT-12), SVG logo master, header logo size review, literal
  paddings. The favicon is still the live site's 32 px PNG.
- From m1-025: test on `127.0.0.1`, not `localhost`; start a second dev server only after the
  first has restarted.
- Stale `vcl-assurer-group.loggedIn` cookie causes one extra reload per URL (m1-024 report, F4).
- Chrome window resizing does not work while maximized; use same-origin iframes for 768/375 px.
- `gh` is not installed in the agent's environment: hosted CI is confirmed by the owner.

## 4. Gates

- No new dependency without approval.
- No provider choice, account creation or production change without explicit owner approval.
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- No real content entered in the dev database (D-CONTENT-16).
- Commit, push and PR need owner approval.

## 5. Prompt for the new session

> Start m1-031. Read AGENTS.md and docs/milestones/m1-031-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
