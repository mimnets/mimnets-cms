# m1-037 — publishing workflow: review before publish (D-CONTENT-11 option B)

| | |
|---|---|
| **Task** | m1-037 |
| **Date** | 2026-11-03 |
| **Scope** | Candidate (a) of the [m1-037 handoff](../../../../milestones/m1-037-handoff.md): implement and test D-CONTENT-11 option B ([options paper](../../../../milestones/m1-036-publishing-workflow-options.md) §5) |
| **Prompt** | [2026-11-03-m1-037-publishing-workflow.prompt.md](../../../prompts/2026/11/2026-11-03-m1-037-publishing-workflow.prompt.md) |
| **Handoff** | [m1-037 start handoff](../../../../milestones/m1-037-handoff.md) · next: [m1-038 handoff](../../../../milestones/m1-038-handoff.md) |
| **Branch / commit** | `feat/m1-037-publishing-workflow` from `origin/main` `7baec46` (m1-036 merged as PR #39). Commit and push approved by the owner on 2026-11-04 (D-GIT-35) |
| **Related** | D-CONTENT-11 · D-SEC-3 · D-M0-11 · D-GIT-34 · D-GIT-35 (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Precondition: m1-036 merged (`7baec46`). CI check runs read through the public GitHub API: at first
  4 of 5 were still running; then 5 of 5 completed with `success` (audit, secrets, build, test, lint).
- Candidate (a): owner, in session ("D-CONTENT-11 option B (Recommended)").
- Approvals per change: owner, in session ("One editor or admin (Recommended)").
- Delete guard: owner, in session ("Add a project guard (Recommended)").
- No package, lockfile, `.env`, production system or real staff account changed. Nothing posted
  anywhere.

## Requirements

Paper §5, option B: a disposable `contributor` test account task, workflow tests (contributor
publish refused, submit works, editor publishes, nothing public until then), browser acceptance as
contributor and as editor, and a short staff guide.

## Work completed

| Item | Result |
|---|---|
| Roles | No application code: core `contributor` (submits) and `editor` (approves, publishes) |
| Test task | `assurer-test:ensure-contributor` (`modules/assurer-test`), from `APOS_TEST_CONTRIBUTOR_USER` / `_PASSWORD`, with the same temporary-SQLite guard as `ensure-editor` (`contributorRefuseReason`, unit-tested) |
| Suite | `scripts/publishing-workflow-test.mjs`, run by `test:ci` (`PUBLISH_TEST_DISPOSABLE=1`) before and after a restart. Pieces, pages and Global Content: contributor drafts, publish refused, submit, Submitted drafts list (editor sees all, contributor only their own), editor corrects and publishes, dismiss and withdraw, unpublish/delete/archive of published content refused, direct write to the published version refused, visitors and `?aposMode=draft` see nothing early. Redirects, Global Styles, users, own role change and form submissions refused. Media (below). The guard (below). Persistence after restart |
| Delete guard | `modules/@apostrophecms/doc/index.js`: a `@apostrophecms/doc-type:beforeDelete` handler. It refuses to delete a draft that has a published copy unless the user may publish. Never-published drafts, editors, admins and `permissions: false` are unchanged (all three tested). Negative control: with the file moved out, "the draft survives the refused delete" fails |
| Staff guide | [docs/content/publishing-workflow-guide.md](../../../../content/publishing-workflow-guide.md) (agent draft, for the business owner) |
| Paper | §8 added to the options paper with two corrections; earlier sections left as written |
| Records | Decision register (D-CONTENT-11, D-SEC-3 (c), D-GIT-34 merged, D-GIT-35 new), this report, the prompt record, INDEX, [m1-038 handoff](../../../../milestones/m1-038-handoff.md) |

### Findings during the task

1. **Core deletes a published document's draft before refusing a contributor.** `canDelete()`
   (`permission/index.js`) allows deleting any draft with edit rights. `doc.delete()` removes the
   draft, then `deleteOtherModes` (afterDelete) tries the published copy, which needs publish
   rights, and throws. The API answers 403, but the draft is gone and the live copy has no draft,
   so it drops out of the managers. The UI does not send this request ("Discard draft" on
   published content reverts instead), so only an API call made with the contributor's own login
   can do it. Fixed by the project guard (owner approval). Upstream text below.
2. **Contributors cannot add media.** Core `@apostrophecms/image`, `file`, `image-tag` and
   `file-tag` have `editRole: 'editor'`. A contributor can upload a raw attachment (core
   `upload-attachment`), but adding it to the media library is refused (403). Contributors choose
   images that editors have added. The paper said otherwise; corrected in §8 and in the guide.

## Files changed

- A `modules/@apostrophecms/doc/index.js`
- M `modules/assurer-test/index.js`
- M `modules/assurer-test/lib/guard.js`
- A `scripts/publishing-workflow-test.mjs`
- A `scripts/publishing-workflow.test.mjs`
- M `scripts/run-ci-tests.mjs`
- A `docs/content/publishing-workflow-guide.md`
- M `docs/milestones/m1-036-publishing-workflow-options.md` (§8 and a header note only)
- A `docs/milestones/m1-038-handoff.md`
- A `docs/engineering/prompts/2026/11/2026-11-03-m1-037-publishing-workflow.prompt.md`
- A `docs/engineering/reports/2026/11/2026-11-03-m1-037-publishing-workflow.report.md`
- M `docs/engineering/decision-register.md`
- M `docs/engineering/INDEX.md`

## Tests executed and actual results

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Lint | `npm run lint` | No errors or warnings | PASS |
| Unit | `npm run test:unit` | 101/101 (2 new) | PASS |
| Isolated CI run | `npm run test:ci` | 24/24 steps. Publishing workflow 59/59, after restart 8/8; smoke 18/18, workflow 15/15, content model 106/106, SEO 37/37, persistence 7/7 and 7/7, redirects 52/52, forms 84/84, security 65/65 and 15/15 | PASS |
| Guard negative control | `test:ci` with `modules/@apostrophecms/doc/index.js` moved out, then restored | "the draft survives the refused delete" FAIL, as expected; file restored, `git status` checked | PASS |
| Smoke | `node --env-file=.env app` on `:3000` (SQLite); `npm run test:smoke` | 18/18 | PASS |
| Workflow | `npm run test:workflow` | 15/15 | PASS |
| Persistence | `npm run test:persistence`, same server | 7/7 | PASS |

Not run: `npm run build` (no client asset) and `audit:check` (no dependency change). The hosted CI
runs both on the PR.

## Browser acceptance checklist

Claude in Chrome, on `http://127.0.0.1:3000` (dev SQLite database). Disposable accounts
`m1037contributor` (contributor) and `m1037editor` (editor), created with
`node app @apostrophecms/user:add <name> <role>`; passwords in a scratch file outside the repository,
deleted afterwards. Screenshots were refused by the extension on this host, so results were read from
the DOM and from requests in the page; no evidence files.

| # | Check | Steps | Actual result | Status |
|---|---|---|---|---|
| B1 | Contributor admin bar | Log in through the form; read the bar | Pages · Content · Forms · Global Content; no Media, Site admin, Redirects or Global Styles toggle | PASS |
| B2 | Contributor creates and submits a product | Content → Products → New Product; type a title; the primary button is **Submit**; click it | "Submitted to Admins and Editors for review". Draft has `submitted.by` = contributor; no published version | PASS |
| B3 | Contributor creates and submits a page | Pages → New Page; type a title; Save Draft and Preview; Edit; **Submit** | Same message; logged-out request 404 | PASS |
| B4 | Contributor publish refused in the browser session | `apos.http.post(.../publish)` from the page (sends the CSRF header like the UI) | 403 forbidden | PASS |
| B5 | Editor sees the submissions | Log in as editor; admin bar badge "2"; open Manage Draft Submissions | Both rows, with type, time, submitter and "Pending Draft". Bar: Pages · Content · Media · Forms · Redirects; no Users | PASS |
| B6 | Editor publishes the product | Open the row; **Publish** | "Your changes have been published"; published version exists; leaves the list | PASS |
| B7 | Editor publishes the page; visitors see it | Open the page; Edit; **Publish**; logged-out request | 200, title shown, no admin bar; list empty | PASS |
| B8 | Logged out: no draft or user data | Log out; request `/` | No admin bar, no `"user":{` object | PASS |
| B9 | Dismiss Submission in the UI | — | Covered by the suite through the API; the menu item was not clicked | NOT TESTED |
| B10 | Layouts 1440/768/375 | — | No template or layout change | NOT TESTED (not applicable) |

Observations:

- After login and after Save Draft and Preview, the app redirects to `http://localhost:3000`
  (`APOS_BASE_URL` in the dev `.env`), where the owner's own admin session was open. The agent did
  nothing there and went back to `127.0.0.1`. Not a defect.
- The page markup for contributors and editors contains the hidden Global Styles editor
  (an "Update Global Styles" button in the accessibility tree), with no visible toggle. The server
  refuses their writes (suite check, and D-M0-11 in m1-022).
- The first page title was typed after the field's default text, giving
  "New Pagem1-037 browser contributor page". Test data only; archived.

## Security observations

- Publishing, unpublishing and archiving published content are refused on the server for
  contributors, not only hidden (suite and B4).
- The delete guard closes the core gap in finding 1. It runs before anything is deleted and only
  for users who may not publish.
- A contributor can still upload a raw attachment through `@apostrophecms/attachment/upload`. Its
  file URL works for anyone who has it, as for any upload. Same as the existing core behaviour for
  editors (paper §4); staff guide says not to upload confidential files.
- No secrets in tracked files. CI masks the new random contributor password.

## Upstream issue text (D-SEC-3 (c); for the owner to file, I6)

> **Title:** Contributor `DELETE` of a published document removes the draft, then fails with 403
>
> **Version:** apostrophe 4.34.0
>
> **Steps:** As a `contributor`, call `DELETE /api/v1/<piece-type>/<aposDocId>:en:draft` for a
> piece (or page) that has been published.
>
> **Expected:** 403 and no change, because deleting a published document needs publish rights.
>
> **Actual:** 403, but the draft row is already removed. `permission.can(req, 'delete', draft)`
> allows it (`canDelete()`: `doc.aposMode === 'draft'` → edit permission). `doc.delete()` then
> runs `deleteBody` for the draft, and the `afterDelete` handler `deleteOtherModes` calls
> `delete` for the published copy, which `canDelete()` refuses. Nothing restores the draft. The
> published document stays live without a draft, so it no longer appears in the managers.
>
> **Notes:** The admin UI does not send this request (Discard Draft on published content uses
> `revert-draft-to-published`). A check in `beforeDelete` that refuses a draft delete when a
> published peer exists and the user cannot publish avoids it. Related: #3719.

## Known limitations

- Core sends no notification on submit; staff must agree another way (guide §4).
- Who the approvers are is not recorded (business owner input).
- B9 not clicked in the browser.

## Unresolved decisions

- D-CONTENT-11: implemented; staff list and notification practice open (business owner).
- D-SEC-3 (c): text above, not filed.
- D-GIT-35: commit and push approved (2026-11-04); the PR is opened by the owner.

## Rollback guidance

Revert the commit. The guard has no data; removing it restores core behaviour. No migration, no
data change, no role change on real accounts.

## Cleanup

- Browser test records ("m1-037 browser contributor product", "New Pagem1-037 browser contributor
  page") archived by the test editor through the REST API; the page now answers 404.
- Disposable accounts `m1037contributor` and `m1037editor` logged out in the UI and archived by the
  test admin through the REST API (`archived: true`). The scratch password file was deleted.
- The `test:ci` runs used temporary directories, deleted at the end (one kept run was deleted by hand).
- The suites' test content stays in the local dev SQLite database, as after earlier runs.
- The agent's dev server on `:3000` was stopped. The Chrome tab was closed.

## Recommended next step

The owner reviews the guide, names the approvers (outside the repository) and files D-SEC-3 (c).
Then an item the owner picks from the [m1-038 handoff](../../../../milestones/m1-038-handoff.md),
in a new session after the m1-037 PR is merged.
