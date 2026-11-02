# m1-032 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-02, by the agent at the end of m1-031 (agent-executed; not a human approval) |
| **Task** | `m1-032`, an item the owner picks. Candidates: (a) **record the hosting decisions** D-DB-2, D-DB-3, D-DB-7 and D-DB-4 once the owner and DPO inputs exist; (b) **D-DB-5 mitigation and the D-DB-6 staging blockers** (provider-neutral preparation); (c) **privacy notice go-live** (CA-6, after DPO review, D-CONTENT-15); (d) **D-CONTENT-11** (publishing workflow) |
| **Precondition** | The m1-031 PR is merged (D-GIT-29) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-032-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-2 to D-DB-7, D-CONTENT-11, D-CONTENT-15) · [m1-031 report](../engineering/reports/2026/11/2026-11-02-m1-031-hosting-options.report.md) · [hosting options paper](m1-031-hosting-options.md) · [ADR-0002](../architecture/decisions/ADR-0002-database-strategy.md) · [D-DB-5 proposal](m1-d-db-5-postgresql-connection-loss-proposal.md) |

## 1. State at the end of m1-031

- `docs/m1-031-hosting-options`: hosting options paper (shortlist A AWS UAE, B Azure UAE,
  C DigitalOcean Singapore or Bangalore), register notes on D-DB-2/3/4, new D-DB-7 (app hosting).
  Docs only. **Nothing decided, no accounts created.**
- Owner direction: the engine stays PostgreSQL. MySQL (no adapter) and Appwrite (not a database
  Apostrophe can use) are ruled out.
- `@apostrophecms/db-connect` is still 1.1.0; D-DB-5 is unfixed and not reported upstream.
- The unpublished draft page "Privacy notice" (`/privacy`, m1-027) is still in the local
  development database.

## 2. Candidates

### 2.1 Record the hosting decisions

Needs the inputs in paper §7 first: I1 residency (DPO), I2 existing cloud accounts, I3 budget,
I4 operator, I5 D-DB-4 targets. Architecture gate: the owner decides, and the agent records the
decision and amends the ADR-0002 status. The agent does not create accounts or spend money
without explicit approval for that action.

### 2.2 D-DB-5 mitigation and D-DB-6 blockers (provider-neutral)

Can start before the provider choice. Possible work: a reviewed "sanitize after restore" task, a
repeatable connection-drop test, and the owner filing the upstream issue (I6). The Linux repeat
test needs the chosen PostgreSQL major version. Any new tool or dependency needs approval.

### 2.3 Privacy notice go-live (CA-6) and 2.4 Publishing workflow (D-CONTENT-11)

Unchanged from the [m1-031 handoff §2.2–§2.3](m1-031-handoff.md#22-privacy-notice-go-live-ca-6).
The privacy notice's hosting placeholder can be filled once D-DB-2 is decided.

## 3. Carry-over

- CA-5 entry, PDF uploads and per-file PDF redirects wait for the staging site (D-CONTENT-16,
  option A).
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
- Provider prices and features in the hosting paper are as of 2026-11-02; re-check before buying.

## 4. Gates

- No new dependency or tool without approval.
- No provider choice, account creation, spending or production change without explicit owner
  approval.
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- No real content entered in the dev database (D-CONTENT-16).
- Commit, push and PR need owner approval.

## 5. Prompt for the new session

> Start m1-032. Read AGENTS.md and docs/milestones/m1-032-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
