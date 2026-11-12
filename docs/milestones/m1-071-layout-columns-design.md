# m1-071: the Assurer widgets in layout columns, and more layout options (design)

| | |
|---|---|
| **Task** | m1-071 |
| **Date** | 2026-11-12 |
| **Author** | The agent (agent-executed; not a human approval) |
| **Status** | **D-CONTENT-21 decided 2026-11-12 by the owner: approved** ("i approve"), with every recommended answer in §10. The owner added the background style for layouts (§11) in the same message. Being built in m1-071; changes during the build in §12 |
| **Related** | [m1-071 handoff](m1-071-handoff.md) §2 · [content model](../content/apostrophe-content-model.md) (column menus) · [ADR-0003](../architecture/decisions/ADR-0003-corporate-content-model.md) · m1-015 (CA-2 section widgets) · m1-069 prompt record (the owner's order of 2026-11-12) |

This is a paper task. No code was changed. The facts come from the repository at `488eadc`
(PR #86 merged) and `apostrophe` 4.34.0 in `node_modules`.

## 1. The request and the limits

The owner's request (m1-069 records, scope confirmed by the owner on 2026-11-12, "all three"):

1. The column-friendly Assurer widgets in page **layout columns**.
2. In **nested columns**, the simple set, plus the grids once they collapse to one column on
   narrow widths.
3. **More layout starters:** 2, 3, 4 and 6 equal columns, as layout-widget variants through core
   options.

Limits: official Apostrophe APIs first; no new package; Community Edition only; clean
architecture (refactor proposed here, not started, if a clean build needs one); no change to
stored content.

## 2. What is there today

| Fact | Where |
|---|---|
| Page `main` areas share one list, the default export of `lib/area.js`: 11 Assurer widgets, the form, the core layout, rich text, image and video | `lib/area.js`; used by `default-page`, `home-page`, `assurer-division-page`, `assurer-product-category-page` |
| A **layout column** offers only Rich Text, Image, Video and Nested Layout, written inline | `modules/@apostrophecms/layout-column-widget/index.js` |
| A **nested column** offers Rich Text, Image and Video, written inline (a second copy) | `modules/nested-column-widget/index.js` |
| `nested-layout` already extends `@apostrophecms/layout-widget` and only changes options (6-column grid, `minSpan` 2, `defaultSpan` 3) | `modules/nested-layout-widget/index.js` |
| Core opens a new layout with about `columns ÷ defaultSpan` equal columns (`provisionRow`). The core layout is 12 columns with `defaultSpan` 6, so it opens with **2 columns** | `layout-widget/index.js`, `ui/apos/lib/grid-state.mjs`, `AposAreaLayoutEditor.vue` `onCreateProvision` |
| Core stacks layout columns by **screen width**: 601 to 1024 px, 2 per row; up to 600 px, 1 per row | `layout-widget/ui/src/layout.css` |
| The Assurer grids choose their column count by **screen width** (`@media`), not by the width they have: `.assurer-grid` (feature grid, product list, people, locations), `.assurer-org-list`, `.assurer-gallery__grid`, `.assurer-products__grid` | `_corporate.scss`, `_sections.scss`, `_assurer.scss` |
| Stats (`auto-fit`, min 160 px) and downloads (a list) already fit any width | `_sections.scss` |
| The hero heading size uses the screen width (`clamp(2rem, 5vw, 3.5rem)`) and fixed 96 px padding | `_assurer.scss` |
| The gallery lightbox is a modal `<dialog>` (top layer), so it is not affected by where the gallery sits | `assurer-gallery-widget/ui/src/index.js` |
| The area "Add Content" menu supports **groups** (`options.groups`) with collapsible headings; `getWidgets()` merges them | `area/index.js`, `AposAreaMenu.vue` |

Column widths at the 1200 px content width with the 1.5 rem gap: 2 columns ≈ 588 px, 3 ≈ 384 px,
4 ≈ 282 px, 6 ≈ 180 px; a 2-column nested layout inside a 2-column layout ≈ 282 px.

**The problem.** If the widgets were simply added to the column lists, a 4-column feature grid in
a 282 px column on a 1440 px screen would still show 4 cards of about 55 px each, because its
rules read the screen width. That is the "bolted on" case the clean-architecture rule forbids.

## 3. Summary of the design

1. **One source for all widget lists**: `lib/area.js` exports the page list (unchanged default
   export) and two new named lists, `columnWidgets` and `nestedColumnWidgets`, built from the
   same entries. The two column modules import them instead of their inline copies.
2. **Refactor, needs approval (§5):** the Assurer grids switch from screen-width `@media` rules to
   **CSS container queries** (`@container`), so each grid reads the width of the place it sits in.
   On a full-width page the result is the same as today; in a column it collapses.
3. **The hero** gets container-relative heading size and padding, so it fits a column.
4. **Three new layout starters** (3, 4 and 6 equal columns) that extend
   `@apostrophecms/layout-widget` with only `defaultSpan` changed. The existing core layout is the
   2-column starter and is only relabelled, so no stored content changes.
5. **Grouped "Add Content" menus** (Text and media, Sections, Listings, Forms, Layout) in the same
   order everywhere.

## 4. Which widget goes where

| Widget | Page `main` | Layout column | Nested column | Note |
|---|---|---|---|---|
| Rich Text, Image, Video | yes | yes | yes | Already there |
| Form (`@apostrophecms/form`) | yes | yes | yes | Fields are full width; fits any column |
| Downloads | yes | yes | yes | A list; fits any width |
| Stats | yes | yes | yes | Already `auto-fit`; 1 per row below about 180 px |
| Hero | yes | yes | **no** | Needs about 380 px for a heading and two buttons; after §5.3 it fits a 3-column column. Not in nested columns (too narrow, and a banner inside a banner is not a real use) |
| Feature grid, Product grid, Product list, People, Locations, Organisations, Gallery | yes | yes | yes | Only after the §5 refactor; they collapse to 1 or 2 per row |
| Slideshow | yes | **no** | **no** | The owner's list does not include it, and the slideshow upgrade is the next task. Revisit then |
| Layout starters (§6) | yes | **no** | **no** | A column offers `nested-layout` instead, as today. Core supports one level of nesting in this project; a nested column offers no further layout |
| Nested Layout | no | yes | no | As today |

There is no hard minimum width after the refactor: each grid falls to one card per row. The
6-column starter (≈ 180 px per column) is meant for small items (icons, figures, short text). The
editor can still put a grid in it; it shows one card per row. That is acceptable, not broken.

## 5. The refactor: grids that read their container (needs approval)

### 5.1 What changes

- Each grid widget's outer element becomes a size container: `container-type: inline-size`, in
  one shared rule (a class such as `.assurer-cq` on the widget root, or the existing root classes
  `.assurer-section` and `.assurer-products`; the build picks one and uses it everywhere).
- The two page templates that use `.assurer-grid` and `.assurer-org-list` directly
  (`assurer-division-page`, `assurer-product-category-page`) get the same container on the
  section that holds the grid.
- Every `@media (min-width: …)` rule for these grids becomes `@container (min-width: …)` with the
  **same** thresholds (768 px → 2 per row, 1024 px → 3 or 4). Today the content is at most
  1200 px wide, so a full-width grid on a desktop still reaches its 3 or 4 columns; on tablets and
  phones the container is narrower than the screen, so a grid may collapse a little earlier than
  today. The browser checks compare both.

  Proposed thresholds, to confirm in the build against real cards:

  | Container width | Cards per row |
  |---|---|
  | under 480 px | 1 |
  | 480 to 767 px | 2 |
  | 768 px and up | the editor's choice (3 or 4), else 2 |

- Browser support: container queries are in all current browsers (Chrome/Edge 105, Safari 16,
  Firefox 110). No polyfill, no package.

### 5.2 Why the widget root, not `<main>` or the layout column

A size container also gets layout containment: it becomes the containing block for
`position: fixed` content inside it. Putting it on `<main>` or on every layout column would put
Apostrophe's own editing controls (widget menus, toolbars) inside the containment, where they could
be placed wrongly. On the widget root, only the widget's own markup is inside. The one exception is
the product grid, whose cards are an area inside the widget: the build tests its card controls
(add, move, edit) in a column as an editor. If they misbehave, the product grid's container moves
one level down, to the cards list only.

### 5.3 The hero

The hero root becomes a size container too. The heading size changes from `5vw` (screen) to
`cqi` (container), with the same minimum and maximum, and the padding drops from 96 px to 48 px
below a 480 px container. On a full-width page it looks as it does today.

### 5.4 Image sizes

The cards' `sizes` attributes describe the screen (`(min-width: 1024px) 33vw, …`). In a column
the browser downloads a larger image than it needs. It looks correct and is not a defect, so it is
**not** in m1-071; recorded as a later improvement.

## 6. Layout starters

| Menu label | Widget type | `columns` | `defaultSpan` | `minSpan` | Opens with |
|---|---|---|---|---|---|
| Layout: 2 columns | `@apostrophecms/layout` (existing, relabelled) | 12 | 6 | 2 | 2 columns |
| Layout: 3 columns | new | 12 | 4 | 2 | 3 columns |
| Layout: 4 columns | new | 12 | 3 | 2 | 4 columns |
| Layout: 6 columns | new | 12 | 2 | 2 | 6 columns |

- Each new type is a two-line module that `extend`s `@apostrophecms/layout-widget` and sets only
  `label` and `defaultSpan`, exactly as `nested-layout` already does. It inherits the columns area
  (`@apostrophecms/layout-column`), the core styles and the project's width and alignment styles
  from `modules/@apostrophecms/layout-widget/index.js`. Core's `validateAndIdentifyTypes` checks
  each at start-up.
- After the layout opens, the editor can still resize, add and remove columns as today; the
  starter only sets the first row. On tablets core shows 2 per row and on phones 1, for every
  starter.
- **Stored type names (question Q2).** A widget's module name is stored in every page that uses it.
  The project convention is the `assurer-` prefix; the owner's rename plan says stored names stay
  brand-free. The agent recommends brand-free names that describe the thing: `layout-3-widget`,
  `layout-4-widget`, `layout-6-widget` (stored as `layout-3`, `layout-4`, `layout-6`), like
  `nested-layout`.

## 7. The "Add Content" menu

The same groups and order in all three menus; a group shows only the widgets allowed there.

| Group | Widgets (in this order) |
|---|---|
| Text and media | Rich Text, Image, Video |
| Sections | Hero, Feature grid, Key figures (Stats), Downloads, Gallery, Slideshow |
| Listings | Product grid, Product list, People, Locations, Organisations |
| Forms | Form |
| Layout | Layout: 2 / 3 / 4 / 6 columns (page) · Nested Layout (layout column) |

Implementation: `lib/area.js` holds one table of entries, each with its group and the places it
may appear, and exports the three area option objects (`groups` form). The default export keeps
its current shape for the page templates, so `default-page`, `home-page` and the two page types do
not change, or change by one import line only. Labels go through the `project:` i18n namespace.

## 8. Architecture and files

| File | Change |
|---|---|
| `lib/area.js` | One entry table; exports the page, column and nested-column area options |
| `modules/@apostrophecms/layout-column-widget/index.js` | Uses the shared column list |
| `modules/nested-column-widget/index.js` | Uses the shared nested list |
| `modules/@apostrophecms/layout-widget/index.js` | Adds the "Layout: 2 columns" label |
| `modules/layout-3-widget/`, `layout-4-widget/`, `layout-6-widget/` (names per Q2) | New, `index.js` only; registered in `app.js` |
| `modules/asset/ui/src/scss/_sections.scss`, `_corporate.scss`, `_assurer.scss` | `@media` → `@container` for the grids; hero sizing |
| Grid widget templates and the two page templates | The container class on the root or section, if the existing root classes are not used |
| `modules/@apostrophecms/i18n/i18n/project/*.json` | Group and starter labels |
| `docs/content/apostrophe-content-model.md` | The column menus row and §5 updated |

No migration: no stored field or type changes. Existing layouts keep their columns.

## 9. Tests and proof

- `npm run lint`, `test:smoke`, `test:workflow`, `test:persistence`.
- A new check in the smoke or workflow suite: the three area lists contain what §4 says (for
  example, a feature grid is accepted in a layout column and a slideshow is refused), and each
  starter opens with the right column count (server side: the type is registered and its options
  validate).
- **Browser, as an editor (not admin), agent-executed:** add each starter; put a feature grid,
  product grid, people list and gallery in a 3-column and a 6-column layout and in a nested column;
  add, move and edit product cards in a column; check the menu groups; publish and check the
  logged-out page. At 1440, 768 and 375 px: no horizontal overflow, grids collapse, full-width
  grids look as they did before (compared with screenshots from `main`). Draft/published
  isolation for the test page. Disposable editor and page archived afterwards.
- The implicit state review (STANDARDS.md): the states here are the menu contents per area, the
  starter's first row versus later edits, and the grid's column count per container width.

## 10. Questions for the owner

| # | Question | Recommendation |
|---|---|---|
| Q1 | Approve the container-query refactor (§5) for the existing grids and the hero? | **Yes.** Without it the widgets cannot go into columns cleanly |
| Q2 | Names of the new starters: brand-free `layout-3`, `layout-4`, `layout-6`, or `assurer-layout-3` … per the module prefix rule? | **Brand-free**, like `nested-layout`; fits the rename plan |
| Q3 | Keep the slideshow out of columns until the slideshow upgrade? | **Yes** |
| Q4 | The hero in layout columns but not in nested columns? | **Yes** |
| Q5 | Grouped menus (§7) in all areas, including page `main`? | **Yes**, one order everywhere |
| Q6 | Image `sizes` for widgets in columns: later task? | **Later** (§5.4) |

After approval: branch `feat/m1-071-layout-columns` from `origin/main`, build, tests, browser
checks, report. No commit, push or PR without the owner's approval.

## 11. Background for layouts and columns (added by the owner, 2026-11-12)

The owner asked, with the approval, why a layout's background colour cannot be changed.

- **Why not before:** core 4.34 ships a `background` style preset (colour, gradient, or image
  with an optional overlay colour and opacity). The project's styles for
  `@apostrophecms/layout-widget` only added `width` and `alignment`, and the layout column had only
  core's own column styles. Configuration, not a missing feature.
- **m1-071:** `background: 'background'` is added to the styles of `@apostrophecms/layout-widget`
  (the whole layout) and `@apostrophecms/layout-column-widget` (one column). The starters,
  `nested-layout` and `nested-column` extend these modules, so they inherit it. No new package,
  no stored type change; editors open it from the palette (Styles) button.
- **Contrast is the editor's job:** the colour picker is free. Text on a dark background or an
  image needs the overlay option or a light text colour; the browser checks look at this, and the
  [publishing workflow guide](../content/publishing-workflow-guide.md) gets one line. A brand
  palette in the colour picker (`presetColors`) is a possible later step, not in m1-071.

## 12. Changes during the build (m1-071)

- **Container thresholds** (§5.1, confirmed): 1 per row below 560 px, 2 from 560, 3 from 720,
  4 from 900 (gallery: 2 always, 3 from 720, 4 from 900). At a 1024 px screen the content is about
  960 px wide, so full-width grids keep 3 or 4 per row as today; between about 800 and 1023 px
  they now show 3 instead of 2.
- **Containers:** `.assurer-section`, `.assurer-products`, `.assurer-hero` (existing widget root
  classes, so no widget template changed) and a new `.assurer-cq` on the grid sections of the
  division and product category page templates.
- **Hero padding** (§5.3): a hero inside a layout widget (`.layout-widget .assurer-hero`) has
  48 px vertical padding instead of 96 px. A container query cannot change the padding of the
  container itself, so this uses the layout context instead.
- **Grouped menus need the expanded panel** (§7 corrected). In core 4.34 an area's `groups` show
  as headings only in the expanded "Add Content" panel (`expanded: true`), which also shows each
  widget's description. The small dropdown ignores groups and lists widgets flat. §2 said the
  dropdown has collapsible group headings; that was wrong. All three menus use the expanded panel,
  which is what Q5 asked for; the owner can ask for the dropdown back (flat, in group order).
- **Product grid tracks** (found in the browser): the cards grid used `1fr` tracks, which cannot
  shrink below a card's minimum content width, so a card overflowed a 169 px nested column by
  20 px. It now uses `minmax(0, 1fr)`, like the other grids.
- **Button style for Rich Text links** (the owner's "yes" to the question in §12 request 1): core
  `linkFields` adds a "Style" choice (Normal link, Button, Outline button) to the link dialog; the
  value is written as `data-link-style`, which core's sanitizer allows because it is a declared
  `htmlAttribute`. CSS reuses `.assurer-button`.
- **Colour presets:** the background colour picker shows core's five default swatches, not the brand
  colours. Setting `presetColors` on `@apostrophecms/color-field` to the brand tokens is a small later
  change (it also affects Global Styles, which only admins see).
- `lib/area.js` now exports `pageArea`, `columnArea` and `nestedColumnArea` (area options with
  `groups`); the old default export (a `widgets` map) is gone and the four page types use
  `pageArea`. AGENTS.md and ARCHITECTURE.md mention the old shape and are updated with the build.

### Requests from the owner during m1-071, not in this design

1. **Text and buttons over images.** Possible today in two ways: the **hero** (image, heading,
   text, buttons, overlay), which m1-071 allows in layout columns; or a column with a background
   image (§11) and Rich Text in it. Rich Text had no button style; **added in m1-071** at the owner's request
   ("yes, add the button style"), see the build changes above.
2. **Image and text animation.** Not in any plan yet. The editorial requirements say motion must
   respect `prefers-reduced-motion` and allow no auto-moving text effects; animation libraries
   were declined on 2026-10-29 (GSAP licence, Lenis scrolling). A dependency-free option exists
   (CSS entrance effects, started by `IntersectionObserver`, chosen per widget as a style, off
   under reduced motion).
   **Decided by the owner 2026-11-12:** animation goes with the slideshow upgrade, which also
   handles motion (WCAG 2.2.2). Core 4.34 has no animation feature (no style preset, no widget
   option), so it is project CSS and a small script there.
