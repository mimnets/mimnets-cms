# ApostropheCMS content model (proposal)

| | |
|---|---|
| **Task** | m1-013 |
| **Date** | 2026-10-20 |
| **Status** | Proposal (m1-013). **Update 2026-10-20 (m1-014):** the owner approved the foundation (D-CONTENT-8). It is recorded as [ADR-0003](../architecture/decisions/ADR-0003-corporate-content-model.md) and built as described in [§0](#0-implementation-status-m1-014). ADR-0003 is authoritative where it differs from this proposal. §5's SEO group, the widgets in §6 and the dependencies in §7 are **not** implemented. |
| **Constraints** | [ADR-0001](../architecture/decisions/ADR-0001-cms-platform-and-starter.md) (Community Edition only) · [ADR-0002](../architecture/decisions/ADR-0002-database-strategy.md) (Apostrophe-native data access; database-agnostic; **no production database is selected, PostgreSQL is development and testing only**) · [AGENTS.md](../../AGENTS.md) conventions (`assurer-` prefix, JSX templates, `lib/link.js`, `lib/area.js`) |
| **Related** | [Inventory](./wordpress-site-inventory.md) · [Information architecture](./corporate-information-architecture.md) · [Editorial and design requirements](./editorial-and-design-requirements.md) · [SEO plan](./seo-and-migration-plan.md) |

## 0. Implementation status (m1-014)

Built in m1-014 ([report](../engineering/reports/2026/10/2026-10-20-m1-014-content-model-foundation.report.md)). The details are in ADR-0003.

| Proposal item | As built | Difference and reason |
|---|---|---|
| `assurer-division-page` | `intro`, `_organizations`, `main`; child category pages listed automatically in tree order | No `_categories` relationship: the page tree is the single source. No SEO fields (CA-3) |
| `assurer-product-category-page` | `summary`, `_heroImage`, `intro`, `main`; `_products` is a **reverse** relationship | The product owns its category links (`_categories`), so a product has one source of truth. No `_documents` yet (downloads, CA-2) |
| `assurer-product` | `displayTitle`, `summary`, `description` area, `_categories`, `_image`, `_gallery`, `displayOrder` | No `botanicalName` until real data needs it |
| `assurer-organization` | `shortDescription`, `_logo`, `_parentOrganization`, `websiteUrl` (http/https only), `_locations` (reverse), `displayOrder` | No `shortName`, `city`/`country`, `role` or `body` area yet: unverified facts are not modelled ahead of the owner's data (D-CONTENT-2) |
| `assurer-person` | `title` (full name), `jobTitle`, `_organization`, `_photo`, `bio`, `displayOrder` | **No** `showContact`/`publicEmail`/`publicPhone`, and no `group` select. Privacy by schema until D-CONTENT-4 |
| `assurer-location` | `city`, `country`, structured `address`, `_organization`, `showContact` (off), `publicPhone`, `publicEmail`, `displayOrder` | No `kind` or `mapUrl` yet |
| Global settings | Contact (email, phone, address), footer (text, copyright name, `_footerLocations`, social links), header button (`linkFields()`) | No organisation or SEO-defaults groups, no messaging channels, no quick links: they wait for owner data and CA-3 |
| `hideInNav` | Core's existing `orphan` field ("Hide in Navigation") | No new field needed |
| `@apostrophecms/file` fields, the 8 widgets, SEO, sitemap, redirects | Not built | CA-2, CA-3. **Update 2026-10-29 (m1-015):** the 8 widgets are built; see below |

### m1-015 update: the eight widgets (CA-2)

Built in m1-015 ([report](../engineering/reports/2026/10/2026-10-29-m1-015-listing-and-section-widgets.report.md), [ADR-0003 status note](../architecture/decisions/ADR-0003-corporate-content-model.md#status-note-m1-015-2026-10-29-ca-2-widgets-built)). Differences from §6: people have no `group` filter (offered: hand-picked · of one organization); locations have no "by kind" mode (offered: all · of one organization · hand-picked); the product list's category mode takes a chosen category page, or the current one; downloads use core file pieces and tags, with no file-piece schema change. Section intros are a rich-text area (H2 and paragraph) on every widget.

## 1. What exists today (verified in the code on 2026-10-20)

| Kind | Module | Notes |
|---|---|---|
| Page type | `@apostrophecms/home-page` (`modules/@apostrophecms/home-page/`) | `title`, `main` area (`lib/area.js`) |
| Page type | `default-page` (`modules/default-page/`) | `title`, `main` area. The only page type editors can choose besides Home (`modules/@apostrophecms/page/index.js`) |
| Widget | `assurer-hero` | Eyebrow, rich-text heading area (H1/H2/P), background image, overlay, up to 2 buttons (`linkFields()`) |
| Widget | `assurer-slideshow` | 1–12 slides (image + caption), autoplay that respects reduced motion |
| Widget | `assurer-product-grid` + `assurer-product-card` | Intro area, 2/3/4 columns, cards (image, badge, title, body, optional link) placed by drag and drop |
| Widget | `@apostrophecms/rich-text`, `image`, `video`, `layout` (+ `nested-layout`) | Core; Styles presets for width, alignment, margin, padding. **m1-071:** layout starters `layout-3`, `layout-4`, `layout-6` (the core layout is the 2-column one); Background style (colour, gradient, image) on layouts and columns; Rich Text links can be styled as buttons |
| Widget | `@apostrophecms/form` (+ text, textarea, select, boolean fields) | Contact forms; notifications, review page, CSV export and retention task from m1-012 (`modules/assurer-forms/`) |
| Global styles | `@apostrophecms/styles` | Site-wide typography and spacing sliders (editors can change them: D-M0-11) |
| Layout | `views/layout.jsx` | Header nav = **top-level pages only** (`home._children`), no submenus. Footer text and the demo notice are **hard-coded** |
| Not configured | `@apostrophecms/global` fields, piece types (other than core image, file, user), locales, SEO fields, sitemap, redirects | — |
| Core, unused | `@apostrophecms/file` piece + `@apostrophecms/file-widget`; `@apostrophecms/soft-redirect` (on, 302 default); `@apostrophecms/document-versions`; `@apostrophecms/ai` engine (no provider configured) | Available without new dependencies |

**Gaps that block the proposed site:** no structured records (products, companies, people,
locations, documents); no global contact or footer fields; one-level navigation; no meta
description, canonical or social tags; no XML sitemap or robots.txt (both 404 locally); no 301
redirect control; no gallery, statistics, downloads or people listing.

## 2. Modelling rules

1. **Pieces for records that repeat or will grow**, shown through relationship-driven widgets.
   One record, many placements, no copy-paste.
2. **Pages for URLs that need their own layout and SEO**: home, division, category, corporate pages.
3. **Areas with the shared widget set** (`lib/area.js`) for everything editorial, so editors
   compose pages from approved blocks.
4. **Reuse before building:** core widgets, then existing `assurer-*` widgets, and only then a new
   widget. New widgets are small, have fixed markup and expose content fields only (no free CSS,
   no raw HTML). The core `@apostrophecms/html-widget` stays **disabled**.
5. **Database-neutral:** everything is ordinary Apostrophe documents, relationships and
   attachments. No custom collections, no raw queries; works the same on SQLite (local and CI),
   PostgreSQL (development and testing only, D-DB-6) and any engine chosen later.
6. **Schema changes ship as migrations** (`@apostrophecms/migration`), idempotent and tested on a
   copy, per AGENTS.md.

## 3. Page types

| Page type | Status | Purpose | Fields beyond `title` | URLs |
|---|---|---|---|---|
| `@apostrophecms/home-page` | Exists; extend | Home | `main` area (unchanged) + SEO fields | `/` |
| `default-page` | Exists; extend | About, Services, Leadership, Downloads, Contact, Privacy, Gallery, Careers later | `main` area + SEO fields + `hideInNav` | most corporate URLs |
| `assurer-division-page` | **New** | Style and Health landing pages, and the `/products` hub | `intro` area; `_categories` (ordered relationship to category pages; defaults to children); `main` area; SEO fields | `/products`, `/style`, `/health` |
| `assurer-product-category-page` | **New** | The six category pages | `_heroImage`; `summary` (plain text, also used on cards and as the default meta description); `intro` area; `_products` (ordered relationship to `assurer-product`); `_documents` (relationship to `@apostrophecms/file`, tagged downloads); `main` area for extra sections; SEO fields | `/style/*`, `/health/*` |
| `assurer-organization-page` | **Later** (piece page) | Per-company profile pages, when content exists (D-CONTENT-2) | — (`@apostrophecms/piece-page-type` for `assurer-organization`) | `/group/<slug>` |
| `assurer-news-page` | **Later** (piece page) | News index and articles (D-CONTENT-6) | — | `/news`, `/news/<slug>` |

Why the two new page types rather than `default-page` with widgets: categories and divisions need
**required, consistent fields** (summary, image, product list) that feed cards elsewhere, the
meta description and structured data. A free-form area cannot guarantee that.

## 4. Piece types

| Piece type | Status | Fields | Shown by | Notes |
|---|---|---|---|---|
| `assurer-product` | **New** | `title`; `_image`; `summary` (≤ 160 chars); `_gallery` (images, ordered); `botanicalName` (optional, for herbs); `tags`/category relationship; `sortOrder` | category pages (`_products`); `assurer-product-list` widget | **No show pages at launch**: today's site has none, and one-sentence pages would be thin (D-CONTENT-3). About 45 records at migration |
| `assurer-organization` | **New** | `title` (legal or trading name); `shortName`; `city`, `country`; `role` (e.g. "Headquarters", "Group company"; select, owner-defined); `summary`; `body` area; `_logo`; `websiteUrl` (url); `_locations` | `assurer-organizations` widget on `/group` and the home page; later show pages | 9 records at migration, wording to be confirmed |
| `assurer-person` | **New** | `title` (name); `jobTitle`; `group` (select: Business management · Business partners · Business leaders; owner may rename); `_photo`; `bio` (short text); `_organization`; `showContact` (boolean, **default off**); `publicEmail`, `publicPhone` (shown only if `showContact`) | `assurer-people` widget on `/leadership` | 17 records. Contact details off by default (privacy; D-CONTENT-4) |
| `assurer-location` | **New** | `title` (city); `country`; `kind` (select: office · representative · sourcing base; owner-defined); `address` (text, optional); `phone`, `email` (optional, business only); `_organization`; `mapUrl` (url, link-out) | `assurer-locations` widget (Contact page, footer list from global) | 16 names at migration; what each represents must be confirmed (inventory §3) |
| `@apostrophecms/file` | **Core; extend** | add `description`, `_thumbnail`; use core **file tags** for categories (corporate, apparel, …) | `assurer-downloads` widget; category pages (`_documents`) | Replaces 8 downloads pages. Download counters are not migrated |
| `@apostrophecms/image` | Core | add nothing; enforce `alt` via the widget fields that use it (see editorial requirements) | everywhere | — |
| `assurer-certification` | **Later** | `title`; `issuer`; `scope`; `validUntil`; `_certificate` (file); `_organization` | `assurer-certifications` widget | **Only with verified certificates** (D-CONTENT-5). The live site names OEKO-TEX labelled supply, not a certificate held |
| `assurer-article` (news) | **Later** | `title`; `publishedAt`; `summary`; `_image`; `body` area; `_organizations` | news page; `assurer-latest-news` widget | Or the official `@apostrophecms/blog` (MIT): a dependency decision (D-CONTENT-6) |

**Relationships summary:** category page → products (ordered) and documents; division page →
category pages; person → organization; location → organization; organization → locations.
Reverse lookups (for example "people at this company") use `relationshipReverse` instead of
duplicating data.

## 5. Global settings (`@apostrophecms/global`, new project override)

| Group | Fields |
|---|---|
| Organisation | legal name, short name, default share image, logo (for structured data) |
| Contact | primary business email, primary phone, messaging channels (array: channel select WhatsApp / WhatsApp Business / WeChat / Botim, number, label), head-office address |
| Footer | blurb (short text), `_footerLocations` (relationship to `assurer-location`, ordered), social links (array: network select, `url`), quick links (array of `linkFields()`), external group sites (array of `linkFields()`) |
| SEO defaults | site title suffix, default meta description, `noindex` switch for non-production environments |

Global values feed `views/layout.jsx` (header, footer), so editors change them in one place. The
hard-coded demo notice and footer text are removed when real content starts (a P1 implementation
step, not part of this task).

## 6. Widgets

### Reused as is

| Need (inventory) | Widget |
|---|---|
| Hero banner (W01, category heads) | `assurer-hero` |
| Slideshow (W01 hero slider) | `assurer-slideshow` (no text effects; the Revolution "typing" animation is not reproduced) |
| Text, text-and-image layouts | `@apostrophecms/rich-text`, `@apostrophecms/image`, `@apostrophecms/layout` |
| Category cards on home and `/products` (W01) | `assurer-product-grid` + `assurer-product-card` (manual cards) |
| Contact form (W11) | `@apostrophecms/form` |
| Video (W22, MP4 profile) | `@apostrophecms/video` (oEmbed); a self-hosted MP4 needs a decision: host it on a video platform, or offer it as a file download (D-CONTENT-9) |
| CTA band | `assurer-hero` without an image (overlay "none"). A separate CTA widget is built only if this proves awkward in review |

### New (minimal set, each replaces a WordPress pattern)

| Widget | Replaces | Fields | Data |
|---|---|---|---|
| `assurer-feature-grid` | Service cards, Goal/Vision/Mission/Values, "AWW Serves" roles (W01) | intro area; items array (≤ 12): `title`, `text` (≤ 300 chars), optional `_image`, optional `anchor` (slug), optional link (`linkFields()`); columns 2/3/4 | inline (not reused elsewhere). Could instead generalise the product card; see D-CONTENT-8 |
| `assurer-stats` | Key-figure counters (W01) | items (≤ 6): `value` (string, so "1,700+" and "$67 Mn" both work), `label`, optional `note` (source or "as of" date) | inline. **Figures need an owner-confirmed date** |
| `assurer-product-list` | Product line cards + "MORE" lightbox (W03–W09) | mode: products of the current category · hand-picked `_products`; columns | `assurer-product` |
| `assurer-organizations` | Entity cards (W01), menu "Organizations" | mode: all · hand-picked; layout cards or compact list | `assurer-organization` |
| `assurer-people` | Leadership flip cards (W10) | `group` filter or hand-picked `_people`; layout | `assurer-person` |
| `assurer-locations` | Footer locations, contact block (W11) | mode: all · by kind · hand-picked; show addresses yes/no | `assurer-location` |
| `assurer-downloads` | Downloads cards (W12–W19) | mode: by file tag · hand-picked `_files`; shows title, description, type, size (computed from the attachment) | `@apostrophecms/file` |
| `assurer-gallery` | Lightbox galleries (W03–W09, W21) | `_images` (ordered), caption source, columns; accessible lightbox (focus trap, Escape, arrow keys, visible close) | `@apostrophecms/image` |

Eight new widgets. The four listing widgets share one internal pattern (pick mode + relationship).
`assurer-certifications` and `assurer-latest-news` come later with their piece types.

### Proposed shared area configuration

`lib/area.js` (page-level `main` areas) gains the new widgets. Nested areas keep their own
narrow lists, as today. The core `@apostrophecms/file` widget is **not** added: `assurer-downloads`
covers single files too.

**m1-071 status ([design](../milestones/m1-071-layout-columns-design.md), D-CONTENT-21):** `lib/area.js` now holds one
table for all three menus: page `main` areas, layout columns and nested columns, in the same
groups (Text and media, Sections, Listings, Forms, Layout) in the expanded "Add Content" panel.
Layout columns offer every widget except the slideshow and the layout starters; nested columns
also leave out the hero and any further layout. The grids read the width of their container
(CSS container queries), so they collapse in narrow columns.

## 7. Dependencies that need approval (none added in m1-013)

| Package | Version / licence (npm, 2026-10-20) | Why | Advisories (GitHub, 2026-10-20) | Alternative without a dependency |
|---|---|---|---|---|
| `@apostrophecms/seo` | 1.7.1, MIT; depends on `lodash` | Meta title, description, canonical, robots and Open Graph fields on pages and pieces | **GHSA-wf43-fpp3-cf65** (high, stored XSS via analytics ID) affects ≤ 1.4.2, fixed in 1.5.0. 1.7.1 is not affected. Require `>=1.5.0`, do not use its analytics fields | Project fields + `<head>` in a template override (~1 day) |
| `@apostrophecms/sitemap` | 1.5.1, MIT; depends on `common-tags` | XML sitemap generation | none listed | Project route that lists published pages (~0.5 day) |
| `@apostrophecms/redirect` | 1.7.1, MIT; no dependencies | Editor-managed 301 redirects for the ~15 legacy URLs and future changes | none listed | Static redirect map in project code (fine for a fixed list; editors cannot change it) |
| `@apostrophecms/blog` | 1.0.6, MIT; depends on `dayjs` | News, later | not checked in depth | `assurer-article` piece type |

The agent recommends **`@apostrophecms/seo` and `@apostrophecms/sitemap`** (official, MIT,
maintained, avoid re-implementing core-adjacent features), and **`@apostrophecms/redirect`** only if
editors must manage redirects themselves. Each needs explicit approval, a licence check and an
`npm audit` re-baseline (D-CONTENT-10).

## 8. Future AI-assisted page composition (design only; nothing implemented)

**What core already provides.** Apostrophe 4.34 ships `@apostrophecms/ai` and adapters for
Anthropic, OpenAI, Google and OpenAI-compatible APIs inside the MIT `apostrophe` package
(`node_modules/apostrophe/modules/@apostrophecms/ai*`). Verified in the source:

- It ships no provider and no key: the engine is inactive until a provider is configured
  (`options.providers`). An `envKey` option reads keys from the environment, server-side.
- Structured output is validated against a JSON Schema (Ajv). Agent loops are capped
  (`maxSteps: 5`) and retries are bounded.
- It has a **permission seam**: AI actions go through a check that can be stricter than
  `apos.permission.can`, never looser. User documents are a hard-coded denied type for AI tools.
- It emits a `usage` event per provider response (token counts) and `beforeGenerate`/`afterGenerate`
  events. Job records expire (default 24 h).
- It has a mock mode (`APOS_AI_MOCK=1`) for tests without a provider.
- No editor-facing feature in core uses it yet (no other module calls `apos.ai`).

**How this content model supports AI drafts later:**

1. **The schema is the contract.** Pages are areas of known widget types with typed fields. A
   future "compose draft" tool would ask the model for JSON that matches a schema generated from
   the approved widget list (`lib/area.js`) and field definitions, and nothing else.
2. **Server-side validation before saving.** The JSON is converted into widgets and saved through
   the normal `apos.page`/`apos.doc` APIs as the requesting editor. Apostrophe's schema
   `convert` and sanitisation run as for any editor input: rich text is sanitised, `url` fields
   reject unsafe schemes, unknown widget types are rejected. No HTML widget, script or style field
   exists to receive code.
3. **Draft-only.** The tool writes to the draft (`aposMode: 'draft'`) and never calls publish. A
   human reviews in the normal editor, edits, and publishes; document versions keep the history.
4. **References, not invented facts.** Products, companies, people and documents are pieces. The
   model may only place existing records (by ID) and write layout and connecting copy. Business
   facts (figures, certifications) come from records that a human maintains.
5. **Explicit permissions.** A dedicated permission (for example "use AI drafting") is granted to
   chosen roles, checked through the AI permission seam on the server. Keys stay in the secret
   store, are never sent to the browser and never appear in templates.
6. **Limits and audit.** A project listener on the `usage` and `afterGenerate` events stores an
   audit record (user, document, model, token counts, time, outcome) as an Apostrophe piece or
   log, and enforces per-user daily limits before each call.
7. **No paid page-builder dependency** and no Pro module is required.

Open points for the AI phase (not now): provider choice and data processing terms, which content
may be sent to a provider (none that is personal), retention of prompts, and whether the core AI
module's API is stable enough (it is new in 4.34). These become an ADR when that phase starts.
