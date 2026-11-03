# m1-036: publishing workflow options (D-CONTENT-11)

| | |
|---|---|
| **Prepared** | 2026-11-03, by the agent (agent-executed; not a human approval) |
| **Decision** | [D-CONTENT-11](../engineering/decision-register.md): editors publish directly, or staff submit for review |
| **Decides** | Business owner |
| **Needed by** | Staff rollout (any non-developer editors) |
| **Basis** | Installed `apostrophe` 4.34.0 source (Community Edition) and this project's modules. No code changed; the contributor flow is **not yet tested** in this project (§6) |

## 1. Summary

Apostrophe Community Edition already has both workflows. Which one a person gets depends only on
the **role** on their user account. No Pro module and no new package is needed for either option.

| Role | Can do |
|---|---|
| `contributor` | Create and edit **drafts** of pages, pieces and Global Content; upload images and files; **submit** a draft for review. Cannot publish, cannot archive published content |
| `editor` | Everything a contributor can, plus **publish**, archive, and review submitted drafts. Cannot manage users, Global Styles (D-M0-11, admin only) or form submissions (admin only) |
| `admin` | Everything, including user accounts |

**Agent recommendation: option B** (review before publish): most staff get `contributor`, and one
or two named people get `editor` as approvers. It is the business owner's decision.

## 2. How the core review flow works

Source: `node_modules/apostrophe/modules/@apostrophecms/`.

1. A contributor edits a page or piece. The draft is saved as usual
   (`permission/index.js` `canEdit()`, line 135: draft edits allowed for `contributor`).
2. In place of **Publish**, the contributor's button is **Submit**. It calls the `:_id/submit`
   route (`piece-type/index.js` line 559, `page/index.js` line 744), which records who submitted it
   and when (`doc-type/index.js` `submit()`, line 892).
3. Editors see a **Submitted drafts** tray icon in the admin bar
   (`submitted-draft/index.js` `addToAdminBar()`, line 135). It lists every submitted page and
   piece, with the submitter and time.
4. The editor opens the draft, can change it, and then either **publishes** it (the submission
   mark is cleared) or **dismisses** the submission (the draft stays, unpublished;
   `dismissSubmission()`, line 913). A contributor can also withdraw their own submission.
5. Publishing is refused to a contributor on the server, not only hidden in the UI
   (`canPublish()`, line 152). Archiving published content needs publish rights (`canDelete()`,
   line 159).

## 3. Options

### A. Direct publish (current state)

All content staff get `editor`. Each person publishes their own changes.

- **For:** no change; fastest for a small team; nothing waits for an approver.
- **Against:** a wrong product claim, price, contact detail or legal text goes live with no second
  check. Any editor can change Global Content (company contact details, footer, header button,
  m1-014) and redirects site-wide.
- **Work:** none. Record the decision.

### B. Review before publish (recommended)

Content staff get `contributor`. One or two named approvers get `editor`. Developers keep `admin`.

- **For:** a second person checks every public change. This suits an insurance company, where
  product and regulatory text matters. Contributors cannot change redirects, Global Styles or form
  submissions at all.
- **Against:** changes wait for an approver; at least two approvers are needed to cover absence.
  Core sends **no notification** when a draft is submitted: approvers must check the tray icon, or
  staff tell them another way. Email notification would be custom code and a separate decision.
- **Work:** see §5.

### B1. Variant: Global Content for editors only

As B, but contributors cannot even draft Global Content (core `editRole: 'editor'` on
`@apostrophecms/global`, the same supported option used for Global Styles in m1-022).
Only worth it if company-wide details should never be proposed by general staff. Without it,
contributor changes to Global Content still need an editor to publish them.

## 4. Points that apply to every option

| Point | Detail |
|---|---|
| **Media publish at once** | Images, files and their tags are `autopublish: true` in core. An image a contributor uploads is in the published media library at once. It appears on a public page only when a page using it is published, but its file URL works for anyone who has it. Staff must not upload confidential files |
| Redirects | `@apostrophecms/redirect` has `editRole: 'editor'`: contributors cannot see or change them |
| Global Styles | Admin only (D-M0-11, m1-022). Unchanged |
| Form submissions | Admin only (assurer-forms). Unchanged |
| Forms (`@apostrophecms/form`) | Contributors can draft and submit form changes; an editor publishes them |
| Users | Created by an admin with `node app @apostrophecms/user:add <name> <role>`, or in the Users manager. The role can be changed later without data loss |
| Locales | One locale; no translation workflow involved |

## 5. Work after the decision (follow-up task)

| Option | Work |
|---|---|
| A | Record the decision; close D-CONTENT-11 |
| B | No application code for the roles themselves. Add a disposable `contributor` test account (an `assurer-test:ensure-contributor` task like the existing `ensure-editor`, m1-014) and workflow tests: a contributor's publish is refused, submit works, an editor publishes the submitted draft, the public site shows nothing until then. Browser acceptance as contributor and as editor (AGENTS.md rules 3–6). A short editor guide in `docs/content/` |
| B1 | As B, plus `editRole: 'editor'` on `@apostrophecms/global`, and a test that a contributor's Global Content write is refused |

The staff list (who gets which role) is the business owner's input. Names are not stored in the
repository.

## 6. Not verified

- The flow in §2 is read from the installed source. It has **not** been run in this project as a
  contributor. The project's admin-bar groups (m1-022) and form-widget override (m1-012) could
  affect what a contributor sees; the follow-up task tests this in the browser.
- Upstream documentation was not re-read in this task.

## 7. Decision

**Option B**, decided by the owner in session on 2026-11-03 (D-CONTENT-11). Still open: how many
approvers there will be.
