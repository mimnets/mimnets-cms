# m1-072 start handoff (2026-11-12)

| | |
|---|---|
| **Prepared** | 2026-11-12, by the agent at the end of m1-071 (agent-executed; not a human approval) |
| **State of `main`** | `8f11100`: PR #87 (m1-071) merged on 2026-11-12. This file is on branch `docs/m1-071-handoff` in its own PR. Before starting, check that this file's commit is on `origin/main` (`git merge-base --is-ancestor <commit> origin/main`) |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [m1-071 report](../engineering/reports/2026/11/2026-11-12-m1-071-layout-columns.report.md) · [m1-071 design](m1-071-layout-columns-design.md) §11–12 · [m1-069 prompt record](../engineering/prompts/2026/11/2026-11-12-m1-069-arm64-restore-drill.prompt.md) (the owner's slider request) · `modules/assurer-slideshow-widget/` · `modules/assurer-hero-widget/` · [editorial requirements](../content/editorial-and-design-requirements.md) (motion) |

## 1. Where things stand

**Done in m1-071** (D-CONTENT-21): one widget table in `lib/area.js` for page, layout-column and
nested-column menus (expanded "Add Content" panel with groups); grids and hero read their
container (CSS container queries); starters `layout-3`, `layout-4`, `layout-6`; Background style
on layouts and columns; a "Button" style for Rich Text links. Tests and Chrome checks as an editor
in the report.

**Open, for the owner**

1. **Merge the PR for this handoff** (branch `docs/m1-071-handoff`). PR #87 (m1-071) is merged.
2. **Check m1-071 on the OCI site** after the merge, the `release` run and `deploy.sh` (the owner
   said they will do this). Not yet checked on MongoDB.
3. Still open from m1-070: deploy and check the data dashboard on OCI, if not done yet.
4. Optional, from m1-071: brand colours as colour presets (`@apostrophecms/color-field`
   `presetColors`); image `sizes` for widgets in columns; the flat dropdown menu instead of the
   expanded panel, if editors prefer it.
5. The local dev server on port 3000 was started by the m1-071 session (`npm run dev`); it stops
   with that session. Start it yourself with `npm run dev`.

## 2. Recommended next task

**`m1-072`: the slideshow upgrade, with image and text animation.** Design note first.

What the owner asked for (m1-069 prompt record and m1-071):

1. "need to have more control and design options for slider … now the slider is very simple and
   general". Main use: "full-width banner with headlines and buttons, like a hero and please also
   consider other options too."
2. Image and text animation, to go with the slideshow upgrade (owner, m1-071: "animation with the
   slideshow upgrade").

Fix first: autoplay has **no visible pause control** (WCAG 2.2.2, Pause, Stop, Hide). Today it
already stops under `prefers-reduced-motion` and on hover or focus
(`modules/assurer-slideshow-widget/ui/src/index.js`).

Points for the design note:

- **Slides as hero banners**: heading, text, up to 2 buttons, overlay, text position; reuse the
  hero's fields and `linkFields()` rather than copying them (clean architecture: one shared slide
  or banner schema). Each slide's heading level (only one H1 per page).
- **Other uses** the owner asked to consider (for example a logo or partner strip, testimonials,
  image-only gallery slides) and which ones are worth building now.
- **Controls**: pause/play button, previous/next, dots, keyboard, swipe; autoplay interval; loop.
- **Animation, without a new package** (libraries were declined on 2026-10-29: GSAP licence,
  Lenis scrolling): CSS transitions and keyframes, started by `IntersectionObserver`; a
  per-widget "Entrance animation" style (none, fade, slide up) possibly for other widgets too;
  everything off under `prefers-reduced-motion`; no auto-moving text (editorial requirements).
- **Core first**: check whether Apostrophe 4.34 styles or widget options cover any of it before
  writing project code (m1-071 found core has no animation feature).
- Whether the slideshow may go into layout columns afterwards (excluded in m1-071 until this task).
- Browser checks as an editor at 1440, 768 and 375 px, plus keyboard and reduced-motion checks.

**After that, in the owner's order:** the staged rename to `mimnets-wms` (a name map in INDEX
first; stored names stay brand-free); the theme presets (D-CONTENT-18, D-CONTENT-20). Later, from
D-DB-24: backup status in the dashboard's Health tab, and layer 2 (read-only MongoDB viewer).

## 3. Lessons from m1-071

- **Check which server you test.** Module config (`index.js`, `lib/area.js`) loads only at start.
  Before trusting server suites or Chrome checks, check the process on port 3000 and its start
  time. An old agent-started server can run hidden under Git Bash, with no window to stop; the
  owner stopped it with `taskkill /PID <npm pid> /T /F`.
- The Chrome window may not resize. m1-071 measured 768 and 375 px in logged-out
  `credentialless` iframes inside the same tab; say so in the report.
- `gh` is not installed on the owner's PC: push the branch and give the owner the PR link,
  title and description.

## 4. Limits

- No change to WordPress. Commit, push and PR need the owner's approval. Anything on the OCI
  server is run by the owner.

## 5. Prompt for the new session

> Start m1-072. Read AGENTS.md and docs/milestones/m1-072-handoff.md first, check that the m1-071
> handoff PR is on main, confirm the task with me, write the design note and stop for my approval.
