# CA-5 content migration: inventory and draft-entry checklist (preparation)

| | |
|---|---|
| **Task** | m1-028 ([report](../engineering/reports/2026/11/2026-11-02-m1-028-ca5-preparation.report.md)) |
| **Date** | 2026-11-02 |
| **Status** | **Preparation only.** Nothing was entered, published or redirected. No business fact here is confirmed: everything about the company comes from the [WordPress inventory](./wordpress-site-inventory.md) (live site, 2026-10-20) and needs the owner's confirmation before reuse (D-CONTENT-12). |
| **Inputs** | [Inventory](./wordpress-site-inventory.md) (W01–W29) · [IA](./corporate-information-architecture.md) · [Content model](./apostrophe-content-model.md) / [ADR-0003](../architecture/decisions/ADR-0003-corporate-content-model.md) · [SEO plan](./seo-and-migration-plan.md) / [SEO runbook](../runbooks/seo.md) · [Editorial requirements](./editorial-and-design-requirements.md) · code on `origin/main` `0fe607c` |
| **Definition of CA-5** | Owner-approved copy entered as drafts; images curated, renamed and given alt text; PDFs re-uploaded; owner review and publish; redirect test green ([implementation plan](./implementation-plan-and-risks.md#2-prioritised-implementation-plan)) |

## 1. Blockers before any real content is entered

| # | Blocker | Why it blocks | Decision |
|---|---|---|---|
| B1 | **No target database.** Content entered in the local development database stays there: each site has its own database, and one site's database is never copied into another (AGENTS.md, ADR-0002, [new-site runbook](../runbooks/new-site-initialization.md)). No staging or production database or media store exists yet | Real content typed into the dev database would have to be typed again | **D-CONTENT-16 (new, open)**, §6 |
| B2 | **No approved copy.** The agent does not write business text. Every page needs the owner's text, or the owner's written approval of live-site text | Nothing to enter | D-CONTENT-12 |
| B3 | **Leadership privacy** (17 people, photos, contact details) | `/leadership` and all `assurer-person` records | D-CONTENT-4 |
| B4 | **Group company facts**: legal names, roles, relationships of the 9 entities | `/group`, organization records, Organization JSON-LD | D-CONTENT-2 |
| B5 | **Publishing order.** The relationship picker offers only **published** pages (ADR-0003 §4). A product can be linked to its category only after the category page is published, so the owner cannot review a category page with its products while both are drafts | Category and product review sequence | Resolved by B1: publishing on a non-public, `noindex` site is not publishing to the world (§6) |
| B6 | **Demo chrome.** `views/layout.jsx` always shows the "Demonstration site" notice, and the footer falls back to a demonstration line when Global Content has no copyright name | Real-content builds must not show them (CA-4 plan) | Code task before launch, not data entry (§7) |

## 2. Page inventory

One row per target URL. "Inputs" are what the owner must supply or confirm; nothing is drafted by
the agent. Widgets are the ones built in m1-014/m1-015 (ADR-0003). Priority as in the inventory.

| Target URL | Source | Page type | Sections (widgets) | Records needed | Inputs from the owner | Blocked by | Pri. |
|---|---|---|---|---|---|---|---|
| `/` | W01 | Home | Hero or slideshow · intro (rich text) · division cards (product grid/cards) · key figures (`assurer-stats`) · services (`assurer-feature-grid`) · group companies teaser (`assurer-organizations`) · sustainability text · CTA (hero, no image) | Organizations | Hero images; intro; figures **with an "as of" date and source** (live counters: 15+ offices, 1700+ employees, 108+ countries, $67 Mn, unconfirmed); service names and texts; sustainability text (OEKO-TEX wording only as the owner confirms it) | B1, B2, D-CONTENT-2, D-CONTENT-5 | P1 |
| `/about` | W01 text | Standard page | Rich text · goal/vision/mission/values (`assurer-feature-grid`) · optional figures · "AWW Serves" roles (feature grid) | — | All copy ("Since 2012", positioning, goal, vision, mission, values, roles) | B1, B2 | P1 |
| `/group` | W01 entity cards | Standard page | Intro · `assurer-organizations` (all, cards) | 9 organizations | Names, short descriptions, logos, parent ("Part of"), website URLs | B1, B2, B4 | P1 |
| `/products` | new | Division / overview | Intro · child divisions listed · optional sections | — | Intro text | B1, B2 | P1 |
| `/style`, `/health` | W02, W06 (empty today) | Division / overview | Intro · child categories (automatic) · organizations in this division | Organizations (optional) | Intro text per division | B1, B2 | P1 |
| `/style/apparels-textiles` | W03 | Product category | Header image · summary · intro · products (automatic, by display order) · downloads (`assurer-downloads`, tag) · gallery · CTA → contact | Products; file "Style Apparels" PDF | Summary (≤ 300 chars), intro, product lines with texts and photos, alt text | B1, B2 | P1 |
| `/style/activewear-accessories` | W04 | Product category | as above | Products; PDF | as above | B1, B2 | P1 |
| `/style/home-tex-decor` | W05 | Product category | as above | Products; PDF | as above ("BEDING" on the live site is a typo) | B1, B2 | P1 |
| `/health/beauty-herbs` | W07 | Product category | as above; 16 herbs as products | 16 products; PDF | Common and botanical names as the owner approves them (no `botanicalName` field: in the product name or description, ADR-0003) | B1, B2 | P1 |
| `/health/food-minerals` | W08 (heading only) | Product category | as above | Products; PDF | **All content.** The live home card describes raw cotton and yarns, which does not match the name. Hide in navigation until content exists | B1, B2 | P1 |
| `/health/health-tex-medi-care` | W09 | Product category | as above | Products; PDF | as `/style/apparels-textiles` | B1, B2 | P1 |
| `/services` | W01 service cards | Standard page | Intro · `assurer-feature-grid` with an anchor per service | — | Six service texts (Brand Supplies Consolidation, Financial Stability, Manufacturing Management, Quality Assurance, Supply Chain, Vendor Development, as named on the live site) | B1, B2 | P1 |
| `/leadership` | W10 | Standard page | Intro · `assurer-people` (by organization, or hand-picked) | 17 people | Names, positions, organization, photos, bios, **consent** per person. No phone or email fields exist (privacy by schema) | B1, B2, B3 | P1 |
| `/downloads` | W12 | Standard page | Intro · `assurer-downloads` (by tag, or hand-picked) | 8 files (+ video, D-CONTENT-9) | Confirm which 2023 PDFs are still current; titles and descriptions | B1, B2, D-CONTENT-9 | P1 |
| `/contact-us` | W11 | Standard page | Intro · form (`@apostrophecms/form`) · `assurer-locations` | Locations | Office address(es), which locations to show, business phone and email | B1, B2, CA-6 (privacy notice, D-FORM-*) | P1 |
| `/privacy` | new | Standard page | Rich text | — | DPO-approved text (draft exists in the dev database only) | D-CONTENT-15, B1 | P1 |
| `/gallery/images` | W21 | Standard page | `assurer-gallery` | Images | Which of the 24 images to keep, captions, alt text | B1, B2 | P2 |
| `/sustainability` | W01 paragraph | Standard page | — | — | Evidence (certificates, scope, validity) | D-CONTENT-5 | Later |
| `/news`, `/group/<slug>`, careers | — | — | — | — | Not built ([IA §2](./corporate-information-architecture.md#2-planning-categories-against-the-inventory)) | D-CONTENT-6, D-CONTENT-2 | Later |

Not migrated, redirected instead (D-CONTENT-3, already in `modules/assurer-seo/lib/legacy-redirects.js`):
W13–W20, W22–W29, `/feed`, `/?p=1`, `/?page_id=357`, `/download.php`.

## 3. Record inventory

| Record type | Count (live site) | Fields to fill (as built) | Notes |
|---|---|---|---|
| `assurer-organization` | 9 entity cards; 6 menu names that differ slightly | Name, short description (≤ 300), logo, "Part of", website (http/https), display order | Names and relationships unconfirmed (D-CONTENT-2). Two have external sites (`vclbd.net`, `purenaturals.co.in`) |
| `assurer-person` | 17 (Business Management 3, Business Partners 10, Business Leaders 4) | Full name, position, organization, photo, short biography (≤ 600), display order | No groups field: use one `assurer-people` widget per group (hand-picked) with a heading. No contact details (D-CONTENT-4) |
| `assurer-location` | 16 names in the footer; 1 address (Dhaka) | Name, city, country, address, organization, "show contact details" (off), business phone/email, display order | What each location is (office, partner, sourcing base) is not stated on the live site |
| `assurer-product` | About 45 product lines, plus 16 herbs | Name, public name, short description (≤ 300), description, categories, main image, gallery (≤ 12), display order | Product lines per category are listed in the inventory (W03–W09). The live "MORE" lightboxes hold 194 image links; choose up to 12 per product |
| `@apostrophecms/file` | 8 PDFs, 1 MP4 | Title, file, tags (one per category, plus "corporate") | Type and size come from the file. The MP4 waits for D-CONTENT-9 |
| `@apostrophecms/image` | About 300 files on the live site | Title, alt text, focal point | Upload only images used on migrated pages. Project widgets refuse images without alt text (`lib/alt-text.js`) |
| Global Content | — | Contact, footer (text, copyright name, locations, social links), header button, privacy, SEO/AEO (title suffix, default image, organization) | Fill last, from confirmed facts only. Social links only with real URLs (the live icons have none) |

## 4. Media and redirect work

| Item | Today | CA-5 step |
|---|---|---|
| Image names | Camera names (`IMG_9013.jpg`, `Picture12.jpg`, `dummy.png`) | Rename before upload: lowercase, hyphenated, descriptive. Do not carry over `dummy.png` or placeholders |
| Image sizes | Mixed | Hero ≥ 2000 px; cards ≥ 1200 px; gallery ≥ 1600 px; people ≥ 800 px ([editorial requirements §5](./editorial-and-design-requirements.md#5-typography-spacing-and-images)) |
| Alt text | 404 of 408 images have none | Write for every informative image; owner approves product descriptions |
| PDF redirects | Not covered ([SEO runbook §3](../runbooks/seo.md#3-redirects)) | After upload, add one 301 per file from `/wp-content/uploads/2023/0[23]/<name>.pdf` to the new attachment URL. These URLs are only known after upload in the target database (B1). Add them to the redirect test |
| Video | Self-hosted 44 MB MP4 | D-CONTENT-9; a provider embed also needs D-CONTENT-14 and the privacy notice |
| Legacy page redirects | 20 records, added only when the target page is published | Run `node app assurer-seo:seed-redirects` after each publishing round; `--strict` must pass before launch |
| Rich-text links | — | Link to pages with page relationships (`linkFields()`), not typed URLs; no links to `/wp-content/` |

## 5. Draft-entry checklist (per page or record)

Use it for each row of §2 and §3. Enter content as a non-admin **editor**, in the target
database (D-CONTENT-16).

**Before entry**

- [ ] The owner's approved text for this item is in hand, with the approver's name and date.
- [ ] Facts in it (figures, names, addresses, certificates) are confirmed by the owner; figures have an "as of" date.
- [ ] Images chosen, renamed, at the minimum width, with alt text written.
- [ ] Records it depends on exist (organizations before people and locations; category pages published before products are linked, B5).

**Entry (draft)**

- [ ] Page type as in §2; slug as in §2 (no trailing slash, lowercase, hyphenated).
- [ ] One H1 (the page title or the hero heading, not both); headings in order.
- [ ] Required fields filled (summary on category pages; alt text on images in project widgets).
- [ ] SEO/AEO tab: meta description (≤ 160 characters) or the summary fallback; no SEO title unless it differs.
- [ ] Links use page relationships; external links open the right site.
- [ ] No placeholder or demo text ("Demo", "Lorem ipsum", "Title").
- [ ] "Hide in Navigation" set for pages that are not in the menu (`/privacy`, empty categories).
- [ ] Saved as a draft. Not published.

**Review**

- [ ] Preview at 1440, 768 and 375 px: no horizontal overflow, images cropped acceptably.
- [ ] Logged out, the draft is not visible (404).
- [ ] The owner reviews the draft and records approval (name, date).

**Publish**

- [ ] Publish; the page appears in the menu where expected.
- [ ] `node app assurer-seo:seed-redirects` adds the redirects that point to it; the old URL returns one 301, then 200.
- [ ] Logged out, the published page shows; no draft-only edits leak.

**Before launch (all pages)**

- [ ] `node app assurer-seo:seed-redirects --strict` passes; PDF redirects added (§4).
- [ ] Global Content filled from confirmed facts; demo notice and fallback footer line gone (B6).
- [ ] No internal link to `/wp-content/`; one H1 per page; `/sitemap.xml` lists the published pages.

## 6. D-CONTENT-16: where CA-5 content is entered

| Option | How | For | Against |
|---|---|---|---|
| **A. Wait for the target environment** | Enter content through the UI on staging or production once D-DB-2/D-DB-3 are decided and the site is set up | Official tools only; no copy; review on the real site behind `noindex` | Waits for hosting (M2). The publishing order (B5) is fine there: publishing on a `noindex`, pre-launch site is not public |
| B. Scripted entry from reviewed files | Approved copy kept in files and entered by a project task through Apostrophe APIs, run once per site | Same content in every environment; repeatable; reviewable in Git | New code to write and test; images and alt text still need curation; copy lives in the repository |
| C. Export and import between sites | An export/import module moves documents and media from one site to another | No retyping | A new dependency (approval, licence and advisory checks); moves selected documents only, never a whole database |

**Agent recommendation:** A. Until then, prepare the content outside the CMS: the owner collects
approved copy, images and confirmations against §2–§3. The local dev database is for trials only;
anything entered there is not migrated.

## 7. Work that is not data entry

These come up during CA-5 but are code changes with their own task and checks:

- Remove the demo notice and the demonstration footer line on real-content builds (B6).
  *Done in m1-029:* shown only when `APOS_DEMO_SITE=1`.
- Per-file redirects for the PDFs (§4), or an extension of the redirect seed task for them.
- Card grids switch at 640 px; the requirements say 768 px (m1-021 carry-over).
  *Done in m1-029.*
- A `/favicon.ico` (m1-021 carry-over). *Done in m1-029.*
