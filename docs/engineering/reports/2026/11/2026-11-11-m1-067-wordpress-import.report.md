# m1-067 — WordPress import into drafts

| | |
|---|---|
| **Task** | m1-067 (the import item of the [m1-066 handoff](../../../../milestones/m1-066-handoff.md); m1-066 was used for other work) |
| **Date** | 2026-11-11 |
| **Scope** | Design note, then a project task that imports the WordPress site into drafts (D-CONTENT-17), a way to run tasks in the staging container, local and container tests. The OCI test run is the owner's step |
| **Prompt** | [2026-11-11-m1-067-wordpress-import.prompt.md](../../../prompts/2026/11/2026-11-11-m1-067-wordpress-import.prompt.md) |
| **Design** | [WordPress import design note](../../../../content/wordpress-import-design.md) (approved; changes while building marked *As built*) |
| **Branch / commits** | `feat/m1-067-wordpress-import` from `origin/main` (`77fa978`); not committed yet (D-GIT-71). Before it: PR #79, the two standing rules (D-GIT-70) |

Checks marked agent-executed were run by the agent. They are not human approval.

## Decisions in this task

| ID | Decision |
|---|---|
| D-CONTENT-19 | Design approved: ADR-0003 §3 and §9 amended; `cheerio` declared; the 17 people left out until consent; all linked PDFs imported |
| D-CONTENT-20 | No demo content on production; m1-069 builds the design directions as switchable theme presets |
| D-DB-20 | One container per service, all in one Compose stack (replaces D-DB-10 (b)); built in m1-068 |
| D-DB-21 | Release pipeline through the GitHub Container Registry; built in m1-068 |
| D-SEC-9 | The live WordPress site appears compromised (spam posts); reported to the owner |

## What was built

| File | Change |
|---|---|
| `modules/assurer-wp-import/index.js` | The task `assurer-wp-import:run`: dry run unless `--execute`; options `--source`, `--media-before` (default 2026-11-08, the spam window), `--max-image-mb` (15), `--max-file-mb` (60); a report of created, updated, unchanged, kept, skipped, review items and failures |
| `modules/assurer-wp-import/lib/source.js` | Public REST reads with pagination and `_fields`; downloads only from the source's `/wp-content/uploads/`, size-checked before and while streaming, with a timeout; https only (loopback http for tests) |
| `modules/assurer-wp-import/lib/extract.js` | Elementor HTML → plain blocks by `data-widget_type` (`cheerio`) |
| `modules/assurer-wp-import/lib/plan.js` | Blocks → the plan: pages, products, organizations, location, images, PDFs, redirects; texts over the schema limits are shortened at a sentence and reported |
| `modules/assurer-wp-import/lib/media.js` | Size variants resolved to the media item; Elementor screenshots, Slider Revolution assets and placeholders refused; image names and drafted alt text from where the image is used |
| `modules/assurer-wp-import/lib/site-map.js` | Which pages are imported and how; download sources; constants |
| `modules/assurer-wp-import/lib/apply.js` | Writes through Apostrophe APIs with a draft request; the import state rule (below); PDF redirects; a warning when a page path is already used on the target site |
| `app.js` | Registers the module |
| `modules/assurer-organization/index.js` | Comment only: the import creates drafts |
| `docker/staging/assurer-task.sh`, `docker/staging/Dockerfile` | `assurer-task` runs `node app <task>` in the container as the `assurer` user, with the database address and session secret from the secrets volume, passed by environment like `pbmc` |
| `package.json`, `package-lock.json` | `cheerio@^1.2.0` declared (the copy Apostrophe already installs; lockfile +1 line) |
| `scripts/wp-import.test.mjs` | 6 unit tests on synthetic HTML |
| `scripts/wp-import-test.mjs`, `scripts/run-ci-tests.mjs` | CI: a fake WordPress on a loopback port; the import runs twice (second run must change nothing); after a restart, every imported draft is 404 logged out and nothing imported is published; the PDF redirect points at the new file |
| Docs | Design note; ADR-0003 amendment; decision register; runbook §4.1 and §11.3; CA-5 checklist (B1, §7); INDEX; m1-068 handoff |

**What the import brings in** (dry run against the live site, 2026-11-11): 13 pages, 47 products
(31 product lines and 16 herbs), 8 organizations, 1 location, 264 images (29.2 MB), 8 PDFs
(125.5 MB) and 8 PDF redirects. Skipped: all posts (22 spam, 1 default), the slider, the contact
form and map, the retired pages (D-CONTENT-3), the video, people, unused media and uploads from
2026-11-08 on. The report lists 18 review items (figures, organizations, shortened texts, the
location split, gallery alt text, Food & Minerals without content).

## Results (agent-executed)

| Check | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run test:unit` | PASS, 107/107 (6 new) |
| `npm run test:smoke` | PASS, 18/18 (on the local site at :3000, which runs the code from before this task; see `test:ci` for the new code) |
| `npm run test:workflow` | PASS, 15/15 (same server) |
| `npm run test:persistence` | PASS, 7/7 (same server) |
| `npm run test:ci` (new code, temporary database) | PASS on run 5 (runs 1 to 4 below) |
| Local import, temporary SQLite database, live WordPress | Dry run: 348 to create, 1 to update (the empty home page), 0 failed. Run 1: 348 created, home updated. Run 2: 349 unchanged. After an editor changed a product draft: that product **kept**, 348 unchanged, no duplicate |
| Container import (local staging image, `amd64`, MongoDB 8.0 with TLS, through `assurer-task`) | `assurer-task` without arguments prints usage (exit 2). Dry run as above. Run 1: 348 created, 1 updated, 0 failed. Run 2: 349 unchanged |
| Logged out on both sites | `/` 200 without imported text; `/style`, `/style/apparels-textiles`, `/health/beauty-herbs`, `/leadership`, `/contact-us`, `/downloads`, `/gallery/images` 404; drafts API refuses anonymous visitors |
| PDF redirects | `/wp-content/uploads/2023/02/AWW-VCL-Profile.pdf` → 301 → the new file, 200 `application/pdf`, 5,500,056 bytes (same as WordPress); likewise Food & Minerals (14,622,591 bytes) |
| Bugs found and fixed while testing | PDF redirect pointed at `http://localhost:3000` (now site-relative); dry run reported missing parents; the role cards became organizations; PDFs not found; an empty "Ungrouped" tab in every editor from hidden schema fields (dropped, key kept as plain properties); a CI check that assumed the WordPress paths were free |

**`test:ci`:** run 1 failed in the new test's own report parser (Apostrophe's log adds a time to
each line; the import itself had created 10 drafts, then changed nothing). Run 2 failed the legacy
redirect map test, which expects exactly 20 redirects: the import step ran before it and added its
PDF redirect; the import steps now run after it. Run 3 passed everything up to "WordPress import: drafts stay private", which failed
because the SEO test had already published its own pages at `/style`, `/style/apparels-textiles` and
`/downloads` (a wrong assumption in the check, not a leak). The check now finds the import's drafts
by their key, and the import reports a path that is already taken. Run 4 then
failed the same check for another reason: the page list API returns fewer fields, so it found no
import keys (it also meant a "nothing published" check on that list could never fail). The check
now reads each page on its own and looks up each draft's published version directly; the home
page, which Apostrophe publishes itself, must have none of the imported content. **Run 5: PASS,
every step** (22 steps, including "WordPress import, twice" and "WordPress import: drafts stay
private": 3 imported drafts found, each 404 logged out with no published version, no published
product, the PDF redirect 301 to the new file).

## Browser checks (Chrome, agent-executed)

Isolated copy of the project on `127.0.0.1:3101` with the temporary database from the local import
(so the uploads are served); signed in as the disposable editor `m1-067-editor` (role editor).

| Check | Result | Steps and actual result |
|---|---|---|
| Published home stays empty | PASS | Signed in, home in Published mode: the empty-page hint, no imported content |
| Home draft | PASS | Switched to Draft: 6 category cards with images, texts and "More" links; about text; 4 figures each with "Unconfirmed: check before publishing"; services; 8 organizations; roles; goal, vision, mission, values; sustainability |
| Category page draft | PASS | `/style/activewear-accessories`: header image, summary from the home card, 6 products from their draft records, the category PDF; 0 broken images, no horizontal overflow at 1440 px |
| Downloads draft | PASS | 8 PDFs with titles, sizes and descriptions; no "Lorem ipsum" card |
| Tablet and mobile layout | PASS (with a limit) | Apostrophe's Tablet and Mobile breakpoint previews on `/health/beauty-herbs`: 2 columns, then 1, no overflow. The window resize tool did not change the page width, so real 768 and 375 px windows were NOT TESTED |
| Products are drafts | PASS | Content → Products: all 47 marked Draft |
| Product editor | PASS | "Beding": main image and 12 gallery images with readable names; no "Ungrouped" tab after the fix |
| Editor's change survives a re-run | PASS | Title changed to "Bedding", Save Draft ("Draft saved"); the next import run reported it **kept** and created no duplicate |
| Cancel without changes | NOTE | Cancelling an untouched imported product asks "Unsaved Changes"; the editor-saved product does not. Cause: the editor fills defaults (empty crop values, SEO select defaults such as availability "InStock") that server-side creation leaves empty. Discarding changes nothing. Not changed: "InStock" would be an invented claim (D-CONTENT-12). Candidate below |
| Publishing | NOT TESTED | On purpose: nothing was published |

## Implicit state review

| State | Where | Decision | Reason |
|---|---|---|---|
| Per-document import state: new, unchanged, changed, kept | `lib/apply.js` `stateOf` | **Made explicit** | Without it the rule would be spread over `updatedBy`, `lastPublishedAt`, `archived` and the fingerprint. One function, the transitions in its comment, `kept` final (a person's edit, publish or archive is never overwritten); unit-tested; shown per item in the report |
| Home page adoption | `lib/apply.js` | Made explicit | Apostrophe creates the home page, so it starts "not ours". One marked transition (`adopted`), only while its content area is empty |
| Dry run versus write | `index.js` | Explicit (one flag, default dry) | The first line of every run says which mode it is in |
| PDF redirects: new, unchanged, changed, kept | `lib/apply.js` | Same rule as documents | A redirect the import made follows the file; one a person changed is left alone |
| Temporary downloads | `lib/apply.js` | Kept simple | One temporary folder per run, removed in `finally` |
| Path conflict on the target site | `lib/apply.js` | Made observable | Apostrophe silently gives the draft another slug; the report now says so (found by CI) |
| Candidate, not changed | Apostrophe editor | Listed | "Unsaved Changes" on first cancel for any server-created document (see browser checks); core behaviour |

## For the owner

**Security (D-SEC-9):** the live WordPress site has 22 spam posts published 2026-11-09 and
2026-11-10 as `admin`. The steps are in the decision register. This project does not touch
WordPress.

**The OCI test run (your steps, after the PR is merged):**

```sh
cd <clone> && git pull
S="docker compose -f docker/staging/compose.yaml -f docker/staging/compose.ip.yaml"
$S build && $S up -d                                    # the new image with assurer-task
$S exec site assurer-task assurer-wp-import:run         # dry run: read the report
$S exec site assurer-task assurer-wp-import:run --execute
```

Then review the drafts in Chrome as an editor (Pages, Content → Products, Media, tag "Imported from
WordPress"), fix what the report lists, and publish only what you confirm. The 20 legacy redirects
follow after publishing (`assurer-task assurer-seo:seed-redirects`). The site is plain HTTP and
open to everyone (D-DB-19): editor passwords cross the internet unencrypted until go-live.

**Content to check:** the figures; the 8 organizations; "Beding" (typo on WordPress);
"(Hibiscus sabdarif)fa" (as on WordPress); Food & Minerals (no content; the home card describes
cotton); the Dhaka address split; the messaging numbers (not imported); gallery alt text.

## Not done or not verified

- The OCI test run (owner's step) and a real phone and tablet (only Apostrophe's previews).
- The `arm64` build of the new image: the hosted workflow runs on the PR (`docker/staging/**`).
- The download size limit was not triggered in a test (the largest PDF, 46.1 MB, is under 60 MB).
- The archive path of the state rule through the UI (unit-tested only).
- The "path is already used" warning was added after CI found the case; its text was not seen in a
  run (the CI import output is printed only on failure).

## Left over

- Temporary data in the agent's scratch folder: two SQLite databases with the imported drafts, their
  uploads, an isolated copy of the project, test accounts `m1-067-admin` and `m1-067-editor` (in
  those databases only).
- Local Docker project `m1-067-test` (image `assurer-site:staging-m1067`, volumes with a MongoDB
  copy of the import). Stopped by the agent, not removed: removal deletes its volumes
  (`docker compose -p m1-067-test … down -v`), the owner's choice.
- Nothing on the OCI server, in WordPress, or in the local site's database at :3000 apart from what
  `test:workflow` writes there in every run.
