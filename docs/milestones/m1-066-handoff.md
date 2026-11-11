# m1-066 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-11, by the agent at the end of m1-065 (agent-executed; not a human approval) |
| **Task** | `m1-066`: the automated WordPress import into drafts, test run on the OCI site (D-CONTENT-17) |
| **Preconditions** | The m1-065 records PR is merged |
| **Branch** | `feat/m1-066-wordpress-import` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-16 to 18, D-CONTENT-2, -4, -9, -12, D-DB-19) · [m1-065 report](../engineering/reports/2026/11/2026-11-11-m1-065-oci-installer-run.report.md) · [CA-5 checklist](../content/ca5-migration-checklist.md) · [WordPress inventory](../content/wordpress-site-inventory.md) · [content model](../content/apostrophe-content-model.md) / ADR-0003 · [SEO plan](../content/seo-and-migration-plan.md) · [staging container runbook](../runbooks/staging-container.md) §11 |

## 1. State after m1-065

- **The OCI site** runs in IP mode (D-DB-19): plain HTTP on the server's public address, port 8090,
  open to everyone, `noindex`. Empty content. One leftover account, `m1-065-editor` (the owner
  archives or keeps it). WordPress still serves the domain.
- **WordPress public REST API** (read-only, checked 2026-11-11): `/wp-json/wp/v2/` pages 26, media
  964, posts 23. Layouts are Elementor and Slider Revolution: content can move, layouts cannot.
- **Gap:** no documented way to run Apostrophe tasks inside the staging container (`node app …`
  needs the database URI the entrypoint builds). The import and `assurer-seo:seed-redirects` need it.

## 2. The task (owner's decision D-CONTENT-17)

Build a project task that imports the WordPress site into **drafts**, then run it as a test on the
OCI site:

1. **Design note first** (short, for the owner): the mapping from WordPress pages, posts and media
   to the page types, widgets and pieces in ADR-0003 and CA-5 checklist §2–§3; what is imported as
   text, what becomes records (organizations, people, products, locations, files); image renaming
   and drafted alt text; redirects (the 20 legacy ones plus the PDFs); what is skipped (W13–W29 per
   D-CONTENT-3, demo or placeholder images). Ask the owner before the build.
2. **The task-runner gap** (§1): a supported way to run `node app <task>` in the container, such as
   a small wrapper next to `pbmc`, documented in the runbook.
3. **The importer:** reads the public REST API only (never logs in, never writes to WordPress);
   writes through Apostrophe APIs (no raw database writes, ADR-0002); drafts only, never publishes;
   repeatable (running again updates its own drafts, keyed by the WordPress ID); a dry run that
   prints what it would do; size limits on downloads. No new dependency without approval.
4. **Local test** against a local site, then the **test run on the OCI site** (owner runs the
   command), then review in Chrome as an editor, desktop, tablet and phone.

## 3. Gates and limits

- People's details and photos (17 leaders) need consent (D-CONTENT-4): import them as drafts only,
  never published, or leave them out; ask the owner.
- Facts and figures need the owner's confirmation before publishing (D-CONTENT-12). The agent
  drafts alt text and image names for review; it does not write new business copy.
- **The wipe before the final run** ("Same site, wipe later", D-CONTENT-17) permanently deletes the
  OCI site's data: a backup first, and the owner's explicit approval at that time. Not in m1-066.
- The video (D-CONTENT-9) and anything from WordPress's private area are out of scope.
- Commit, push and PR need the owner's approval. A new dependency needs approval and a licence and
  advisory check.

## 4. After m1-066

- **m1-067: design from the owner's example sites** (D-CONTENT-18): the owner names a few sites;
  the agent studies them in Chrome, read-only, and proposes 2–3 original directions on the OCI site
  with the imported content. No copying of look, text or images. Image-generation services need
  approval.
- Later: the final import on the permanent site, go-live (runbook §11.4), the §9.2 production items,
  and automated updates with a local AI agent (design first).

## 5. Prompt for the new session

> Start m1-066. Read AGENTS.md and docs/milestones/m1-066-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
