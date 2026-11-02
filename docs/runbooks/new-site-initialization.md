# Runbook: Initialising a new company website with clean data

| | |
|---|---|
| **Status** | Draft. Steps 4–6 are the same commands used in M0 (verified on SQLite). Not yet run for a second site. |
| **Decision** | [ADR-0002 §8](../architecture/decisions/ADR-0002-database-strategy.md) |

Principle: **every site is independent.** It has its own database, media store, secrets and
admin accounts. **Never clone another site's database**: that would copy its users, password
hashes, sessions, API tokens, form submissions and version history.

1. **Code:** create the site's repository (or deployment) from the approved codebase. Set a
   unique `shortName` in `app.js`; it names the session cookies and the default database.
2. **Database:** create a new, empty PostgreSQL database (`<site>_production`, underscores) and a
   dedicated role with rights on that database only. For local work use
   `sqlite://./data/<site>.db`.
3. **Media:** create a new bucket, or a prefix with credentials limited to it, with versioning
   on. Local: the default `public/uploads`.
4. **Secrets:** `cp .env.example .env`, generate a new `APOS_SESSION_SECRET`, and set
   `APOS_DB_URI` and the storage variables. Never reuse values from another site.
   Leave `APOS_DEMO_SITE` unset on a real-content site; set it to `1` only on development
   and demo sites (m1-029).
5. **Initialise:** `node app @apostrophecms/migration:migrate`. This creates the home page, the
   global document and the indexes.
6. **First admin:** `node app @apostrophecms/user:add <username> admin` (interactive password
   prompt). Store the credentials in the password manager, not in files or tickets.
7. **Starter content (optional):** run the site's seed task (pattern: `assurer-demo:seed`).
   Content comes from code, not from copying data.
8. **Verify:** run `npm run test:smoke` and `scripts/editor-workflow-test.mjs`; take the first
   backup (database backup runbook, §A or §C).
9. **Record:** add the site to the engineering index with a dated report.
