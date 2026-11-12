# AGENTS.md — VCL-ASSURER-GROUP

Assurer World website on ApostropheCMS Community Edition, derived from
starter-kit-essentials. Project-specific rules come first; the starter kit's
conventions follow and still apply.

## Engineering rules (binding for humans and AI agents)

These rules govern all work in this repository. Process detail lives in
`docs/engineering/STANDARDS.md` and `docs/engineering/git-and-ci.md`; decisions
in `docs/architecture/decisions/`. If a request conflicts with a rule, stop and ask.

### Scope and change policy
- **Minimal change.** Do what the task asks, nothing more. No opportunistic refactors,
  renames or reformatting of unrelated code. Match surrounding style.
- **Clean architecture, never bolted on** (owner's standing instruction, 2026-11-11). Build
  code cleanly and modularly, with proper architecture and separation of concerns. Never bolt a
  feature on only because it was asked for. If it cannot be built naturally into the existing
  design and a refactor would make the whole thing clean, stop before the work and say so,
  with the refactor you recommend. Do not start the refactor without approval (Minimal change).
- **Official Apostrophe APIs first.** Use pages, pieces, widgets, schema fields, the query
  builder, the REST API, `@apostrophecms/migration` and core tasks before writing anything
  custom. Read the installed source in `node_modules/apostrophe` when docs are unclear.
- **No unapproved dependencies.** Adding, removing or major-upgrading a package needs explicit
  human approval, a license check, and an advisory check (GitHub advisories + `npm audit`).
- **Community Edition only.** Never add `@apostrophecms-pro/*` or Assembly modules, and never
  design around Pro-only features without an approved ADR.

### Data and database safety (see ADR-0002)
- Content is accessed only through Apostrophe APIs. **No ORM, no parallel CMS database, no raw
  SQL** for content operations.
- **Never** run `apos-db-restore`, drop or delete collections, or point the app at a
  non-local database without explicit approval. Restore is destructive. Restore into a
  new, empty database only.
- Schema/data changes ship as `@apostrophecms/migration` migrations that are idempotent and
  tested on a copy first. Back up (database **and** media) before running them anywhere shared.
- Every site has its own database, media store and secrets. Never copy one site's database
  into another.

### Security by default
- **No secrets in source, docs, reports, commit messages or test fixtures.** Secrets live in
  `.env` (git-ignored) or the platform secret store. Database dumps are secrets.
- New endpoints, forms and uploads need server-side validation, size limits and an
  authorization check. Keep `127.0.0.1` binding and the required `APOS_SESSION_SECRET`.
- Never paste session transcripts, tool output containing tokens, or personal data into
  tracked files.

### Testing before completion
- Before reporting work as done, run `npm run lint`, `npm run test:smoke`,
  `npm run test:workflow` and `npm run test:persistence` (server running; test
  credentials are read from the git-ignored `.env`).
  Report the **actual** results, including failures and anything not verified.
- **Final check for every feature: the implicit state review** (added m1-066, owner's standing
  instruction). Find the implicit state machines the change adds or touches, and make the
  decision that improves user, developer and agent experience without breaking anything. Steps
  and the report section are in `docs/engineering/STANDARDS.md`.

### Browser acceptance testing (added m0-008)
Automated suites call the API as admin. They do not prove that the UI works for real editors.
Each task's report includes a browser checklist (see `docs/engineering/STANDARDS.md`).
1. **Use the authorized Chrome extension** (Claude in Chrome) for end-to-end UI checks where the
   task touches anything a user sees or does. Local hosts only, unless the owner approves otherwise.
2. **Run the relevant browser checks at the end of every completed feature or phase**, after the
   automated suites. Docs-only tasks run a short smoke check of the public site.
3. **Test normal editor capabilities as a non-administrator.** Create a disposable account with the
   supported `node app @apostrophecms/user:add <name> editor` task. Use admin only for admin-only
   features.
4. **Use real UI interactions**: clicks, typing, uploads, drag or arrows, publish. An HTTP status
   or a visible control is not a pass on its own.
5. **Check desktop, tablet and mobile layouts** (about 1440, 768 and 375 px) when layout or
   templates change. Check for horizontal overflow.
6. **For content changes, check draft/published isolation and access**: a draft is not public, a
   published change is, an unpublished edit stays hidden, and logged-out users get no draft or
   user data.
7. **Capture sanitized evidence when it helps**, such as screenshots under `evidence/<task-id>/`
   (git-ignored). No passwords, tokens, personal data or unrelated tabs in frame.
8. **Keep browser credentials, sessions and sensitive screenshots out of Git**, reports and chat.
   Keep test passwords in a scratch file outside the repository, or in `.env`.
9. **Record each check as PASS, FAIL, BLOCKED or NOT TESTED**, with steps, the actual result and
   evidence. Never record an expected result as an actual one.
10. **Agent-executed acceptance is not human approval.** Label agent runs as agent-executed.
    Business and usability approval comes only from a named human, recorded in the repository.
11. **Clean up afterwards**: archive disposable test content and accounts through supported
    Apostrophe UI, REST API or tasks. Never touch other people's content or accounts; never
    hard-delete data. Record whatever is left over.
12. **If Chrome is unavailable, stop and report it.** Mark the browser checks BLOCKED, and do not
    swap in another tool without the owner's approval or claim browser tests that did not run.

### Records
- Each task has an ID (`mN-NNN`), a prompt
  (`docs/engineering/prompts/YYYY/MM/YYYY-MM-DD-mN-NNN-*.prompt.md`) and a report
  (`docs/engineering/reports/YYYY/MM/YYYY-MM-DD-mN-NNN-*.report.md`), indexed in
  `docs/engineering/INDEX.md`. Never rewrite historical reports or invent past prompts.

### Sessions and context (Claude Code and other agents)
- Start a **new session at every new milestone**, and for any materially different task once
  the earlier context no longer helps.
- At the start of every session, read this file, the ADRs relevant to the task, the latest
  reports in `docs/engineering/INDEX.md`, and the Git state (branch, uncommitted changes,
  `origin/main`).
- The repository documents are the source of truth. Do not rely on an earlier conversation's
  context; if something matters, it must be in a tracked document.
- Archive each task's prompt and a sanitized report under the ISO-date naming convention
  (Records, below). Never archive raw transcripts or tool output containing secrets.
- Finish each milestone with an explicit handoff document and an instruction to start a fresh
  session for the next milestone.

### Git and approvals
- Work on short-lived branches (`<type>/mN-NNN-description`); merge to protected `main` by
  pull request only. Commit messages follow Conventional Commits.
- **No commits, pushes, merges, tags, deployments or GitHub setting changes without explicit
  human approval for that action.** Never rewrite published history or force-push.
- **Architecture gates need explicit human approval:** accepting an ADR, changing database
  engine or storage, adding dependencies, anything touching production, and starting a new
  milestone. Stop and wait at each gate.
- Never modify production systems, mimPortal, or the existing WordPress site or database.

### Project conventions
- Project modules use the `assurer-` prefix (`modules/assurer-*`); core overrides live
  under `modules/@apostrophecms/<module>/`.
- Page-or-URL links use `linkFields()` / `linkHref()` from `lib/link.js`. Page-level `main`
  areas use `lib/area.js`.
- Demo content is seeded by `node app assurer-demo:seed` and is always labelled "Demo".

---

# Starter-kit conventions


Machine-readable project brief for AI coding assistants. Facts and conventions only. For anything
not covered here — API details, options, edge cases — consult the docs:
https://apostrophecms.com/docs/

---

## Architecture

ApostropheCMS 4 project using ES modules (`"type": "module"`). Modules live in `modules/`,
shared field config in `lib/`, **JSX templates** in `views/` and `modules/*/views/`. Asset
pipeline uses `@apostrophecms/vite`; client-side source is in `modules/asset/ui/src/`.

This project is **fully converted from Nunjucks to JSX**. Write new templates as `.jsx`. Nunjucks
remains fully supported by Apostrophe core and the two interoperate — see
[JSX/Nunjucks Interop](#jsxnunjucks-interop) for the one hard rule.

JSX here is **server-side rendering only** — no React, no virtual DOM, no client runtime. It's an
alternate template syntax evaluated where Nunjucks would have run, implemented by Apostrophe core
itself (`apostrophe/modules/@apostrophecms/template/lib/jsx*.js`). No `react`/`react-dom` package.

## Dev Commands

```
npm run dev      # start with nodemon (watches modules/, lib/, views/, incl. .jsx)
npm start        # start without watch
npm run build    # production asset build
npm run serve    # production server
```

## Anatomy of a JSX Template

Default-export a function taking `(data, helpers)`:

```jsx
export default function ({ page }, { Area }) {
  return (
    <>
      <h1>{page.title}</h1>
      <Area doc={page} name="main" />
    </>
  );
}
```

- **`data`** — same object as `data.*` in Nunjucks. Destructure it; write `page.title`, not
  `data.page.title`.
- **`helpers`** — `{ apos, helpers, Area, Component, Extend, Template, Widget, __t }` (below).
- May be `async` if the template itself needs to fetch something first; Apostrophe awaits all
  output regardless, so async children don't require it.

## The Second Argument

| Name | Purpose |
|------|---------|
| `apos` | The real `self.apos`. Call any module method directly. **Prefer this.** |
| `helpers` | Nunjucks-oriented helper wrappers — use only when you need a Nunjucks helper's exact behavior. |
| `Area` | Renders an area. Replaces `{% area %}` |
| `Component` | Invokes an async component. Replaces `{% component %}` |
| `Template` | Renders another template, **include semantics** (props arrive as data). Replaces `{% include %}` |
| `Extend` | Renders another template, **extends semantics** — props become `{% block %}` overrides against a `.html` target. Replaces `{% extends %}` |
| `__t` | Localization helper — same `req.t` as Nunjucks's `__t` global. Not on `data` or `helpers`. |

`Widget` also exists, for the rare case of reimplementing `area.html` itself — see the
[JSX templates guide](https://apostrophecms.com/docs/guide/jsx-templates.html) rather than reaching for it from this brief.

## Nunjucks → JSX Gotchas

Full Nunjucks-to-JSX mapping in the
[JSX templates guide](https://apostrophecms.com/docs/guide/jsx-templates.html). Things that
guide won't warn you about:

- No `key`/`ref` — there's no client reconciler. Don't add them, even inside `.map()`.
- `style` accepts a **plain string**, unlike React (`` style={`background-image: url(${url})`} ``).
- Templates are real JS modules — `import` helpers, define extra components in the same file.
- Only the default export receives `helpers`. Inline/imported components are plain functions —
  pass `apos`, `Area`, `__t` etc. in as explicit props, under their own names (`__t={__t}`).

## Adding a Widget

Standard Apostrophe widget setup — see the
[custom widgets guide](https://apostrophecms.com/docs/guide/custom-widgets.html). The one
difference here: write the template as `.jsx`.

```jsx
// modules/card-widget/views/widget.jsx
export default function ({ widget }, { Area }) {
  return (
    <div className="widget card-widget">
      <Area doc={widget} name="contentRT" />
    </div>
  );
}
```

## Adding a Page Type

Standard Apostrophe page type setup — see the
[pages and page types guide](https://apostrophecms.com/docs/guide/pages.html). Two differences
here: write the template as `.jsx`, and it extends the site layout by passing named slots as
props instead of using `{% block %}`:

```jsx
// modules/default-page/views/page.jsx
export default function ({ page }, { Extend, Area }) {
  return (
    <Extend templateName="layout.jsx" main={<Area doc={page} name="main" />} />
  );
}
```

## Template Discovery

Apostrophe discovers templates by filename — no registry required.

| Template type | Path convention |
|---------------|-----------------|
| Widget | `modules/<widget-name>/views/widget.jsx` |
| Page | `modules/<page-type>/views/page.jsx` |
| Piece index | `modules/<piece-page>/views/index.jsx` |
| Piece show | `modules/<piece-page>/views/show.jsx` |

Lookup tries `.jsx`, `.njk`, then `.html` per directory, nearest module directory first — a
project-level `page.jsx` beats a core-level `page.html`. A `.jsx`/`.njk`/`.html` suffix in a
`templateName` is a starting point, not a constraint: all three extensions are still tried.

## JSX/Nunjucks Interop

> **A `.html` template cannot `{% extends %}`/`{% include %}`/`{% import %}` a `.jsx` template.**
> The reverse (JSX consuming Nunjucks, incl. `<Extend>` block overrides) is fully supported.

This includes `.html` templates inside `node_modules`: core's `@apostrophecms/page/views/notFound.html`
extends `layout.html`, so a JSX layout breaks every 404 page unless shadowed — which is why
`modules/@apostrophecms/page/views/notFound.jsx` exists. Don't delete it.

This project has no other `.html` overrides; core's `@apostrophecms/template/views/outerLayout.html`
is used as-is, and `views/layout.jsx` extends it directly via
`<Extend templateName={data.outerLayout} … />`.

## Template Inheritance

```
outerLayoutBase.html  ← ApostropheCMS core (never edit)
  outerLayout.html    ← core default; override in modules/@apostrophecms/template/views/ only for <head>/meta changes
    views/layout.jsx  ← edit for site chrome (header, nav, footer)
      modules/<page-type>/views/page.jsx ← edit for page content
```

No named blocks in JSX — markup the parent renders is passed as props, plus the implicit
`children` prop for anything between the opening/closing tags.

## Data Sources in Templates

Available on the first function argument. Destructure what you need.

| Variable | Contents | Notes |
|----------|----------|-------|
| `widget` | Widget document | Widget templates only |
| `page` | Current page document | All page templates |
| `piece` | Current piece document | Piece-type page templates only |
| `global` | Global settings document | Requires `@apostrophecms/global` |
| `user` | Authenticated user or `null` | All templates |
| `home` | Home page document | All templates |
| `query` | Query string as object | All templates |
| `outerLayout` | Resolves the correct outer layout | Handles full-page vs AJAX |
| `contextOptions` | Context options passed by the enclosing area | Widget templates |
| `children` | Markup passed between a caller's tags | Templates used as layouts |

## `_` Prefix Convention

Relationship fields are prefixed with `_` (e.g., `_linkPage`, `_author`).
- Value is always an **array**, even with `max: 1`
- Not stored in the document — joined at query time
- Access single results via `doc._field[0]`

## Shared Field Utilities (`lib/`)

| File | Exports | Use for |
|------|---------|---------|
| `lib/area.js` | `pageArea`, `columnArea`, `nestedColumnArea` (grouped widget menus) | Area field `options` |
| `lib/link.js` | `linkFields(condition)`, `linkHref(item)` | Page-or-URL link fields |

```js
import { pageArea } from '../../lib/area.js';
// then: options: pageArea
```

## i18n Key Convention

All project translation strings use the `project:` namespace.

- Key format: `'project:camelCaseKey'` (e.g., `'project:linkText'`)
- Translation files: `modules/@apostrophecms/i18n/i18n/project/<locale>.json`
- Register namespace: `modules/@apostrophecms/i18n/index.js` → `i18n: { project: { browser: true } }`
