# m1-028 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-02, by the agent at the end of m1-027 (agent-executed; not a human approval) |
| **Task** | `m1-028`, an item the owner picks. Candidates: (a) **privacy notice go-live** (CA-6; after DPO review, D-CONTENT-15); (b) **CA-5 preparation** (content migration; needs owner-approved copy and D-CONTENT-4) |
| **Precondition** | The m1-027 PR is merged (D-GIT-25) and its five hosted CI checks are green |
| **Branch** | `<type>/m1-028-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-4, D-CONTENT-11, D-CONTENT-14, D-CONTENT-15, D-FORM-1, D-FORM-2) · [m1-027 report](../engineering/reports/2026/11/2026-11-02-m1-027-privacy-page.report.md) · [privacy notice draft](../content/privacy-notice-draft.md) |

## 1. State at the end of m1-027

- `docs/m1-027-privacy-page` holds the privacy notice review copy, D-CONTENT-15, records and this
  handoff. No code change.
- The local development database has an **unpublished** draft page "Privacy notice" (`/privacy`)
  with the same text. It is not chosen in Global Content.
- Lint, smoke, workflow and persistence suites pass (see the report).

## 2. Candidates

### 2.1 Privacy notice go-live (CA-6)

Only after the DPO has reviewed the draft and a named human approval is recorded (D-CONTENT-15):

1. Update the review file and the draft page with the DPO's text; no `[[…]]` left.
2. Publish the page; choose it in Global Content → Privacy → "Privacy notice page"; add the
   form lead-in text if supplied.
3. Browser checks: footer link, form notice, public view, 1440/768/375 px.

The agent must not change the wording beyond what the DPO supplies.

### 2.2 CA-5 preparation (content migration)

As in the [m1-023 handoff §2.2](m1-023-handoff.md#22-ca-5-preparation-content-migration).

## 3. Carry-over

- From m1-026: after any Apostrophe upgrade, compare the admin bar height with the two values in
  `_assurer.scss`.
- D-CONTENT-11 (publishing workflow; editors publish and edit Global Content) still open before
  staff rollout.
- From m1-021: brand values (D-CONTENT-12), SVG logo master, header logo size review, literal
  paddings, card grids switch at 640 px (requirements say 768 px), no `/favicon.ico`.
- From m1-025: fallback font for one or two frames on the dev server; `localhost:<port>` shares
  any admin session on `localhost` (test on `127.0.0.1`; login and "Save Draft and Preview" also
  redirect to `localhost`, m1-027 F4); start a second dev server only after the first has
  finished restarting.
- Stale `vcl-assurer-group.loggedIn` cookie causes one extra reload per URL (m1-024 report, F4).
- `gh` is not installed in the agent's environment: hosted CI is confirmed by the owner.

## 4. Gates

- No new dependency without approval.
- No publishing of the privacy notice without recorded DPO/owner approval (D-CONTENT-15).
- Commit, push and PR need owner approval.

## 5. Prompt for the new session

> Start m1-028. Read AGENTS.md and docs/milestones/m1-028-handoff.md first, confirm the task with
> me, follow the gates, and stop for approval before any commit or push.
