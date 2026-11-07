# m1-047 — SQLite (WAL) for staging and production

| | |
|---|---|
| **Task** | m1-047 |
| **Date** | 2026-11-07 |
| **Scope** | Research whether SQLite in WAL mode can replace MongoDB for staging and production, with a backup tool, the SQLite settings, a database dashboard and the hosting question; record the owner's decisions. Docs only; nothing installed |
| **Prompt** | [2026-11-07-m1-047-sqlite-production-option.prompt.md](../../../prompts/2026/11/2026-11-07-m1-047-sqlite-production-option.prompt.md) |
| **Handoff** | [m1-047 start handoff](../../../../milestones/m1-047-handoff.md) · next: [m1-048 handoff](../../../../milestones/m1-048-handoff.md) |
| **Branch / commit** | `docs/m1-047-sqlite-production-option` from `origin/main` `e0857bd`. Commit and push approved by the owner (D-GIT-45); PR opened by the owner |
| **Related** | D-DB-8 · D-DB-10 · D-DB-12 · D-DB-13 (new) · D-SEC-5 · D-GIT-44 · D-GIT-45 (new) · [options paper](../../../../milestones/m1-047-sqlite-production-options.md) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Task choice: the owner's prompt asked for this research. The handoff's §2 candidates were not
  picked; the owner's question replaced them.
- Precondition: PR #49 (m1-046) is merged as `e0857bd`. The five hosted CI checks (secrets, lint,
  audit, test, build) are `success` on that commit, read through the public GitHub API.
- No package, lockfile, `.env`, Docker file, volume, account, server or production system was
  changed. No tool was installed.

## Decisions recorded

| ID | Decision | Owner's answer (2026-11-07) | Agent suggestion followed? |
|---|---|---|---|
| D-DB-13 | Engine for staging and production | **B. SQLite with Litestream, subject to the proof of concept.** Accepts one app server, a young adapter, and Litestream's SSE-C-only encryption and object lock clash | Yes |
| D-DB-13 | Docker | Keep Docker "along with regular": both a Compose setup and a plain systemd setup | Partly. The agent suggested systemd only, with Docker for demos |
| D-DB-13 | Dashboard | Both layers: admin-only CRUD, export and import through Apostrophe, plus read-only Datasette | Yes |
| Next task | Local Litestream proof of concept | Yes, next. Installing still needs approval in that task | Yes |
| D-DB-8, D-DB-12, D-SEC-5 | — | Superseded (D-DB-8) or on hold (D-DB-12, D-SEC-5) as a result of D-DB-13 | — |

The owner also asked whether Vercel or Cloudflare Workers could host the site. The paper (§4.8)
answers no for the app with SQLite (no persistent disk, no long-running process, and no native addon
on Workers). Cloudflare in front of the server is possible later, as a separate decision for the DPO.
That answer comes from the agent's general knowledge and was not checked against current vendor docs.

## Findings

Details and sources are in the [options paper](../../../../milestones/m1-047-sqlite-production-options.md).

- **The project already runs on SQLite.** db-connect 1.1.0 opens the file with `journal_mode = WAL`
  and `busy_timeout = 5000`, and better-sqlite3 12.11.1 bundles SQLite 3.53.2 with `synchronous`
  NORMAL in WAL mode (read from the installed source). 3.53.2 includes the fix for the WAL-reset
  corruption bug.
- **Apostrophe supports SQLite for small single-server production sites**, and warns against it for
  more than one app server or an ephemeral file system.
- **db-connect has no option for SQLite settings.** The paper proposes no changes and lists each
  setting for the proof of concept to check.
- **Litestream** (Apache-2.0, v0.5.18) meets RPO and PITR on paper. It has no client-side encryption
  (SSE-C or SSE-KMS only), and its compaction deletes clash with compliance-mode object lock. Its
  checkpoint handling next to the app's own automatic checkpoints must be tested.
- **Dashboard:** raw edits to the JSON rows would bypass Apostrophe and the ADR-0002 rule, so CRUD and
  import go through an admin-only Apostrophe module (with `@apostrophecms/import-export` 3.7.1), and
  raw access stays read-only (Datasette 0.65.5 or later, `mode=ro`, loopback only).

## Checks

| Check | Result |
|---|---|
| `npm run lint` | PASS (no output from ESLint) |
| `npm run test:smoke`, `test:workflow`, `test:persistence` | NOT RUN: docs-only task, no code changed |
| Browser smoke check of the public site | **PASS** (agent-executed, Claude in Chrome, 1440 px, logged out): `npm start` on the local SQLite database; `http://localhost:3000/` rendered the home page with header, navigation, hero and "Log in" button. An unknown URL returned 404 (curl). Server stopped afterwards; no content changed |
| Internal links in the new and changed docs | PASS: every relative `.md` link in the paper and the m1-048 handoff resolves |

## Not done or not verified

- No Litestream run, no S3, no server, no `arm64`.
- The ADR-0002 amendment or a new ADR for D-DB-13 is not written yet.
- The hardening runbook §6 and §7 and the single-container runbook are not yet marked as superseded
  for staging.
- Unverified items are listed in the paper's §8.
