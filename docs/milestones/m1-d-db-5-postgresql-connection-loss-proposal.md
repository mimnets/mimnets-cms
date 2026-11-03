# D-DB-5 follow-up proposal: PostgreSQL connection loss crashes the app

| | |
|---|---|
| **Status** | **Proposal** (`m1-011`, 2026-10-20). D-DB-5 stays **OPEN**. Nothing here has been run against PostgreSQL in m1-011; no fix is claimed. **m1-032 (2026-11-02):** still OPEN. db-connect on npm is still 1.1.0, and its three `new Pool(...)` calls still have no `error` listener. A new duplicate search (GitHub issue search: "postgres", "ECONNRESET", "pg-pool", "db-connect") found no matching issue, so the §2 text stands unchanged. The §4 test is now a script, [`scripts/pg-connection-drop-test.mjs`](../../scripts/pg-connection-drop-test.mjs). It was **not run**: no PostgreSQL is available, and it waits for the D-DB-2 major version and an approved disposable instance. **m1-033 (2026-11-02): run** on an owner-approved disposable Neon free-plan PostgreSQL 16.15 ([m1-033 report](../engineering/reports/2026/11/2026-11-02-m1-033-pg-connection-drop.report.md)). Step 2 without a supervisor: the process exits (`pg_terminate_backend` takes the same `idleListener` path, so the "not tested" remark in §2 is now tested). Step 2 with `--supervise`: serving again 20 s after the drop. Step 4 (cursor): exits. Step 3 (server restart) and step 1 (two instances) not run. D-DB-5 stays OPEN. **m1-034 (2026-11-03):** steps 1 and 3 run on the same Neon project ([m1-034 report](../engineering/reports/2026/11/2026-11-02-m1-034-pg-restart-two-instances.report.md)). A compute suspend exits the app; with `--supervise`, serving again after 17 s and 20 s. Two instances behind a local health-checked proxy hide a one-instance drop only. Step 5 waits for a fixed release. **m1-035 (2026-11-03):** §2 text updated with the m1-033 and m1-034 results after a new duplicate search (none found); still **not filed** (owner, I6). D-DB-5 stays OPEN. |
| **Decision** | D-DB-5 (open) · D-DB-6 (Option B: PostgreSQL for development and testing only) |
| **Proposed task** | The next free task ID when it starts (expected `m1-012` or later; WS-4 form operations may take `m1-012` first) |
| **Evidence** | [m1-010 report, D15b](../engineering/reports/2026/10/2026-10-20-m1-010-postgresql-compatibility-acceptance.report.md) · [m1-011 report](../engineering/reports/2026/10/2026-10-20-m1-011-security-hardening.report.md) |

## 1. Verified facts (m1-011)

- Installed: `@apostrophecms/db-connect` **1.1.0** (latest on npm), `pg` 8.23.1, `pg-pool` 3.14.0.
  The upstream source is the `apostrophecms/apostrophe` monorepo, `packages/db-connect`. Its
  `main` branch is also 1.1.0, and `adapters/postgres.js` is identical in the relevant part.
- `adapters/postgres.js` (1.1.0) creates its pools with `new Pool({ connectionString, ...options })`
  in three places: the main pool, the temporary `/postgres` admin pool used for
  `CREATE DATABASE`, and the reconnect pool. **None of them gets an `'error'` listener.** The
  cursor implementation also holds a checked-out client (`this._cursorClient`) across `FETCH`
  calls without a client `'error'` listener.
- node-postgres contract (installed `pg-pool` README and `index.js`): an idle client that loses
  its connection emits `'error'` through the pool (`idleListener` → `pool.emit('error', err,
  client)`). The README says to "attach an error handler to the pool" for this case. Without a
  listener, Node treats it as an unhandled `'error'` event and the process exits. That matches
  the m1-010 stack (`read ECONNRESET` from `idleListener`).
- Upstream search (GitHub issue search over `apostrophecms/apostrophe`, open and closed: "pool
  error", "ECONNRESET", "pg-pool", "postgres crash", "db-connect"): **no matching issue**.
  #5024 "issue with postgres" is an unrelated MongoDB connection question.
- Supported configuration offers no hook. `@apostrophecms/db` passes only its `connect` option
  and `adapters` to `dbConnect`, and `pg`'s `Pool` options have no error-handler setting.
  Attaching a listener from the project would mean reaching into the private
  `apos.dbClient._pool` field.

## 2. Upstream issue (ready to paste; not filed)

The owner files this at <https://github.com/apostrophecms/apostrophe/issues/new> after reviewing
the text (I6). `gh` is not installed and no token is used, so the agent does not file it.

**m1-035 (2026-11-03): text updated** with the m1-033 and m1-034 results. Re-checked before the
update: db-connect on npm and on upstream `main` is still 1.1.0, and `apostrophe` 4.34.0, `pg`
8.23.1 and `pg-pool` 3.14.0 are still the latest on npm. The installed `adapters/postgres.js` still
has three `new Pool(...)` calls (main pool, `/postgres` admin pool, reconnect pool) and no
`'error'` listener. The duplicate search (GitHub issue search API, open and closed, on
`apostrophecms/apostrophe`: "postgres", "ECONNRESET", "db-connect", "pool error" since
2026-01-01) found **no matching issue**. #5604 (closed, "Document Versions in core") fixed the
release of abandoned cursor connections. It does not add pool or client `'error'` listeners, so
it is linked as related only.

> **Title:** db-connect (postgres): process exits when PostgreSQL drops an idle pooled connection — no `error` listener on the pg Pool
>
> **Versions:** apostrophe 4.34.0, @apostrophecms/db-connect 1.1.0, pg 8.23.1, pg-pool 3.14.0, Node 24.21.0. PostgreSQL 16.15, both self-hosted (local) and managed (Neon, direct endpoint, TLS).
>
> **What happens.** With `APOS_DB_URI=postgres://…`, if PostgreSQL closes a connection that is idle in the pool, the Node process exits. Causes include a server restart, a failover, `pg_terminate_backend`, a proxy or firewall idle timeout, a managed service suspending its compute, and a network drop. Two stacks we captured:
>
> ```
> Error: read ECONNRESET            (local server, pg_ctl stop -m immediate)
> Error: terminating connection due to administrator command   (pg_terminate_backend)
> Emitted 'error' event on BoundPool instance at:
>     at Client.idleListener (pg-pool/index.js:62)
> ```
>
> In both cases the process exits with code 1. We reproduced this with:
> - `pg_ctl stop -m immediate` on a local PostgreSQL 16.15;
> - `pg_terminate_backend` on the app's idle connections, on a managed PostgreSQL 16.15;
> - a compute suspend and restart through the provider's API, on the same managed PostgreSQL 16.15.
>
> A cursor interrupted mid-iteration also exits the process.
>
> **Expected.** The app logs the error and keeps running. The pool discards the dead client and opens a new connection on the next query once the database is back, as the MongoDB adapter does.
>
> **Cause.** `packages/db-connect/adapters/postgres.js` creates `new Pool(...)` in three places without `pool.on('error', …)`: the main pool, the temporary admin pool used for `CREATE DATABASE`, and the reconnect pool. node-postgres documents that idle clients emit errors through the pool and that an error listener is required. Without one, Node treats the event as an unhandled `'error'` and exits. A checked-out cursor client (`_cursorClient`) has the same exposure while it is held between `FETCH` calls. #5604 fixed how that client is released, but no `'error'` listener is attached while it is held.
>
> **Reproduction (minimal).**
> 1. Start an Apostrophe 4.34.0 project with `APOS_DB_URI=postgres://user:pass@127.0.0.1:5432/db` and load a page, so the pool holds idle connections.
> 2. While the app is idle, run `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'db' AND pid <> pg_backend_pid();` from another session (or stop PostgreSQL with `pg_ctl stop -m immediate`).
> 3. The Node process exits with the stack above. This happened deterministically in every run.
>
> **Suggested fix.**
> - Attach `pool.on('error', (err) => { /* log via the adapter's logger */ })` to every pool `connect()` creates.
> - Attach a client `'error'` listener to the cursor's checked-out client for as long as it is held, and release the client with the error so the pool destroys it.
> - Add a test that terminates the backend connections and then runs a query.
>
> **Impact.** Availability only. No data loss was observed: PostgreSQL recovered via WAL, and the last acknowledged write survived. But any database restart, failover or idle-connection timeout kills every app process connected to that database at the same moment.
>
> We measured the workarounds:
> - With a process supervisor that restarts the app 2 s after an exit, the site served again 17–28 s after a drop or restart, and requests failed until then.
> - Two instances behind a health-checked proxy hid a drop of one instance's connections. They did not help when the database dropped all connections or restarted, because both instances exited together.
>
> So redundancy cannot mask this; only a fix in db-connect removes the outage.

## 3. Mitigation options

| Option | Supported? | Effect | Validation needed | Recommendation |
|---|---|---|---|---|
| **A. Process supervisor** with automatic restart (systemd `Restart=always` + `RestartSec=2`, Docker `restart: unless-stopped`, or the platform's equivalent) | Yes; no code | Recovers within startup time (seconds with a prebuilt release). Requests in flight fail; sessions survive (they are in the database) | Kill the database, confirm the app restarts and serves once the database is back | **Required** for any shared PostgreSQL environment until upstream fixes it |
| **B. Health checks** at the load balancer or orchestrator | Yes; a probe on `GET /` works today | Takes the instance out of rotation while it restarts; with ≥2 instances, no visible outage for the other instance's users | Same disconnect test, with two instances | Required with A. A lightweight database-checking health route is a separate small proposal, if `GET /` proves too heavy |
| **C. Upstream fix** (§2) | Yes, once released | Removes the crash | Re-run m1-010 D15b and the §4 test on the fixed release | File the issue; track releases |
| **D. Project-level listener** on `apos.dbClient._pool` from a project module | **No.** It relies on a private field, the cursor client is not covered, and it breaks silently if the internals change | Prevents the idle-client crash only | Full §4 test; re-check on every db-connect release | Not recommended. Consider only if C stalls and the owner accepts the maintenance risk |
| Global `uncaughtException` handler, or patching `node_modules` | Forbidden (m1-011 prompt) | — | — | Rejected |
| MongoDB fallback | Yes (ADR-0002) | Its driver reconnects | — | Stays the fallback if C does not land before staging |

## 4. Validation test (proposed follow-up task)

Gate: the owner approves a disposable PostgreSQL again. In m1-010 the binaries were unsigned EDB
zips, accepted for that test only. A container or WSL distribution would be preferable, if one
can be approved.

1. A fresh database, the app under a supervisor (A), two instances behind a local health-checked
   proxy (B).
2. `pg_terminate_backend` on all app connections while idle → record exit or no exit, restart
   time, failed requests.
3. `pg_ctl stop -m immediate`, then start after 30 s → the same measurements.
4. A long cursor iteration interrupted mid-way.
5. On an upstream release with the fix: repeat 2–4 **without** the supervisor; it must not exit.

**Script (m1-032, not run yet):** `node --env-file=.env scripts/pg-connection-drop-test.mjs
--database=<name> [--supervise] [--stop-cmd=… --start-cmd=…]` runs steps 2–4 against a
loopback PostgreSQL only. `--supervise` restarts the app 2 s after an exit, which stands in for
mitigation A. For step 5, run it without `--supervise`. Step 1's two instances and
health-checked proxy depend on the chosen platform (D-DB-7) and are not part of the script.

D-DB-5 closes only after step 5 passes on a released db-connect version, or the owner explicitly
accepts A+B as the permanent mitigation after steps 2–4 pass.
