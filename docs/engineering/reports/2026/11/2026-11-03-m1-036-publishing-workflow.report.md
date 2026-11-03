# m1-036 — publishing workflow options (D-CONTENT-11)

| | |
|---|---|
| **Task** | m1-036 |
| **Date** | 2026-11-03 |
| **Scope** | Candidate (c) of the [m1-036 handoff](../../../../milestones/m1-036-handoff.md): an options paper for D-CONTENT-11, so that the business owner can choose a publishing workflow |
| **Prompt** | [2026-11-03-m1-036-publishing-workflow.prompt.md](../../../prompts/2026/11/2026-11-03-m1-036-publishing-workflow.prompt.md) |
| **Handoff** | [m1-036 start handoff](../../../../milestones/m1-036-handoff.md) · next: [m1-037 handoff](../../../../milestones/m1-037-handoff.md) |
| **Branch / commit** | `docs/m1-036-publishing-workflow` from `origin/main` `6dca8dd` (m1-035 merged as PR #38). Commit and push approved by the owner (D-GIT-34); PR opened by the owner |
| **Related** | D-CONTENT-11 · D-M0-11 · D-GIT-33 · D-GIT-34 (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Candidate (c): owner, in session ("ok, go with D-CONTENT-11").
- m1-035 CI checks: at first not checkable (private repository, no `gh`). The owner then made the
  repository public ("repo is not private - you can check yourself now"). The agent read the check
  runs for `6dca8dd` through the public GitHub API: 5 of 5 completed with `success` (secrets, test,
  lint, audit, build).
- D-CONTENT-11: **option B** chosen by the owner in session ("B: review (Recommended)").
- Commit and push: owner, in session ("Commit and push", D-GIT-34).
- No package, lockfile, `.env`, database, user account or production system changed. Nothing
  posted anywhere.

## Requirements

Describe the publishing workflow options that Apostrophe Community Edition supports, the work for
each option, and a recommendation. Do not decide or implement.

## Work completed

| Item | Result |
|---|---|
| Source check | Installed `apostrophe` 4.34.0. `permission/index.js`: the `contributor` role may edit drafts (`canEdit()`, line 135) and upload attachments (line 110), but not publish (`canPublish()`, line 152) or archive published content (`canDelete()`, line 159). `doc-type/index.js` `submit()` (892) and `dismissSubmission()` (913); submit routes in `piece-type` (559) and `page` (744); the `@apostrophecms/submitted-draft` tray for editors (`addToAdminBar()`, 135). The UI shows **Submit** in place of Publish (`AposDocEditor.vue` lines 348–352). Core sends no notification on submit. Images, files and their tags are `autopublish: true`. `@apostrophecms/redirect` has `editRole: 'editor'` |
| Options paper | [m1-036-publishing-workflow-options.md](../../../../milestones/m1-036-publishing-workflow-options.md): A direct publish · B review before publish · B1 as B with Global Content for editors only. Agent recommendation: B |
| Decision register | D-CONTENT-11 note; D-GIT-33 marked merged (PR #38); **D-GIT-34** (new, open) |
| Records | This report, the prompt record, INDEX, [m1-037 handoff](../../../../milestones/m1-037-handoff.md) |

## Files changed

- A `docs/milestones/m1-036-publishing-workflow-options.md`
- A `docs/milestones/m1-037-handoff.md`
- A `docs/engineering/prompts/2026/11/2026-11-03-m1-036-publishing-workflow.prompt.md`
- A `docs/engineering/reports/2026/11/2026-11-03-m1-036-publishing-workflow.report.md`
- M `docs/engineering/decision-register.md`
- M `docs/engineering/INDEX.md`

## Tests executed and actual results

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Lint | `npm run lint` | No errors or warnings | PASS |
| Smoke | `node --env-file=.env app` on `:3000` (SQLite); `npm run test:smoke` | 18/18 | PASS |
| Workflow | `npm run test:workflow` | 15/15 | PASS |
| Persistence | `npm run test:persistence`, same server | 7/7 | PASS |

## Browser acceptance checklist

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Public site smoke (Chrome) | `http://127.0.0.1:3000/` in the session's tab; DOM read with JavaScript | Title "Home", H1 "Protection you can rely on", "Demo" label present, no horizontal overflow | PASS |
| Logged out: no admin bar or user data | Same page; checked for admin-bar elements and a `"user":{` object in the HTML | Neither present | PASS |
| Contributor flow (submit, editor publishes) | — | Not run: docs-only task; planned for the follow-up task (paper §5, §6) | NOT TESTED |
| Layouts 1440/768/375 | — | No template or layout change | NOT TESTED (not applicable) |

## Security observations

- The contributor role adds no endpoint; publishing is refused on the server, not only in the UI
  (source reading; not yet tested in this project).
- Images and files that a contributor uploads are published at once (core `autopublish`). Staff
  guidance must say not to upload confidential files (paper §4).
- The repository is now public, so the full Git history is visible. The CI `secrets` job runs
  gitleaks 8.30.1 over the full history (`fetch-depth: 0`, `.github/workflows/ci.yml`) and passed on
  `6dca8dd`. gitleaks finds only the patterns it knows; personal data in history was not reviewed.

## Known limitations

- The contributor flow is from source reading only; it is not run in this project (paper §6).
- Upstream documentation was not re-read.

## Unresolved decisions

- [D-CONTENT-11](../../decision-register.md): option B decided; the number of approvers and who
  they are is still open.
- D-GIT-34: approved; the owner opens the PR.

## Rollback guidance

Docs only. Revert the commit; no data or configuration changed.

## Cleanup

- The agent's server on `:3000` was stopped (its own background task) and the Chrome tab was
  closed.
- The suites' test page and workflow content stay in the local SQLite database, as after earlier
  runs. No test account was created.

## Recommended next step

m1-037 implements option B (paper §5), in a new session, after the m1-036 PR is merged.
Owner carry-over from the m1-036 handoff §2 still applies.
