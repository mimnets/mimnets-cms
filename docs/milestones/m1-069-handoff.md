# m1-069 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-11, by the agent at the end of m1-068 (agent-executed; not a human approval) |
| **Task** | `m1-069`: design from the owner's example sites (D-CONTENT-18), built as switchable theme presets with a "Theme" choice for admins (D-CONTENT-20), on the imported content |
| **Preconditions** | The m1-068 PR is merged and its first `release` run on `main` passed. The OCI site runs the split stack (`mimnets-cms`) with the WordPress import run again (m1-068 report, "For the owner" step 5); the design work can start locally before that |
| **Branch** | `feat/m1-069-theme-presets` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-CONTENT-12, D-CONTENT-18, D-CONTENT-20, D-SEC-10) · [m1-068 report](../engineering/reports/2026/11/2026-11-11-m1-068-release-pipeline.report.md) · [design tokens](../content/design-tokens.md) · [editorial and design requirements](../content/editorial-and-design-requirements.md) · [staging container runbook](../runbooks/staging-container.md) §12 |

## 1. State after m1-068

- The stack has one container per service (`app`, `mongo`, `pbm`, `backup`, `nginx`, `certbot`)
  in the Compose project `mimnets-cms`. CI builds the images for each commit on `main` and pushes
  them to `ghcr.io/mimnets/` (private); the server runs `bash docker/staging/deploy.sh` and never
  builds. Rollback: `deploy.sh <previous commit> --rollback` (runbook §12.2).
- A design change ships as an ordinary release: merge, CI builds, `deploy.sh` on the server.
  MongoDB is not restarted by an app release.
- Still open from m1-068 if not yet decided: ADR-0004 Amendment 1 acceptance, D-SEC-10, the package
  visibility and storage check.

## 2. The task

1. Ask the owner for the example sites. Study them read-only in Chrome; record their patterns
   (structure, page flow, type, space, product presentation). No copying of another site's look,
   text or images (D-CONTENT-18).
2. **Design note first**: 2 or 3 original directions as theme presets, how a preset is stored and
   chosen (an admin-only "Theme" setting, D-CONTENT-20), what stays shared (templates, widgets,
   content), and the tokens each preset sets. Stop for approval before building.
3. Build, then prove: the suites, Chrome checks as an editor and an admin at 1440, 768 and 375 px,
   switching presets, the implicit state review.

## 3. Limits

- No change to WordPress. Photographs from an image-generation service are a new tool and cost:
  not without approval.
- Commit, push and PR need the owner's approval.

## 4. Prompt for the new session

> Start m1-069. Read AGENTS.md and docs/milestones/m1-069-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
