# Runbook: Disposable PostgreSQL 16 on the owner's OCI server (Docker), for development and the D-DB-5 test

| | |
|---|---|
| **Status** | **Draft — not yet executed** (`m1-033`, 2026-11-02). **Not chosen:** the owner picked [Neon](./postgresql-dev-on-neon.md) for the m1-033 test; this runbook stays as a fallback. Its §5 `psql` note is out of date: since m1-033 the test script runs its admin SQL through `pg` and needs no local `psql`. Nothing in this runbook has been run. Each step is marked verified only after it runs, with the date and task ID. |
| **Purpose** | A disposable PostgreSQL 16 server for development and for the D-DB-5 connection-drop test ([proposal](../milestones/m1-d-db-5-postgresql-connection-loss-proposal.md) §4, [`scripts/pg-connection-drop-test.mjs`](../../scripts/pg-connection-drop-test.mjs)). It is **not** staging or production and it **does not decide D-DB-2** (managed provider and region). |
| **Owner direction** | m1-033: "use Docker with PostgreSQL 16 on my OCI server" (see the [m1-033 prompt](../engineering/prompts/2026/11/2026-11-02-m1-033-pg-connection-drop.prompt.md)). |
| **Decisions** | [ADR-0002](../architecture/decisions/ADR-0002-database-strategy.md) · D-DB-5 · D-DB-6 (Option B: PostgreSQL for development and CI only) |

> **Safety rules**
> - **Demo data only.** No real content (D-CONTENT-16), no production copy, no personal data.
>   Fill the database with `node app assurer-demo:seed` and a disposable test user.
> - **Never expose port 5432 to the internet.** The container listens on the server's loopback
>   only, and your PC reaches it through an SSH tunnel. Do not add an OCI ingress rule for 5432.
> - **Secrets stay out of Git.** Passwords live in a `chmod 600` file on the server and in your
>   git-ignored `.env`. Database dumps are secrets (see the
>   [backup and restore runbook](./database-backup-and-restore.md)).
> - **Restore only into a new, empty database.** `pg_restore --clean` and `apos-db-restore`
>   delete data in the target.
> - Pointing the app at this server is a non-local database (AGENTS.md). The owner approves it
>   for m1-033, for this disposable server only.

## 1. Design

```
 Your PC (Windows)                                    OCI compute instance (Linux)
 ┌──────────────────────────────┐                     ┌─────────────────────────────────────┐
 │ node app (127.0.0.1:3000)    │                     │ sshd :22  (only open ingress port)  │
 │ APOS_DB_URI=postgres://...   │   SSH tunnel        │   │                                 │
 │   @127.0.0.1:15432/...  ─────┼──── port 22 ───────►│   └─► 127.0.0.1:5432                │
 │                              │  (encrypted)        │        └─ Docker: postgres:16       │
 │ public/uploads (local media) │                     │           volume pg16-data          │
 └──────────────────────────────┘                     └─────────────────────────────────────┘
```

Why this shape:

- **SSH tunnel, not an open port.** Docker writes its own iptables rules, and a port published as
  `-p 5432:5432` bypasses `ufw` and `firewalld`. Publishing on `127.0.0.1` only, and connecting
  over SSH, keeps PostgreSQL off the internet without TLS certificates or IP allow-lists.
- **The app sees a loopback host.** `scripts/pg-connection-drop-test.mjs` refuses any host that
  is not `127.0.0.1`, `localhost` or `[::1]`. With the tunnel the URI host is `127.0.0.1`, so the
  safety check stays as it is.
- **Debian-based official image** (`postgres:16`, multi-architecture, so it also runs on Ampere
  A1 shapes). It uses glibc collations like the managed services on the D-DB-2 shortlist. Alpine
  uses musl, which sorts text differently.
- **Media stays local.** Uploads are still written to `public/uploads` on your PC. A database
  and its media are a pair, so keep them together when you export (§6).

## 2. Inputs you need (owner)

| Input | Example | Notes |
|---|---|---|
| SSH host alias for the server | `oci-dev` | In `~/.ssh/config` (§4.1) |
| Server OS and CPU architecture | Ubuntu 22.04 or Oracle Linux 8/9; `x86_64` or `aarch64` | Both work with `postgres:16` |
| OCI region | — | Only demo data goes here, but record it in the m1-033 report |
| Free disk | ≥ 5 GB | A demo database is a few MB; the image is about 450 MB |
| Docker Engine with the Compose plugin | `docker compose version` | Installing Docker on the server is your action, on your server |

## 3. Server setup (on the OCI instance)

### 3.1 Check Docker

```sh
docker --version
docker compose version
```

If Docker is not installed, follow Docker's official instructions for your OS
(<https://docs.docker.com/engine/install/>). Do not use a distribution's `docker.io` snap.

### 3.2 Create the project directory and secrets

```sh
sudo mkdir -p /opt/assurer-pg16
sudo chown "$USER": /opt/assurer-pg16
cd /opt/assurer-pg16
umask 077
# Superuser password (admin only) and app-role password, each 48 hex characters
printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > .env
printf '%s\n' "$(openssl rand -hex 24)" > app-password.txt
chmod 600 .env app-password.txt
```

### 3.3 `compose.yaml`

Save as `/opt/assurer-pg16/compose.yaml`:

```yaml
services:
  postgres:
    image: postgres:16            # pin a digest after the first pull (§3.4)
    container_name: assurer-pg16
    restart: unless-stopped
    env_file: .env                # POSTGRES_PASSWORD only
    environment:
      POSTGRES_USER: postgres
      POSTGRES_DB: postgres
    ports:
      - "127.0.0.1:5432:5432"     # loopback only. Never "5432:5432"
    volumes:
      - pg16-data:/var/lib/postgresql/data
    shm_size: 256mb
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pg16-data:
```

### 3.4 Start it and record the version

```sh
docker compose up -d
docker compose ps                                          # STATUS shows "healthy"
docker exec assurer-pg16 psql -U postgres -Atc 'SELECT version()'
docker image inspect postgres:16 --format '{{index .RepoDigests 0}}'
```

Record the `version()` line and the image digest in the m1-033 report. To pin the image, replace
`image: postgres:16` with `image: postgres@sha256:<digest>`. Otherwise a later pull can move to a
newer 16.x minor version.

### 3.5 Check that 5432 is not public

```sh
sudo ss -ltnp | grep 5432          # must show 127.0.0.1:5432, not 0.0.0.0:5432
```

In the OCI console, the subnet's security list or the network security group must have **no**
ingress rule for TCP 5432. Port 22 should be limited to your own public IP if you can.

### 3.6 Create the application role and database

Apostrophe needs an ordinary role that owns its database. It does not need superuser rights.
One database per purpose; the name is an example.

```sh
APP_PW="$(cat /opt/assurer-pg16/app-password.txt)"
docker exec -i assurer-pg16 psql -U postgres -v ON_ERROR_STOP=1 -v pw="$APP_PW" <<'SQL'
CREATE ROLE assurer_dev LOGIN PASSWORD :'pw';
CREATE DATABASE assurer_m1033 OWNER assurer_dev ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE assurer_m1033 FROM PUBLIC;
SQL
```

The app role can terminate its **own** connections with `pg_terminate_backend`, which is all the
D-DB-5 test needs. The `postgres` superuser is for administration only. Do not use it in
`APOS_DB_URI`.

## 4. Connect your local development app

### 4.1 SSH config (Windows 11 has OpenSSH built in)

In `C:\Users\<you>\.ssh\config`:

```
Host oci-dev
    HostName <server public IP or DNS name>
    User <ssh user, e.g. ubuntu or opc>
    IdentityFile ~/.ssh/<your OCI key>
    ServerAliveInterval 30
    ServerAliveCountMax 3
    ExitOnForwardFailure yes
```

### 4.2 Open the tunnel

In a separate terminal, leave this running:

```sh
ssh -N -L 127.0.0.1:15432:127.0.0.1:5432 oci-dev
```

Local port `15432` avoids a clash with any PostgreSQL on your PC. Close the tunnel with Ctrl+C.

> **The tunnel is also a D-DB-5 trigger.** If the tunnel drops (the PC sleeps, Wi-Fi changes,
> the server restarts), PostgreSQL connections are cut and the app process exits. That is the
> D-DB-5 defect, not a tunnel fault. `nodemon` then waits for a file change: reopen the tunnel
> and type `rs` in the `npm run dev` terminal.

### 4.3 Point the app at it

In your git-ignored `.env`, comment out the SQLite line and add the PostgreSQL one. Use the
password from `app-password.txt` on the server (`ssh oci-dev cat /opt/assurer-pg16/app-password.txt`):

```sh
# APOS_DB_URI=sqlite://./data/vcl-assurer-group.db
APOS_DB_URI=postgres://assurer_dev:<app password>@127.0.0.1:15432/assurer_m1033
```

`dotenv` does not override variables that are already set, so you can also set
`$env:APOS_DB_URI = '...'` for one PowerShell session instead of editing `.env`.

### 4.4 First start on the empty database

```sh
node app @apostrophecms/migration:migrate
node app assurer-demo:seed
node app @apostrophecms/user:add <disposable admin name> admin
npm run dev
```

Then run the suites from AGENTS.md (`npm run lint`, `test:smoke`, `test:workflow`,
`test:persistence`). The test credentials in `.env` must belong to a user in **this** database.

### 4.5 Switch back to SQLite

Restore the SQLite `APOS_DB_URI` line in `.env` and restart. The two databases are independent.
Uploads made while you were on PostgreSQL stay in `public/uploads`, and the SQLite database does
not reference them.

## 5. Run the D-DB-5 connection-drop test (m1-033)

The script runs admin SQL with `psql` on your PC, and `psql` is **not installed** there
(checked 2026-11-02). It needs one of these, each with owner approval:

- **(a, recommended)** PostgreSQL 16 client tools on Windows (`psql`, `pg_dump`, `pg_restore`).
  This is a new local tool and needs approval (AGENTS.md).
- **(b)** A small change to the script so that it can run admin SQL through
  `ssh oci-dev docker exec assurer-pg16 psql ...`. That is a code change, outside the approved
  m1-033 scope.

With (a), and the tunnel open:

```sh
# Password for psql: %APPDATA%\postgresql\pgpass.conf, one line:
#   127.0.0.1:15432:assurer_m1033:assurer_dev:<app password>

# Run 1, without a supervisor: expected FAIL while db-connect 1.1.0 is unfixed
node --env-file=.env scripts/pg-connection-drop-test.mjs --database=assurer_m1033

# Run 2, with a supervisor (mitigation A), including a server restart
node --env-file=.env scripts/pg-connection-drop-test.mjs --database=assurer_m1033 --supervise ^
  --stop-cmd="ssh oci-dev docker stop --time 0 assurer-pg16" ^
  --start-cmd="ssh oci-dev docker start assurer-pg16"
```

- `docker stop --time 0` stops the server at once, without a clean shutdown. That is as abrupt
  as `pg_ctl stop -m immediate` in proposal §4 step 3, and PostgreSQL recovers from its WAL on
  the next start. Because `docker stop` counts as a manual stop, the `unless-stopped` policy does
  not restart the container, so the 30 s outage really happens. The start command brings it back.
- `^` continues a line in `cmd`. In PowerShell, use a backtick or keep the command on one line.
- Then run the sanitize task against the same database (D-DB-6):
  `node app assurer-security:sanitize-after-restore` (dry run), then
  `node app assurer-security:sanitize-after-restore --execute --database=assurer_m1033`.

What this run covers, and what it does not:

- **Covered:** proposal §4 steps 2–4 against PostgreSQL 16 on Linux, over a real network path.
- **Not covered:** step 1's two instances behind a health-checked proxy (that depends on D-DB-7),
  and step 5 (it needs a fixed db-connect release).
- **D-DB-6 Linux repeat test: only in part.** The database server runs on Linux, but the app
  still runs on Windows. The provider's managed PostgreSQL may also behave differently.
  Record this as a partial result, not as the closed blocker.

## 6. Export and import later

There are two formats. Choose by where the data is going.

| Destination | Format | Tool | Why |
|---|---|---|---|
| Another PostgreSQL (the D-DB-2 managed service, another server, a newer major version) | PostgreSQL custom dump (`.pgdump`) | `pg_dump -Fc` / `pg_restore` | Exact copy of tables and indexes. Fast. Works across major versions upward (16 → 17) |
| Any engine Apostrophe supports (PostgreSQL, SQLite, MongoDB) | Apostrophe JSONL (`.jsonl`) | `npx apos-db-dump` / `npx apos-db-restore` (part of `@apostrophecms/db-connect`, already installed) | Engine-neutral, the official Apostrophe tool. Use it to move between engines or back to local SQLite |

Both files contain password hashes and possibly personal data. Keep them in `backups/`
(git-ignored), or encrypted, and never in chat or tickets.

### 6.1 Export: PostgreSQL format (no local tools needed)

Running `pg_dump` inside the container means the client version always matches the server.

```sh
# Stop the app first, so the dump matches the media snapshot
ssh oci-dev "docker exec assurer-pg16 pg_dump -U postgres -Fc assurer_m1033" > backups/2026-11-02-assurer_m1033.pgdump
tar -czf backups/2026-11-02-uploads.tgz public/uploads
```

Use `cmd` or Git Bash for the redirect. In Windows PowerShell 5.1, `>` re-encodes the bytes and
corrupts a binary dump. In PowerShell, write the file on the server and copy it with `scp`
instead:

```sh
ssh oci-dev "docker exec assurer-pg16 pg_dump -U postgres -Fc -f /tmp/assurer_m1033.pgdump assurer_m1033 && docker cp assurer-pg16:/tmp/assurer_m1033.pgdump /tmp/ && docker exec assurer-pg16 rm /tmp/assurer_m1033.pgdump"
scp oci-dev:/tmp/assurer_m1033.pgdump backups/2026-11-02-assurer_m1033.pgdump
ssh oci-dev "rm /tmp/assurer_m1033.pgdump"
```

### 6.2 Export: Apostrophe JSONL (portable)

With the tunnel open:

```sh
npx apos-db-dump "postgres://assurer_dev:<app password>@127.0.0.1:15432/assurer_m1033" --output=backups/2026-11-02-assurer_m1033.jsonl
```

### 6.3 Import into another PostgreSQL

Always restore into a **new, empty** database owned by that environment's own app role:

```sh
# Target is a managed service: TLS on, own credentials, never this server's passwords
pg_restore --no-owner --no-privileges --role=<target app role> \
  -d "postgres://<target admin>@<target host>:5432/<new empty db>?sslmode=require" \
  backups/<date>-assurer_m1033.pgdump
```

`--no-owner --no-privileges` drops this server's role names (`assurer_dev`), so the target's
own role owns the objects.

### 6.4 Import into any engine (JSONL)

```sh
npx apos-db-restore "<target APOS_DB_URI, new empty database>" --input=backups/<date>-assurer_m1033.jsonl
```

### 6.5 After every import

Run these against the **new** database, with the app stopped
([backup and restore runbook](./database-backup-and-restore.md) §B, §F):

```sh
node app @apostrophecms/migration:migrate                                         # rebuilds search
node app assurer-security:sanitize-after-restore                                  # dry run
node app assurer-security:sanitize-after-restore --execute --database=<name>      # removes sessions and tokens
```

Then restore the matching `uploads.tgz` (or copy it to the target's media store, D-DB-3), give
the target its own `APOS_SESSION_SECRET`, and run the smoke and workflow tests.

### 6.6 Rules for later

- **This server's data never becomes staging or production data.** Staging and production are
  built from the CA-5 entry on the target site (D-CONTENT-16, option A), not from a dev dump.
- Do not copy volume files (`/var/lib/postgresql/data`) between servers or major versions. Use
  §6.1–§6.4.
- Do not copy your local SQLite development database into this server unless the owner approves
  it. It holds test users and the unpublished privacy-notice draft. A fresh database plus
  `assurer-demo:seed` is enough for the D-DB-5 test.

## 7. Clean up after the test

```sh
docker compose -f /opt/assurer-pg16/compose.yaml down       # stops it; the volume and data stay
```

`docker compose down -v` deletes the volume and every database in it. That cannot be undone, so
it needs the owner's approval and an export first (§6). Remove the disposable test user through
the Apostrophe UI or the REST API while the database is still running (AGENTS.md rule 11).
