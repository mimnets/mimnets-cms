# ADR-0003: Corporate content model

| | |
|---|---|
| **Status** | **Accepted.** Amended 2026-11-11 (m1-067): §3 and §9 allow the WordPress import into drafts, approved by the owner (D-CONTENT-19); see the amendment at the end. |
| **Approved by** | Project owner, 2026-10-20. The decisions D-CONTENT-1, D-CONTENT-2 and D-CONTENT-8 were approved in the [m1-014 prompt](../../engineering/prompts/2026/10/2026-10-20-m1-014-content-model-foundation.prompt.md), which also asked for this ADR. |
| **Date** | 2026-10-20 |
| **Task** | `m1-014` · report: [2026-10-20-m1-014-content-model-foundation.report.md](../../engineering/reports/2026/10/2026-10-20-m1-014-content-model-foundation.report.md) |
| **Depends on** | [ADR-0001](./ADR-0001-cms-platform-and-starter.md) (Community Edition only) · [ADR-0002](./ADR-0002-database-strategy.md) (Apostrophe-native data access; no production database selected) |
| **Proposal** | [docs/content/apostrophe-content-model.md](../../content/apostrophe-content-model.md) (m1-013). This ADR records the approved foundation as built in m1-014. Where they differ, this ADR wins. |

## Context

The Assurer site needs structured, reusable records (products, group organizations, people,
locations), page types that guarantee consistent fields for divisions and product categories,
site-wide settings, and two-level navigation. The m1-013 proposal designed them. The owner
approved the information architecture (D-CONTENT-1), reusable Organization records with every
company fact unverified until the owner confirms it (D-CONTENT-2), and the content-model
foundation (D-CONTENT-8). English is the first language; localization must stay possible. Brand
values, company facts, SEO packages and the WordPress migration are not authorized.

## Decision

### 1. Native Apostrophe building blocks only

Everything is an ordinary Apostrophe page type, piece type, widget, schema field or
relationship. There are no custom collections, database queries, ORM or parallel stores. The
draft/publish lifecycle, document versions, archive, permissions, sessions and login are
core's, unchanged. There is no project "publication state" field: a record is public when it
is published.

### 2. Page types versus piece types

- **Pages** are URLs that need their own layout and place in the tree:
  `assurer-division-page` (division or overview) and `assurer-product-category-page`, beside
  the existing `default-page` and home page.
- **Pieces** are records that repeat or are shown in several places, without their own URLs
  for now: `assurer-product`, `assurer-organization`, `assurer-person`, `assurer-location`. They
  have no piece pages and no public REST API projection, so the REST API answers anonymous
  visitors with 404. They reach the public only through page templates (today) and listing
  widgets (CA-2).

| Type | Fields (beyond core title/slug/visibility) | Relationships |
|---|---|---|
| `assurer-product` | `displayTitle` (≤ 120), `summary` (≤ 300), `description` (area, rich text only), `displayOrder` | `_categories` → category pages; `_image` (1); `_gallery` (≤ 12 images) |
| `assurer-organization` | `shortDescription` (≤ 300), `websiteUrl` (http/https only), `displayOrder` | `_logo` (1 image); `_parentOrganization` (1, not itself); `_locations` reverse of location `_organization` |
| `assurer-person` | `title` as full name (≤ 120), `jobTitle` (≤ 120), `bio` (≤ 600), `displayOrder` | `_organization` (1); `_photo` (1 image) |
| `assurer-location` | `city`, `country` (required, ≤ 80), `address` object (line1, line2, postalCode, region), `showContact` (default **off**), `publicPhone` (pattern), `publicEmail` (email), `displayOrder` | `_organization` (1) |
| `assurer-division-page` | `intro` area, `main` area (`lib/area.js`) | `_organizations` (published ones shown); child category pages listed automatically in tree order |
| `assurer-product-category-page` | `summary` (≤ 300), `intro` area, `main` area | `_heroImage` (1); `_products` reverse of product `_categories`, sorted by display order then title |
| `@apostrophecms/global` | `contactEmail`, `contactPhone`, `contactAddress`, `footerText` (≤ 300), `copyrightName`, `socialLinks` (≤ 8, network + http/https URL), `showHeaderCta` + `linkFields()` | `_footerLocations` (≤ 12) |

### 3. Content ownership and reuse

Each fact has one owner record. A product names its categories; a location names its
organization. The other side reads them through `relationshipReverse`, so links cannot
disagree. Lists sort by `displayOrder` (0–9999, default 100), then title. Group-company,
leadership and location facts are entered only by people, after the owner confirms them. No
importer or seed creates real records, except the WordPress import (§9, amended m1-067), which
creates drafts that people confirm and publish. The demo seed creates only fictional records labelled
"Demo" or "(fictional)".

### 4. Relationships and localization

Relationships store document IDs (`aposDocId`), which survive locale and mode changes. Visitors
get only published targets, because published-mode queries never return drafts or archived
documents. Editors in draft mode see drafts. Archiving a record removes it from every
relationship at query time and leaves the stored ID, so a restore brings the link back. The
admin UI's relationship picker offers only published pages as targets (core behaviour); editors
publish a category page before assigning products to it.

Localization: one locale (`en`) without a URL prefix today. All new fields are ordinary
localized document fields, so Community Edition locales (D-CONTENT-7) can be added later with
per-locale drafts and no schema change. Labels are plain English strings for now. Moving them
to the `project:` i18n namespace is a follow-up when a second locale is approved.

### 5. Permissions and publishing

Core roles apply unchanged. Editors create, edit, publish and archive all four piece types,
both page types and Global Content. Contributors may draft. Guests and anonymous visitors cannot
write, and they get no draft data and no user records. Editors cannot read or create user
accounts. Whether editors keep direct publishing, and whether they keep Global Content and
Global Styles, is still open (D-CONTENT-11, D-M0-11).

**Personal data.** `assurer-person` has **no** phone or email fields, so personal contact
details cannot be published by mistake. Adding them needs the owner's and DPO's approval
(D-CONTENT-4) and an amendment to this ADR. Location contact details are business details only,
and they are shown only when an editor turns on "Show contact details" (off by default). Help
texts ask for consent before publishing a photo or biography.

### 6. Database portability

Only document fields, areas, attachments and relationships are used. They behave the same on
SQLite (local and CI), PostgreSQL (development and testing only, D-DB-6) and MongoDB. The
schema change needs no migration: new types start empty, existing documents are untouched, and
`hideInNav` uses core's existing `orphan` field ("Hide in Navigation"). Future changes to
these types ship as idempotent `@apostrophecms/migration` migrations (AGENTS.md).

### 7. Media and accessibility

Images are core `@apostrophecms/image` pieces with core alt text. Templates output that alt
text. Images inside a link card, and organization logos next to their name, use empty alt
text so the name is not read twice. Field help gives ratios and minimum widths (editorial
requirements §5). Pages have one H1, and sections have headings. The layout adds a skip link
and a labelled main navigation built as a disclosure pattern: links stay links; separate
buttons with `aria-expanded` open submenus; Escape closes and returns focus;
`aria-current="page"` marks the current page; tap targets are ≥ 44 px; hover works only with
a real pointer; without JavaScript every link is visible. Making alt text required in
project widgets is part of CA-2.

### 8. Future AI-assisted drafting

The schema is the contract. Typed fields, closed widget lists, `url` fields restricted to
http(s), sanitized rich text and no HTML widget mean a future drafting tool can only produce
data the editor UI could produce. It saves drafts as the requesting user and never publishes.
It places existing records by ID instead of inventing facts. The design is in
[content model §8](../../content/apostrophe-content-model.md#8-future-ai-assisted-page-composition-design-only-nothing-implemented).
Nothing is implemented. Enabling it needs its own ADR.

### 9. Migration constraints

*Amended m1-067:* real content comes from the WordPress import (D-CONTENT-17), which writes
drafts only, or is entered through the UI as drafts; either way it is published only after owner
review (CA-5). The original text read: "There is no automated WordPress import. Real content is
entered through the UI as drafts and published after owner review (CA-5)" The demo seed (`assurer-demo:seed-corporate`):

- refuses to run when `NODE_ENV=production`;
- runs on a temporary SQLite database, or on another database only with `--dev-database`;
- creates only missing records, and never edits, overwrites or restores anything.

The owner's development database is never changed automatically.

### 10. Exclusions and deferred decisions

Not part of this decision:

- The eight listing and section widgets (CA-2).
- SEO fields, sitemap and redirects (CA-3, D-CONTENT-10; no SEO package installed).
- Brand tokens (D-CONTENT-12).
- Piece show pages, including `/group/<slug>` (D-CONTENT-2).
- Product specifications, prices and certifications (D-CONTENT-5).
- File-piece extensions and the downloads library.
- News (D-CONTENT-6), more locales (D-CONTENT-7) and AI drafting.
- Pro modules.
- Any production database choice.

## Consequences

- Editors manage products, organizations, people and locations in one place each. Category and
  division pages update when records change, and navigation follows the page tree.
- Visitors see nothing unpublished, so unverified facts stay private until someone publishes
  them deliberately.
- Some m1-013 proposal fields were left out: `botanicalName`, `role`, `kind`, `group`,
  `mapUrl`, person contact fields and category `_documents`. They return only with owner data
  and a reason.
- Editors must publish a page before linking records to it (core relationship picker).

## Alternatives considered

- **Category pages pick products** (`_products` on the page), as the m1-013 proposal had it.
  Rejected: a product's categories would then live on other documents. The product-owned
  relationship with a reverse lookup gives one source of truth and a natural "Placement" tab.
- **Two forward relationships between organization and location.** Rejected: they can disagree.
- **A custom `hideInNav` field.** Rejected: core's `orphan` field already provides it.
- **Contact fields on people, hidden by a toggle.** Rejected for now: privacy by schema is safer
  until the owner and DPO decide D-CONTENT-4.
- **`default-page` with widgets only.** Rejected in m1-013: it cannot guarantee the consistent
  fields that cards and summaries need.

## Status note (m1-015, 2026-10-29): CA-2 widgets built

Recorded by the agent; this note adds to the decision above and changes none of it. Details in
the [m1-015 report](../../engineering/reports/2026/10/2026-10-29-m1-015-listing-and-section-widgets.report.md).

- **Eight widgets** in `lib/area.js` (page-level `main` areas only): `assurer-feature-grid`,
  `assurer-stats`, `assurer-product-list`, `assurer-organizations`, `assurer-people`,
  `assurer-locations`, `assurer-downloads`, `assurer-gallery`. The core file widget is not added.
- **Feature grid vs product card (the widget part of D-CONTENT-8):** a new widget, as
  recommended. Product cards stay product-specific; feature items are inline and typed.
- **Listing modes as built** (§2 differences): product list: a category page (or the current
  category page when none is chosen) · hand-picked. Organizations: all · hand-picked. People:
  hand-picked · of one organization (no `group` field). Locations: all · of one organization ·
  hand-picked (no `kind` field). Downloads: by core file tag · hand-picked. Rule-based modes run
  request-aware queries (published, non-archived records only for visitors), capped at 48.
- **Alt text (§7) is now required** for the informative images in project widgets: gallery,
  feature-grid items, product cards and slideshow slides. The widget refuses to save and names
  the image; the editor adds alt text in the media library. Core image pieces keep alt text
  optional. Organization logos and people photos sit next to the name and keep empty alt.
- **People** render no contact details; **locations** show business contacts only when the
  location's "Show contact details" is on.
- **Empty listings** render nothing for visitors; logged-in users see a hint.
- **Gallery lightbox:** project code (native `<dialog>`), no package; thumbnails are plain links
  without JavaScript.
- New labels use the `project:` i18n namespace (`modules/@apostrophecms/i18n`), started here.
- Core does not enforce `required`/`min` on relationship fields server-side (the editor UI does).
  An empty gallery or an "of one organization" list without an organization saves through the API
  and renders nothing.

## Amendment (m1-067, 2026-11-11): the WordPress import

Approved by the owner in session on 2026-11-11 ("Approve amendment (Recommended)", D-CONTENT-19),
after D-CONTENT-17 chose an automated import. §3 and §9 change as marked above. The rules:

- **One importer only:** `assurer-wp-import:run` (`modules/assurer-wp-import/`). It reads the old
  site's public REST API and never writes to WordPress. No other importer or seed creates real
  records.
- **Drafts only.** Pages, products, organizations and locations are drafts; the import never
  publishes. People are left out until they consent (D-CONTENT-4).
- **Exception, core behaviour:** image and file records publish themselves on insert
  (`autopublish`), and upload URLs are public by design. Only files already public on the old site
  are imported.
- **A person's work wins.** A re-run updates only drafts the import saved last; anything a person
  edited, published or archived is left alone (the state rule in `lib/apply.js`).
- **Facts stay unconfirmed** until the owner confirms them (D-CONTENT-2, D-CONTENT-12); the import
  marks figures and lists review items in its report.
- The design note is [docs/content/wordpress-import-design.md](../../content/wordpress-import-design.md).
