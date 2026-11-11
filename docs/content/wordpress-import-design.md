# WordPress import: design note (m1-067)

| | |
|---|---|
| **Status** | **Approved by the owner 2026-11-11** (G1, G2, Q2 (a) leave people out, Q3 all linked PDFs) and **built** in `modules/assurer-wp-import/`. Changes while building are marked *As built* |
| **Task** | `m1-067` (the import item of the [m1-066 handoff](../milestones/m1-066-handoff.md); the ID moved because m1-066 was used for the implicit state work) |
| **Decisions** | D-CONTENT-17 (import, drafts only) · D-CONTENT-3 (legacy pages) · D-CONTENT-4 (people) · D-CONTENT-9 (video) · D-CONTENT-12 (facts) |
| **Sources** | WordPress public REST API, surveyed 2026-11-11 (anonymous GET only) · [inventory](./wordpress-site-inventory.md) · [CA-5 checklist](./ca5-migration-checklist.md) §2–§4 · [ADR-0003](../architecture/decisions/ADR-0003-corporate-content-model.md) · [SEO plan](./seo-and-migration-plan.md) |

## 1. What the source really holds (survey of 2026-11-11)

- **26 pages**, all Elementor (`content.rendered` HTML only; no `_elementor_data`, templates are
  private). The page tree comes from `parent`; menus are not public.
- **23 posts: 22 are casino spam** published as `admin` on 2026-11-09 and 2026-11-10, plus the
  default "Hello world!". The live WordPress site appears compromised (reported to the owner;
  this project does not touch WordPress). **No posts are imported.**
- **964 media**: 948 images (alt text empty on all), 11 PDFs, 2 MP4, 1 PPTX, 2 SVG. 742 are not
  attached to anything; 48 are Elementor editor screenshots. About 370 are used on pages.
- **Home slider** is Slider Revolution: its slides are not in the API (and were `dummy.png`).
- **Downloads pages** carry Elementor placeholder text ("Lorem ipsum", fake download counts).
- **Leadership** has 17 people with names, roles, bios, photos and some direct phone numbers
  and emails.

Content can move; Elementor layouts cannot. The import carries text, images, files and
structure into this site's own widgets and records. The look comes later (D-CONTENT-18).

## 2. Mapping

All pages are **drafts**. Paths keep their WordPress form without the trailing slash.

| WordPress | Apostrophe draft | What goes in |
|---|---|---|
| W01 `/` (357) | home page, `main` area | Section by section: headings and text → rich text; the 6 category cards → product grid (cards link to the category pages); the 4 counters → stats widget, each `note` set to "Unconfirmed: check before publishing" (D-CONTENT-12); the 6 service cards and the goal/vision/mission/values → feature grids; the 9 entity cards → organization records (§3) and an organizations widget. Slider skipped |
| W02 `/style`, W06 `/health` | division pages | Title only (empty on WordPress); child categories list themselves |
| W03–W05, W07–W09 | product category pages | `summary` from the page's tagline (300 max), `_heroImage` from the first image, `intro` from the opening text; each product line → product record (§3) |
| W10 `/leadership` | default page | **Depends on decision Q2** |
| W11 `/contact-us` | default page | Text, plus the Dhaka office as a location record (contact shown: off). The Elementor form and Google Maps frame are not carried; the site's own form needs CA-6 |
| W12 `/downloads` | default page | Intro text and a downloads widget listing the imported PDF records. Placeholder cards skipped |
| W21 `/gallery/images` | default page | Gallery widget with the 24 images |

**Not imported** (D-CONTENT-3, redirected instead): W13–W19 (`/downloads/*`; their PDFs are
imported), W20 `/gallery`, W22 `/gallery/videos`, W23 `/gallery/downloads`, W24
`/presentation`, W25 `/sitemap`, W26 maintenance page, W27–W29, all posts. Also skipped: the
video (D-CONTENT-9), the PPTX, SVGs, Elementor screenshots, `dummy.png` and other placeholders,
media not used on an imported page, and anything uploaded on or after 2026-11-08 (the spam
window).

## 3. Records

| Record | From | Count (about) | Notes |
|---|---|---|---|
| `assurer-product` | category pages: each product line (title, one-line text, thumbnail, "MORE" lightbox images) | 45 + 16 herbs | `summary` from the line's text; `_image` the thumbnail; `_gallery` the first 12 lightbox images; `_categories` the draft category page. Herb botanical names go in the summary (no field, ADR-0003) |
| `assurer-organization` | home "AWW – Entities" cards | 9 | name, short description, logo; website only where the card links out. Facts unconfirmed (D-CONTENT-2) |
| `assurer-location` | Contact Us | 1 (Dhaka) | address, business phone and email, `showContact` off. The 16 footer place names are not in the API |
| `assurer-person` | Leadership | 17 or 0 | **Decision Q2.** Never phone or email (no fields; D-CONTENT-4) |
| `@apostrophecms/file` | PDFs linked from the downloads pages | 9–11 | tagged per category and "corporate", as CA-5 §3 |
| `@apostrophecms/image` | images used above | 250–350 | §4 |

## 4. Images and files

- **Only used media.** An image is imported when an imported page or record uses it.
- **Names.** Lowercase, hyphenated, from where it is used: `knitted-kids-wear-01.jpg`,
  `home-services-quality-assurance.jpg`. The title matches. Duplicates (`-1`, `-2`) become one
  image when the files are byte-identical (checked by hash).
- **Alt text, drafted.** Taken from the nearest heading or item name ("Knitted kids wear"),
  never invented descriptions. Logos and people photos get empty alt (ADR-0003). All drafted
  alt text is for the owner's review.
- **Review tag.** Every imported image and file gets the tag "Imported from WordPress", so an
  editor can filter them and check alt text, and so they can be found again.
- **Limits.** Only `https://www.assurerworld.com/wp-content/uploads/` URLs; images 15 MB, PDFs
  60 MB (the largest is 46.1 MB), each changeable by an option; a size check before and while
  downloading; a timeout per request; one download at a time.
- **Autopublish (core behaviour).** Apostrophe publishes image and file records on insert, and
  upload URLs are public by design. Pages and other records stay drafts. These files are
  already public on WordPress today, so this changes nothing for them, but it matters for
  people's photos (Q2).

## 5. Redirects

- **The 20 legacy page redirects** stay as they are: `assurer-seo:seed-redirects` adds each one
  only when its target page is **published**, so they come after the owner's publishing round,
  not in the import. The import's report lists them as waiting.
- **PDF redirects (new, CA-5 §7).** For each imported PDF, the import adds a 301 from the old
  `/wp-content/uploads/…/<name>.pdf` path to the new file URL. The file is public on insert
  (§4), so the redirect works at once. To check while building: whether the redirect module
  accepts a site-relative target; if not, the task builds it from `APOS_BASE_URL`.

## 6. How a run behaves

`node app assurer-wp-import:run` (in the container through the wrapper, §7):

- **Dry run by default.** Prints what it would create, update, skip and why, and writes nothing.
  `--execute` writes. Same pattern as the project's `retention` and `sanitize-after-restore`
  tasks.
- **Keyed by WordPress ID.** Every imported doc carries two plain properties outside the schema,
  `importSource` (for example `wordpress:page:2526`) and `importHash` (a fingerprint of what was
  imported). Editors never see them, and Apostrophe keeps them when an editor saves. *(As built:
  the proposed hidden schema field was dropped, because it added an empty "Ungrouped" tab to every
  editor; m1-067 Chrome check.)*
- **Explicit state per doc** (implicit state review): *new* (no doc with that ID) → *imported*
  (the doc still matches its fingerprint; a re-run updates it) → *edited* (a person changed it;
  a re-run leaves it and reports it). `--overwrite` exists for the test site only. Archived
  docs count as edited: a re-run never brings back what an editor archived.
- **Never publishes**, never deletes, never touches WordPress (GET only, no login).
- **Report** at the end, in the style of `seed-redirects`: created, updated, kept (edited),
  skipped with reason, and the items for the owner to review.

## 7. Running tasks in the container

A wrapper next to `pbmc`, `assurer-task`: it reads the secrets, sets `APOS_DB_URI` and
`APOS_SESSION_SECRET` in its own environment (never on the command line), and runs
`node app <task> …` as the `assurer` user in `/app`. Usage:

```
$S exec site assurer-task assurer-wp-import:run            # dry run
$S exec site assurer-task assurer-wp-import:run --execute
$S exec site assurer-task assurer-seo:seed-redirects
```

It also closes the gap for `user:add` and `seed-redirects` noted in m1-065. Documented in the
staging runbook §4 and §11.3. The OCI site needs the new image before the test run.

## 8. Code structure

One new module, `modules/assurer-wp-import/`, with small parts that can be tested alone:

| File | Job |
|---|---|
| `index.js` | the task: options, order of steps, report |
| `lib/source.js` | WordPress REST reads (pagination, `_fields`) and limited downloads to a temporary folder |
| `lib/extract.js` | Elementor HTML → plain blocks (heading, text, image, gallery, card, counter, team card) |
| `lib/plan.js` | blocks → the plan of pages, records and media (pure; the dry run prints this) |
| `lib/media.js` | names, alt text, de-duplication |
| `lib/apply.js` | writes the plan through Apostrophe APIs (draft `req`, `convert`, insert or update) |

No other module changes: the import key is kept as plain properties (§6), so no schema field,
override or migration is needed.

Tests: unit tests for `extract`, `plan` and `media` on **synthetic** HTML fixtures (no real
names, phones or emails), and a CI step that runs the import twice against a small local fake
WordPress server: the second run must change nothing, and no page or record may be published.
Then the four standard suites and the editor review in Chrome.

## 9. Gates (owner approval needed)

- **G1. ADR-0003 amendment** (architecture gate). §3 says "No importer or seed creates real
  records" and §9 says "There is no automated WordPress import". Both predate D-CONTENT-17.
  Proposed text: real records are entered by people **or by the WordPress import**
  (D-CONTENT-17), which creates drafts only (images and files excepted, core autopublish);
  publishing stays with people after the owner's review; no other importer or seed creates real
  records.
- **G2. One dependency declared: `cheerio`** (MIT), to read the Elementor HTML. It is already
  installed as part of Apostrophe (same version, 1.2.0), so no new code is downloaded; declaring
  it makes the project's use honest instead of relying on Apostrophe's internals. The licence
  and advisory checks run before it is added. Without it, the HTML would be read with regular
  expressions, which breaks easily.

## 10. Questions for the owner

- **Q1.** Approve the mapping (§2–§3), what is skipped, and the gates G1 and G2?
- **Q2. The 17 leaders.** (a) leave them out for now; the page is imported with its headings
  only, and people are added after consent (D-CONTENT-4) · (b) import them as drafts without
  phone or email; their photos become public files because of core autopublish (§4), though
  not listed anywhere. **Recommended: (a).**
- **Q3.** Are the 2023 PDFs still current, or should only some be imported?

## 11. Not in this task

The wipe of the OCI site before the final run (needs a backup and its own approval), the final
run on the permanent site, publishing, the video, the design work (D-CONTENT-18, now m1-068),
and any change to WordPress.
