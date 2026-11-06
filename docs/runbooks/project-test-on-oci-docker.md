# Runbook: Install and test the project on the owner's OCI server (Docker, MongoDB 8.0.x)

| | |
|---|---|
| **Status** | **Draft — not yet executed** (`m1-042`, 2026-11-06). Nothing in this runbook has been run. Mark a step verified only after it runs, with the date and task ID. |
| **Purpose** | A disposable copy of the project with demo content, to run the test suites and browser checks against MongoDB on Linux. It is **not** staging or production, and it does not change D-DB-2 or D-DB-7 (Hetzner stays the owner's preference). |
| **Owner direction** | m1-042: "add a md file for guides to install and test the project on my OCI server". |
| **Decisions** | D-DB-8 (MongoDB) · D-DB-9 (driver limit, MongoDB 8.2 at most) · D-DB-10 (Docker) · [hardening runbook](./server-hardening-and-patching.md) §12 choices 6 and 7 |

> **Safety rules**
> - **Get approval first.** Running this runbook needs the owner's approval of the `mongo:8.0.34`
>   and `node:24-bookworm` images on this server (D-DB-10). An agent also needs approval for its
>   SSH access.
> - **Demo data only.** No real content, no production copy, no personal data.
> - **Nothing public.** Open no OCI ingress rule for 27018 or 3042. Both services listen on the
>   server's loopback address only, and your PC reaches the site through an SSH tunnel.
> - **Never use `ports:` with this design.** Docker's published ports go around the server's
>   firewall rules. That is how the 9.0 container became reachable from the internet (m1-041).
> - **Secrets stay out of Git.** They live in `chmod 600` files on the server. Do not paste them
>   into reports or chat. Database dumps are secrets too.
> - **Leave everything else alone.** Do not change the MongoDB 9.0 container (D-DB-9) or the
>   server's other containers.

## 1. Design

```
 Your PC (Windows)                    OCI server (Ubuntu 22.04, aarch64)
 ┌───────────────────────┐            ┌──────────────────────────────────────┐
 │ Browser               │  SSH       │ sshd :22                             │
 │ http://localhost:3042 ├─ tunnel ──►│  └─► 127.0.0.1:3042                  │
 └───────────────────────┘            │       app container (node:24)        │
                                      │        └─► 127.0.0.1:27018           │
                                      │             mongodb (mongo:8.0.34)   │
                                      └──────────────────────────────────────┘
```

- **Host networking, no published ports.** Both containers use the server's own network, so
  Docker adds no public port rules. The app keeps its default `127.0.0.1` binding.
- **Port 27018**, because the 9.0 container may still hold 27017.
- **One-member replica set with access control**, as in the hardening runbook §6, because
  point-in-time recovery will need a replica set (D-DB-4).
- **`javascriptEnabled: false`** on from the start. The suites passing with it is the evidence
  for §12 choice 7.
- **8.0.34 or newer in the 8.0 line.** Versions before 8.0.30 have a critical flaw that can leave
  authorization off at startup (CVE-2026-82067). Before you start, check
  [MongoDB's 8.0 release notes](https://www.mongodb.com/docs/manual/release-notes/8.0/) and use
  the newest released patch.

**Not covered:** TLS, x.509, disk encryption, nginx, backups and point-in-time recovery, production
mode (`NODE_ENV=production`) and the hardening runbook in general. Those belong to the first
staging task.

## 2. Check the server

Connect with your own SSH login. The commands assume `root`, as in m1-041. Otherwise, add `sudo`
where needed.

```sh
uname -m                     # m1-041 found aarch64
docker --version
docker compose version
free -h                      # at least 4 GB available is advisable
df -h /var/lib/docker /opt   # at least 15 GB free is advisable
ss -ltnp | grep -E ':(27018|3042)\b'   # must print nothing
```

Stop here if a port is taken, or if the Compose plugin is missing.

## 3. Create the files

### 3.1 Directory, code and secrets

```sh
mkdir -p /opt/assurer-test
cd /opt/assurer-test
git clone --branch main https://github.com/mimnets/vcl-assurer-group.git repo
chown -R 1000:1000 repo

umask 077
openssl rand -base64 756 > keyfile
chown 999:999 keyfile        # the mongodb user in the image
chmod 400 keyfile

SITE_ADMIN_PW="$(openssl rand -hex 24)"
APP_PW="$(openssl rand -hex 24)"
TEST_ADMIN_PW="$(openssl rand -hex 16)"
TEST_EDITOR_PW="$(openssl rand -hex 16)"
printf '%s\n' "$SITE_ADMIN_PW" > site-admin-password.txt
printf '%s\n' "$TEST_ADMIN_PW" > test-admin-password.txt
printf '%s\n' "$TEST_EDITOR_PW" > test-editor-password.txt

cat > app.env <<EOF
APOS_DB_URI=mongodb://assurerApp:${APP_PW}@127.0.0.1:27018/assurer_test?replicaSet=rs0&authSource=assurer_test
APOS_SESSION_SECRET=$(openssl rand -hex 48)
PORT=3042
ADDRESS=127.0.0.1
APOS_DEMO_SITE=1
APOS_TEST_USER=oci-test-admin
APOS_TEST_PASSWORD=${TEST_ADMIN_PW}
BASE_URL=http://127.0.0.1:3042
EOF
chmod 600 app.env
```

Keep `APP_PW` in this shell for §4.2. If you open a new shell, read it back from `app.env`.

### 3.2 `mongod.conf`

Save as `/opt/assurer-test/mongod.conf`:

```yaml
storage:
  dbPath: /data/db
net:
  port: 27018
  bindIp: 127.0.0.1               # loopback only; §4.1 checks it
security:
  authorization: enabled
  keyFile: /etc/mongodb/keyfile
  javascriptEnabled: false        # §12 choice 7
replication:
  replSetName: rs0
```

### 3.3 `compose.yaml`

Save as `/opt/assurer-test/compose.yaml`:

```yaml
name: assurer-test

services:
  mongodb:
    image: mongo:8.0.34           # never "latest"
    network_mode: host            # no "ports:" section, on purpose
    restart: unless-stopped
    command: ["--config", "/etc/mongod.conf"]
    volumes:
      - mongo-data:/data/db
      - ./mongod.conf:/etc/mongod.conf:ro
      - ./keyfile:/etc/mongodb/keyfile:ro

  app:
    image: node:24-bookworm
    network_mode: host            # no "ports:" section, on purpose
    restart: unless-stopped
    user: "1000:1000"
    working_dir: /app
    env_file: app.env
    command: ["node", "app"]
    volumes:
      - ./repo:/app
    depends_on:
      - mongodb

volumes:
  mongo-data:
```

## 4. Start MongoDB

### 4.1 Start it and check that it is private

```sh
cd /opt/assurer-test
docker compose up -d mongodb
docker compose logs --tail 20 mongodb
ss -ltnp | grep 27018        # must show 127.0.0.1:27018, not 0.0.0.0 or *
```

**If it shows anything other than `127.0.0.1`, run `docker compose down` and stop.**

### 4.2 Create the replica set and the users

The first user is created through MongoDB's localhost exception, which closes as soon as that user
exists. `mongosh` runs inside the container and reads the commands from standard input, so the
passwords do not appear in the process list.

```sh
docker compose exec -T mongodb mongosh --port 27018 --quiet <<'EOF'
rs.initiate({ _id: "rs0", members: [ { _id: 0, host: "127.0.0.1:27018" } ] })
EOF

sleep 5

docker compose exec -T mongodb mongosh --port 27018 --quiet <<EOF
db.getSiblingDB("admin").createUser({
  user: "siteAdmin",
  pwd: "${SITE_ADMIN_PW}",
  roles: [ "userAdminAnyDatabase", "clusterAdmin" ]
})
db.getSiblingDB("admin").auth("siteAdmin", "${SITE_ADMIN_PW}")
db.getSiblingDB("assurer_test").createUser({
  user: "assurerApp",
  pwd: "${APP_PW}",
  roles: [ { role: "readWrite", db: "assurer_test" } ]
})
EOF
```

### 4.3 Check the version and access control

```sh
docker compose exec -T mongodb mongosh --port 27018 --quiet \
  --eval 'db.version()'                               # expect 8.0.34
docker compose exec -T mongodb mongosh --port 27018 --quiet \
  --eval 'db.adminCommand({ listDatabases: 1 })'      # expect an "Unauthorized" error
```

If `listDatabases` works without a login, access control is off. Run `docker compose down` and stop.

## 5. Install the project

```sh
cd /opt/assurer-test
docker compose run --rm app npm ci
docker compose run --rm app node app @apostrophecms/migration:migrate
docker compose run --rm app node app assurer-demo:seed

# The password goes through standard input, as in m1-033.
cat test-admin-password.txt | docker compose run --rm -T app \
  node app @apostrophecms/user:add oci-test-admin admin
cat test-editor-password.txt | docker compose run --rm -T app \
  node app @apostrophecms/user:add oci-test-editor editor

docker compose up -d app
docker compose logs --tail 40 app
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3042/   # expect 200
ss -ltnp | grep 3042                                              # must show 127.0.0.1:3042
```

The first start builds the assets, so it can take a few minutes on this server. In this mode the
app is a development run (`NODE_ENV` unset), which is enough for this test.

## 6. Run the suites

`npm run test:workflow` expects a `.env` file, so run its script directly. The values already come
from `app.env`.

```sh
cd /opt/assurer-test
docker compose exec app npm run lint
docker compose exec app npm run test:smoke
docker compose exec app node scripts/editor-workflow-test.mjs

docker compose restart app
sleep 60                     # wait until §5's curl returns 200 again
docker compose exec app node scripts/editor-workflow-test.mjs --verify-only
```

For comparison, on SQLite in m1-041: smoke 18/18, workflow 15/15, persistence 7/7. The counts can
change as the project grows, so what matters is that no check fails.

### Database restart test

D-DB-8 relies on MongoDB's driver reconnecting after a lost connection, unlike the PostgreSQL crash
in D-DB-5. No test has shown this on this project yet.

```sh
docker compose restart mongodb
sleep 20
docker compose ps app                                             # still "Up", not restarted
docker compose logs --since 2m app | tail -n 20
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3042/   # expect 200
```

### If a suite fails

1. Save the failing output without secrets, and record it as FAIL.
2. If the error mentions JavaScript or `$where`, set `javascriptEnabled: true`, run
   `docker compose restart mongodb`, and run the suites again. Record both results, because that
   decides §12 choice 7.
3. Do not change the project's code or dependencies during this test. A code fix is its own task.

## 7. Check it from your PC

### 7.1 Confirm nothing is public

In PowerShell on your PC. Both must report `TcpTestSucceeded : False`:

```powershell
Test-NetConnection <OCI server IP> -Port 27018
Test-NetConnection <OCI server IP> -Port 3042
```

Keep the address out of tracked files.

### 7.2 Browser checks

Open the tunnel in a separate terminal and leave it running:

```sh
ssh -N -L 127.0.0.1:3042:127.0.0.1:3042 <your SSH login>@<OCI server IP>
```

Then open `http://localhost:3042/` (AGENTS.md, browser acceptance). Use `oci-test-editor` for
editor checks, and only for those. Show the password on the server with
`cat /opt/assurer-test/test-editor-password.txt`, and do not put it in screenshots.

| # | Check | Role | Status | Actual result |
|---|---|---|---|---|
| 1 | Home page renders, with the "Demonstration site" notice and no horizontal overflow | logged out | NOT TESTED | |
| 2 | No admin bar or user data in the page | logged out | NOT TESTED | |
| 3 | Log in through the login form | editor | NOT TESTED | |
| 4 | Create a page, type text, and save a draft. The draft is not public | editor | NOT TESTED | |
| 5 | Publish the page. It appears logged out | editor | NOT TESTED | |
| 6 | Edit it and leave the edit unpublished. The public page stays unchanged | editor | NOT TESTED | |
| 7 | Upload an image and show it in the page | editor | NOT TESTED | |
| 8 | Search the pages manager for the new page's title (this uses MongoDB's `$text` search) | editor | NOT TESTED | |
| 9 | Submit the contact form | logged out | NOT TESTED | |

Record each result as PASS, FAIL, BLOCKED or NOT TESTED. Agent runs are agent-executed, not human
approval.

## 8. Record the results

| Item | Result |
|---|---|
| Date, task ID and who ran it | |
| Server: OS, CPU, Docker and Compose versions | |
| MongoDB version and image digest | |
| Node version in the app container | |
| Lint, smoke, workflow, persistence | |
| Database restart test | |
| `javascriptEnabled: false` kept on? | |
| Ports 27018 and 3042 private (§4.1, §5, §7.1) | |
| Browser checks (§7.2) | |
| Anything skipped or left over | |

Once a task has run this, update the Status line at the top and mark the verified steps. Propose
the §12 choice 6 and 7 results to the owner. The test result does not decide them.

## 9. Clean up

1. Archive the test page and `oci-test-editor` through the Apostrophe UI, while the site is up.
2. Close the SSH tunnel with Ctrl+C.
3. Stop the containers. The database volume and files stay:

   ```sh
   cd /opt/assurer-test
   docker compose down
   ```

4. Deleting the database needs the owner's approval, because it cannot be undone:
   `docker compose down -v` removes the volume, and removing `/opt/assurer-test` removes the
   secrets and code. This data is demo content only, so no backup is needed unless you want one.
5. If an agent had SSH access, remove its key line from `/root/.ssh/authorized_keys` when it no
   longer needs access.

## 10. Rules for later

- This server's data never becomes staging or production data (D-CONTENT-16, option A).
- Keep the Docker images patched while this stays running: check MongoDB's security alerts, change
  the image tag, then run `docker compose pull` and `docker compose up -d`. Stay within the 8.0
  line unless the owner approves a change (D-DB-9).
- If you later want the Docker setup for staging, that needs its own task and an update to the
  hardening runbook, which assumes systemd today.
