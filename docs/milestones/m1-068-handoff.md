# m1-068 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-11, by the agent at the end of m1-067 (agent-executed; not a human approval) |
| **Task** | `m1-068`: the release pipeline (D-DB-21) and one container per service in one Compose stack (D-DB-20) |
| **Preconditions** | The m1-067 PR is merged. The owner's test run of the WordPress import on the OCI site may happen before or after this task (m1-067 report, "Owner's next steps") |
| **Branch** | `feat/m1-068-release-pipeline` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-20, D-DB-21, D-DB-10, D-DB-12, D-DB-15, D-DB-19) · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [m1-067 report](../engineering/reports/2026/11/2026-11-11-m1-067-wordpress-import.report.md) · [staging container runbook](../runbooks/staging-container.md) (§4, §9–§11) · [PBM runbook](../runbooks/pbm-backup-and-restore.md) · `.github/workflows/staging-arm64.yml` |

## 1. State after m1-067

- The OCI site still runs the image built **on the server** from a clone (`git pull`, `$S build`).
  The app and MongoDB share one container (`site`), with the database in the `mongo-data` volume.
- New in m1-067: `assurer-task` in the image runs any `node app <task>` in the container (runbook
  §4.1); the WordPress import `assurer-wp-import:run` (drafts only, dry run by default).
- The OCI database is wiped before the final import (D-CONTENT-17, "Same site, wipe later"), so a
  layout change now needs no data migration. The wipe still needs a backup and its own approval.

## 2. The task (owner's decisions of 2026-11-11)

1. **Design note first** (short, for the owner), then ask before building:
   - the GitHub Actions job that, after the tests on `main`, builds the staging images for `amd64`
     and `arm64` and pushes them to **`ghcr.io`** as private packages, tagged with the commit;
   - the services in **one Compose stack**: `app` (Apostrophe, cluster workers), `mongo` (the
     official MongoDB 8.0 image, `arm64`, TLS and member auth as today), `pbm` (agent next to
     MongoDB), `nginx`, `certbot`; volumes, networks, health checks, start order, limits;
   - how `assurer-task`, `pbmc`, the first-start secrets and the migrations move with the split;
   - the server side: `$S pull` and `$S up -d` in place of the build; rollback by tag; the
     read-only pull token stored like the other secrets;
   - what changes in `install.sh`, `ip-setup.sh`, `npm-setup.sh` and the runbooks.
2. **Gates:** the ADR-0004 amendment (Decision 2: one container → one per service; architecture
   gate); the GitHub setting for package write permission; the pull token on the server; any new
   image or action (licence and advisory check); anything run on the OCI server (owner runs it).
3. **Build, then prove:** local Compose run on `amd64`, the hosted `arm64` workflow, a PBM backup
   and restore on the split stack, the four suites, and the Chrome checks.

## 3. Limits

- Every image supports `arm64`; everything runs through Docker Compose.
- No change to WordPress. No wipe of the OCI database in this task.
- Commit, push and PR need the owner's approval.

## 4. After m1-068

- **m1-069: design from the owner's example sites** (D-CONTENT-18), built as **switchable theme
  presets** with a "Theme" choice for admins (D-CONTENT-20), on the imported content.
- Later: the data dashboard layer 1; the final import on the permanent site; go-live (runbook
  §11.4); the §9.2 production items; automated updates with a local AI agent (design first).

## 5. Prompt for the new session

> Start m1-068. Read AGENTS.md and docs/milestones/m1-068-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
