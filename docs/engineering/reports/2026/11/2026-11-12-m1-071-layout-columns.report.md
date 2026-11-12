# m1-071 — The Assurer widgets in layout columns, and more layout options

| | |
|---|---|
| **Task** | m1-071 (the recommended item in the [m1-071 handoff](../../../../milestones/m1-071-handoff.md) §2) |
| **Date** | 2026-11-12 |
| **Scope** | Widgets in layout columns and nested columns, grids that collapse in narrow columns, 3/4/6-column layout starters, grouped "Add Content" menus; added by the owner: the Background style for layouts and columns, and a "Button" style for Rich Text links. Not in scope: image and text animation (goes with the slideshow upgrade), brand colour presets, image `sizes` |
| **Prompt** | [2026-11-12-m1-071-layout-columns.prompt.md](../../../prompts/2026/11/2026-11-12-m1-071-layout-columns.prompt.md) |
| **Design** | [m1-071 layout columns design](../../../../milestones/m1-071-layout-columns-design.md), approved by the owner with every recommended answer (D-CONTENT-21); build changes in its §12 |
| **Branch** | `feat/m1-071-layout-columns` from `origin/main` at `488eadc` (PR #86 merged). Committed and pushed with the owner's approval ("yes"): `36c06b2` code, `a586f01` records; merged by the owner as **PR #87** (`8f11100`). Handoff: [m1-072 handoff](../../../../milestones/m1-072-handoff.md) |

Checks marked agent-executed were run by the agent. They are not human approval.

## What was built

- **One table for all widget menus** (`lib/area.js`): each widget's group and the places it may
  go (page `main`, layout column, nested column). It exports `pageArea`, `columnArea` and
  `nestedColumnArea`; the four page types, `@apostrophecms/layout-column-widget` and
  `nested-column-widget` use them. The two inline copies in the column modules are gone.
- **Grouped menus** in the expanded "Add Content" panel: Text and media, Sections, Listings, Forms,
  Layout, with each widget's description.
- **Grids read their container** (container queries, no package): feature grid, product list,
  people, locations, organisations, gallery, product cards, and the grids on the division and
  product category pages. Widths: 1 per row below 560 px, 2 from 560, 3 from 720, 4 from 900.
  The hero heading size uses its own width (`cqi`); a hero inside a layout has less padding.
- **Layout starters** `layout-3`, `layout-4`, `layout-6`: each extends `@apostrophecms/layout-widget`
  and sets only `defaultSpan`. The core layout is relabelled "Layout: 2 columns". No migration.
- **Background style** (core `background` preset: colour, gradient, image with overlay) on whole
  layouts and on single columns; nested layouts and columns inherit it.
- **Rich Text "Style" for links**: Normal link, Button, Outline button (core `linkFields`,
  written as `data-link-style`; CSS reuses `.assurer-button`).
- New unit test `scripts/area.test.mjs` (5 tests): group order, what each place offers, and that
  every listed project widget has a module.
- Docs: AGENTS.md and ARCHITECTURE.md (the `lib/area.js` row), the content model, the design note.

Files: `lib/area.js`, `app.js`, `modules/layout-{3,4,6}-widget/index.js` (new),
`modules/@apostrophecms/{layout-widget,layout-column-widget,rich-text-widget,home-page}/index.js`,
`modules/nested-column-widget/index.js`, `modules/{default-page,assurer-division-page,assurer-product-category-page}/index.js`,
the two page templates (`.assurer-cq` wrappers), `_sections.scss`, `_corporate.scss`, `_assurer.scss`,
the `project` i18n file, `scripts/area.test.mjs`.

## Changes from the design during the build

Details in the design's §12:

1. Groups show only in the **expanded** menu panel (core 4.34); the design's §2 was wrong about
   the dropdown. All menus now use the expanded panel (Q5). The owner can ask for the flat
   dropdown back.
2. The product cards grid used `1fr` tracks and overflowed a 169 px nested column by 20 px
   (found in Chrome); now `minmax(0, 1fr)` like the other grids.
3. Hero padding uses the layout context (`.layout-widget .assurer-hero`), because a container
   query cannot change the container's own padding.
4. The Rich Text button style was added at the owner's request during the session.

## Results

| Check | Result |
|---|---|
| `npm run lint` | PASS (no errors, no warnings) |
| `npm run test:unit` | PASS 112/112 (incl. 5 new in `area.test.mjs`) |
| `npm run test:smoke` | PASS 18/18 |
| `npm run test:workflow` | PASS 15/15 |
| `npm run test:persistence` | PASS 7/7 |

The server suites ran against a dev server started at 13:56 (nodemon, PID checked) with the
final code.

**Correction during the session:** an earlier run of the three server suites (all passing) was
reported to the owner as "on the new code". It was not: the server on port 3000 was still the
m1-069 process started at 10:56, under a hidden Git Bash from an earlier agent session. The agent
found this from the process start time, told the owner, and reran everything after the owner
stopped that process. The results above are from the reruns only.

## Browser checks (Chrome, agent-executed)

As a disposable **editor** (`node app @apostrophecms/user:add`), on a disposable page
"m1-071 layout test (Demo)", desktop 1440 px unless stated.

| # | Check | Result | Notes |
|---|---|---|---|
| 1 | Page "Add Content" shows the groups in order, with descriptions and the four layout starters | PASS | Expanded panel |
| 2 | "Layout: 3 columns" opens with 3 equal columns | PASS | |
| 3 | Layout column menu: hero, grids, listings, form, Nested Layout; no slideshow, no starters | PASS | Read from the open panel |
| 4 | Nested column menu: simple set and grids; no hero, slideshow or layout | PASS | |
| 5 | 4-column feature grid in a 362 px column shows 1 per row | PASS | Computed `grid-template-columns` |
| 6 | Hero with headline and a button in a layout column | PASS | |
| 7 | Rich Text link with Style "Button" renders as a button, in the editor and published | PASS | `data-link-style="button"` kept by the sanitizer |
| 8 | Background colour on a whole layout | PASS | |
| 9 | Background image with overlay on one column | PASS | Dark text on the overlay is hard to read: the editor must choose a light text colour (Rich Text colour control) |
| 10 | Product card added, edited and saved inside product cards inside a nested column | PASS after fix | Menus and controls inside the container are placed correctly; the 20 px overflow was fixed (above) |
| 11 | Draft not public; draft mode refused when logged out | PASS | 404 and 403 |
| 12 | Published page logged out: content, button, backgrounds; no editor name or draft data | PASS | `curl` |
| 13 | No horizontal overflow at 1440, 768 and 375 px, logged out | PASS | See note |
| 14 | Full-width product grid on the home page at 1440, 1024, 900, 768, 600, 375 px | PASS | Same as before except 900 px: 3 per row instead of 2 (as designed) |
| 15 | Clean-up | Done | Page archived through the UI; editor archived via REST as the test admin; scratch password deleted |

**Note on widths:** the Chrome window could not be resized (it stayed at 1440 px, probably
maximised). The 768 and 375 px checks loaded the page in same-tab `credentialless` iframes of
those widths, so media and container queries used the iframe width and the page was rendered
logged out. This is still Chrome, but not a resized window or a real phone. Not tested: touch
interaction and the editor UI at tablet or phone width.

## Implicit state review

- **Menu contents per area** were three hand-kept lists (one implicit in two modules). Now one
  table decides them; a unit test pins what each place offers. Adding a widget is one line.
- **Starter versus later edits:** a starter only sets the first row; after that it is an ordinary
  layout. Stored type names are brand-free and describe the thing (`layout-3`), so the planned
  rename does not touch them.
- **Grid columns per width** depended on the screen; now on the container. Full-width results are
  unchanged except 800–1023 px.
- **Link style** is a stored attribute with three values; an old link without it is a normal link.
- **Background** has an explicit on/off switch (core). Not checked: whether switching it off keeps
  the chosen values for later.
- No new permission or data state: editors use core styles they already had for other widgets.

## For the owner

1. Done: PR #87 merged. Check m1-071 on the OCI site after the `release` run and `deploy.sh` (the owner said they will).
2. Optional later items: brand colours as the colour presets; image `sizes` for columns; the flat
   dropdown instead of the expanded menu if editors prefer it.
3. Animation is recorded for the slideshow upgrade (next task).

## Not done or not verified

- Not checked on MongoDB or on the OCI site; no deploy.
- Window resizing in Chrome (see the note); no touch device.
- The demo seed does not use the new starters, backgrounds or button links.
- `test:ci` as a whole was not run; the four required suites were.

## Left over

- The local dev server on port 3000 runs from this session (`npm run dev`, nodemon); it stops
  when this session ends. Restart it yourself with `npm run dev` if needed.
- Archived, not deleted: the test page and the user `m1-071-editor` (renamed by core on archive).
