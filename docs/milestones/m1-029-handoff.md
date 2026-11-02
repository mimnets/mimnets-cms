# m1-029 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-02, by the agent at the end of m1-028 (agent-executed; not a human approval) |
| **Task** | `m1-029`, an item the owner picks. Candidates: (a) **D-CONTENT-16** (where CA-5 content is entered); (b) **privacy notice go-live** (CA-6; after DPO review, D-CONTENT-15); (c) a **carry-over code item** from the [CA-5 checklist §7](../content/ca5-migration-checklist.md#7-work-that-is-not-data-entry) |
| **Precondition** | The m1-028 PR is merged (D-GIT-26) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-029-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-2, D-CONTENT-4, D-CONTENT-12, D-CONTENT-15, D-CONTENT-16, D-DB-2, D-DB-3) · [m1-028 report](../engineering/reports/2026/11/2026-11-02-m1-028-ca5-preparation.report.md) · [CA-5 checklist](../content/ca5-migration-checklist.md) |

## 1. State at the end of m1-028

- `docs/m1-028-ca5-preparation` holds the CA-5 inventory and draft-entry checklist,
  D-CONTENT-16, records and this handoff. No code change. Nothing was entered in any database.
- The unpublished draft page "Privacy notice" (`/privacy`, m1-027) is still in the local
  development database.

## 2. Candidates

### 2.1 D-CONTENT-16: where CA-5 content is entered

The owner and architect decide option A, B or C ([checklist §6](../content/ca5-migration-checklist.md#6-d-content-16-where-ca-5-content-is-entered)).
Option A needs hosting decisions (D-DB-2, D-DB-3) first. Option B is a code task that needs its
own design review. Option C needs a dependency approval. In all cases the owner supplies the
approved copy, images and confirmations in the checklist §2–§3; the agent writes no business text.

### 2.2 Privacy notice go-live (CA-6)

As in the [m1-028 handoff §2.1](m1-028-handoff.md#21-privacy-notice-go-live-ca-6). Only after
the DPO's review and a recorded approval (D-CONTENT-15).

### 2.3 Carry-over code items

From the checklist §7: remove the demo notice and the demonstration footer line on real-content
builds; per-file PDF redirects (needs the target database, D-CONTENT-16); card grid breakpoint
640 → 768 px; `/favicon.ico`.

## 3. Carry-over

- From m1-026: after any Apostrophe upgrade, compare the admin bar height with the two values in
  `_assurer.scss`.
- D-CONTENT-11 (publishing workflow; editors publish and edit Global Content) still open before
  staff rollout.
- From m1-021: brand values (D-CONTENT-12), SVG logo master, header logo size review, literal
  paddings.
- From m1-025: fallback font for one or two frames on the dev server; `localhost:<port>` shares
  any admin session on `localhost` (test on `127.0.0.1`; login and "Save Draft and Preview" also
  redirect to `localhost`, m1-027 F4); start a second dev server only after the first has
  finished restarting.
- Stale `vcl-assurer-group.loggedIn` cookie causes one extra reload per URL (m1-024 report, F4).
- `gh` is not installed in the agent's environment: hosted CI is confirmed by the owner.

## 4. Gates

- No new dependency without approval.
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- No real content entered before D-CONTENT-16 is decided.
- Commit, push and PR need owner approval.

## 5. Prompt for the new session

> Start m1-029. Read AGENTS.md and docs/milestones/m1-029-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
