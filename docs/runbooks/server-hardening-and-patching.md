# Runbook: server hardening and patching (Hetzner Cloud, self-hosted MongoDB)

| | |
|---|---|
| **Status** | **Draft, not yet executed** (`m1-039`, 2026-11-04). No server, account or bucket exists. Nothing in this runbook approves an account, spending, a tool install or a provider choice. §12 choices 1–5 and 8 answered by the owner (`m1-040`, 2026-11-04); 6 and 7 answered by the owner (`m1-044`, 2026-11-06). **§6 and §7 rewritten for one container (D-DB-10 (b)) in `m1-055`**, with nginx and certbot in their own containers (§8); the staging images were built and run on the owner's PC only ([staging container runbook](./staging-container.md)) |
| **Task** | [m1-039 report](../engineering/reports/2026/11/2026-11-04-m1-039-hardening-runbook.report.md) · [m1-040 report](../engineering/reports/2026/11/2026-11-04-m1-040-hardening-choices.report.md) (§12 answers) · [m1-044 report](../engineering/reports/2026/11/2026-11-06-m1-044-mongodb-decisions.report.md) (§12 choices 6 and 7, D-DB-10 (b)) |
| **Applies to** | The owner's preferred stack ([hosting options paper](../milestones/m1-031-hosting-options.md) §10): one Hetzner Cloud server per site in Singapore, Ubuntu LTS, MongoDB Community Server (D-DB-8), the Node app under systemd behind a TLS proxy, media on the server disk with a nightly copy to a versioned EU bucket |
| **Waits for** | D-DB-2, D-DB-3 and D-DB-7 (DPO input I1) |
| **Related** | [ADR-0002](../architecture/decisions/ADR-0002-database-strategy.md) · [deployment principles](./deployment-principles.md) · [HTTP security and HTTPS proxy](./security-configuration.md) · [backup protection plan](./backup-protection-plan.md) · [backup and restore](./database-backup-and-restore.md) · D-DB-4 · D-DB-8 |
| **Facts as of** | 2026-11-04, from vendor documentation (sources in §13). Re-check versions before use |

Each step that installs software (MongoDB, Node.js, the TLS proxy, the backup tool, the media
copy tool) needs its own approval, license check and advisory check (AGENTS.md). Staging and
production are **separate servers** with their own database, media, secrets and backup
credentials. Never copy one site's database into another.

## 1. Target layout (one server per site)

| Component | Listens on | Reachable from |
|---|---|---|
| TLS proxy (nginx container, §12 choice 3, §8) | `0.0.0.0:80`, `0.0.0.0:443` (and IPv6) | the internet |
| SSH | `22` | admin addresses only (§3) |
| Node app, in the site container (§7) | port `3000` on the Compose network only; no host port | the nginx container only |
| `mongod`, in the site container (§6) | `127.0.0.1:27017` inside the container | the app and `pbm-agent` in the same container |
| Media | the `uploads` Docker volume, on the encrypted data area (§5, §7) | the app; nightly copy to the EU bucket |
| Backup tool (PBM, in the site container) | outbound only, once the S3 storage is approved | sends to the backup target (§9) |

If MongoDB ever moves to its own server, bind it to the **private network address** as well, and
add the host firewall rule in §3. The Hetzner Cloud Firewall does not filter private networks.

## 2. Accounts and access

1. Use a separate Hetzner Cloud **project** for each site (staging, production). Turn on
   two-factor authentication for every Hetzner login. Give each person their own login; do not
   share one account.
2. Hetzner API tokens: none unless a task needs one, read-only where possible, stored only in the
   secret store, revoked after use.
3. SSH: key-based only. Each admin has a named account in the `sudo` group. In
   `/etc/ssh/sshd_config.d/10-hardening.conf`:

   ```
   PermitRootLogin no
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   ```

   Keep one working session open while you reload `sshd`, and test a new login before you close
   it. The Hetzner web console is the break-glass path.
4. Service accounts with no login shell: `assurer` (the app) and `mongodb` (created by the
   MongoDB package). Only the app account can read the app's secrets.

## 3. Network

**Hetzner Cloud Firewall** (stateful, free; with no rules it blocks all inbound and allows all
outbound [1][2]). Inbound rules:

| Port | Source | Why |
|---|---|---|
| TCP 22 | the admins' fixed addresses only (§12 choice 5, decided) | SSH |
| TCP 80 | any | ACME HTTP challenge and redirect to HTTPS |
| TCP 443 | any | the site |

Nothing else. **Never** open 27017 or 3000.

**Host firewall** (`ufw`, part of Ubuntu): default deny inbound, allow 22, 80 and 443. It also
covers the private network, which the Hetzner firewall does not filter [2].

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

Check (§11, V1–V3): `sudo ss -tlnp` lists 27017 and 3000 only on `127.0.0.1`. From an outside
machine, ports 27017, 3000 and 22 (from a non-admin address) do not connect.

## 4. Operating system baseline

1. **Ubuntu Server 24.04 LTS** from Hetzner's image. MongoDB 8.x and 9.x support it on x86_64 [5].
2. Time: UTC, synchronised by `systemd-timesyncd` (default). MongoDB needs synchronised clocks
   [4].
3. **Security updates are automatic.** `unattended-upgrades` is installed and enabled by default
   and applies security updates [3]. Check `/etc/apt/apt.conf.d/20auto-upgrades` and keep it on.
4. **Reboots.** Some updates (kernel, libc) take effect only after a reboot. Either set an
   automatic reboot window in `/etc/apt/apt.conf.d/50unattended-upgrades` [3]:

   ```
   Unattended-Upgrade::Automatic-Reboot "true";
   Unattended-Upgrade::Automatic-Reboot-Time "03:30";
   ```

   or reboot by hand each week when `/var/run/reboot-required` exists. On a single server a reboot
   is a short outage. The choice depends on disk encryption (§5, §12 choice 1).
   **Decided (§12 choice 4, m1-040): weekly manual reboot**, announced in advance, because the
   data volume (§5, option B) needs unlocking after each reboot. Leave `Automatic-Reboot` off.
5. Remove or disable services that are not needed. Persistent `journald` with a size cap
   (`SystemMaxUse=1G` in `/etc/systemd/journald.conf.d/size.conf`).
6. MongoDB host settings [4]: data on **XFS** (strongly recommended for WiredTiger),
   `vm.swappiness = 1`, open-files limit at least 64000 (the package's systemd unit sets it),
   transparent huge pages **enabled** for MongoDB 8.0 and later, `noatime` on the data volume.
   If antivirus or EDR software is ever installed, exclude the MongoDB data and log paths [6].
7. **Kernel (m1-058, D-DB-16, not decided).** MongoDB 8.0 refuses to start on Linux kernels 6.19 to
   7.0.13. Check `uname -r` before the first start and before each reboot onto a new kernel, and do not
   move to a newer kernel series without checking it against MongoDB's production notes. Not yet tested
   on a server.

## 5. Disk encryption (data at rest)

MongoDB Community has no encryption at rest; MongoDB's checklist asks for file-system or device
encryption instead [6]. No Hetzner-provided disk encryption option was found in m1-039. The
community-reported options are LUKS, set up from an ISO image, with the passphrase typed into the
Hetzner web console at boot or over SSH through `dropbear-initramfs` [7] (community sources, not
Hetzner documentation; not tested).

| Option | What is encrypted | After a reboot | Effect |
|---|---|---|---|
| **A. Full-disk LUKS** | everything | someone types the passphrase (console or dropbear) | automatic reboots stop the site until unlocked |
| **B. LUKS data volume** | a Hetzner Volume or partition holding the MongoDB data, media, local backups and the app's `.env` | someone unlocks the volume; the OS and SSH come up alone | same, but the unlock is a normal SSH session |
| **C. No disk encryption** | nothing | nothing to do | does not meet MongoDB's checklist; needs an owner risk acceptance |

Encryption at rest protects disks, snapshots and images taken out of the server. It does not
protect a running, compromised server. Hetzner Backups and snapshots of an encrypted disk contain
only ciphertext, so they are useless without the passphrase. The passphrase lives in the secret
store, never on the server.

**Decided 2026-11-04 (m1-040, owner, §12 choice 1): B**, with manual reboots announced in
advance, because the RTO (D-DB-4, ≤ 4 h) allows a manual unlock and the OS stays reachable for
patching. The LUKS setup is still untested; the first staging task tries it.

## 6. MongoDB (inside the site container)

> **Rewritten for one container in `m1-055`** (D-DB-10 (b)). MongoDB is not installed from apt: it
> runs in the staging site container, built from the [staging container runbook](./staging-container.md).
> Decided (§12 choice 6, m1-044): **MongoDB 8.0.x**, at 8.0.34 or newer, from the pinned
> `mongo:8.0.34` base image.

The settings are in [`docker/staging/mongod.conf`](../../docker/staging/mongod.conf). What they do,
and where each one comes from:

| Setting | Value | Why |
|---|---|---|
| `net.bindIp` | `127.0.0.1` | Only processes in the container reach MongoDB. Compose publishes no MongoDB port, and the site container publishes none at all (§1) |
| `net.tls.mode` | `requireTLS`, with a private CA | Hardening checklist [6]; decided in m1-055 for loopback too. Clients that do not use TLS are refused |
| `net.tls.allowConnectionsWithoutCertificates` | `true` | Clients log in with a password (SCRAM); no client certificates |
| `security.authorization` | `enabled` | Every client logs in [6] |
| `security.keyFile`, `clusterAuthMode: keyFile` | random key file | Member authentication: a key file is acceptable on staging; **production needs x.509** (§12 choice 2) |
| `security.javascriptEnabled` | `false` | §12 choice 7 (m1-044) |
| `replication.replSetName` | `rs0`, one member | Needed for point-in-time recovery (D-DB-4) |
| WiredTiger cache | `ASSURER_MONGO_CACHE_GB`, default 1 GB | The app shares the container's memory (m1-054 results §3) |

What the entrypoint ([`docker/staging/entrypoint.sh`](../../docker/staging/entrypoint.sh)) does on
the first start, following MongoDB's replica set tutorial [8] and security checklist [6]:

1. Creates the random secrets in the `secrets` volume: the key file, the database user passwords
   and the session secret. Directory mode `0711`, files `0600` or `0400`, owner `root` (the key file
   and the server certificate are owned by `mongodb`).
2. Creates a private CA and a server certificate for `127.0.0.1` and `localhost`, and **deletes the
   CA key** once the certificate is signed, so nothing on the server can sign another one. When the
   server certificate has less than 30 days left (it lasts 825 days), the next start makes a new CA
   and certificate; a regular image update restarts the container well before that.
3. Starts `mongod`, runs `rs.initiate()` with one member, and at once creates the user administrator
   through the localhost exception, which closes once that user exists.
4. Creates one user per purpose, least privilege [6]:

   | User | Roles | Used by |
   |---|---|---|
   | `siteAdmin` (break-glass) | `userAdminAnyDatabase`, `clusterAdmin` | the entrypoint, and admins by hand |
   | `assurerApp` | `readWrite` on the `assurer` database only | the app |
   | `pbm` | `backup`, `restore`, `clusterMonitor`, `readWrite` on `admin`, and `pbmAnyAction` (`anyAction`) | `pbm-agent` and the backup schedule. Far more than the `backup` role first planned; accepted by the owner (D-DB-12) |

5. Builds the app's connection string from the secrets at each start, in the app's environment only:
   `mongodb://assurerApp:<secret>@127.0.0.1:27017/assurer?replicaSet=rs0&authSource=assurer&tls=true&tlsCAFile=/data/secrets/tls/ca.pem`.
   It is never written to a file, a log or Git.

MongoDB writes its log to the container's standard output, which Docker keeps. Set a size cap for
the json-file log driver in `/etc/docker/daemon.json` (`"log-opts": {"max-size": "50m", "max-file": "5"}`).

Ongoing [6]: watch MongoDB's security alerts and end-of-life dates, update the pinned base image for
patch releases (§10), review the network rules, and rotate the database user passwords (staging
container runbook §6).

## 7. The containers (Docker Compose)

> **Rewritten for one container in `m1-055`** (D-DB-10 (b)); the systemd unit that was here is gone.
> The steps are in the [staging container runbook](./staging-container.md).

1. **Docker Engine** from Docker's official apt repository, with the Compose plugin. Installing it
   on the server is a tool approval. Put Docker's data directory (`"data-root"` in
   `/etc/docker/daemon.json`) on the encrypted data volume (§5, option B), so the volumes holding
   the database, media, secrets and local backups are encrypted at rest.
2. **Three long-running containers** from [`docker/staging/compose.yaml`](../../docker/staging/compose.yaml):

   | Container | Holds | Ports on the host |
   |---|---|---|
   | `site` | the Apostrophe app (2 web processes by default, `APOS_CLUSTER_PROCESSES`), MongoDB, `pbm-agent` and the base-backup schedule | none |
   | `nginx` | the TLS proxy (§8) | `80`, `443` |
   | `certbot` | certificate renewal, twice a day when due | none |

   A one-off `cert-bootstrap` container writes a short-lived self-signed certificate before the
   first real one exists.
3. **Restart:** `restart: unless-stopped` on all three. Inside the site container, Apostrophe's
   primary process restarts a web process that exits; the container stops if the primary or
   `mongod` stops, and Docker starts it again (R6, options paper §2). `pbm-agent` is restarted by
   the entrypoint without stopping the site.
4. **Users inside the site container:** the app runs as `assurer`, MongoDB as `mongodb`, `pbm-agent`
   as `pbm`. Only `root` reads the secrets; the app and `pbm-agent` get their credentials in their
   own environment only.
5. **Settings:** `APOS_BASE_URL` and `ASSURER_DOMAIN` in the shell or Compose's `.env` file next to
   `compose.yaml`; everything else that is per site (SMTP, form notification addresses) in
   `docker/staging/site.env`, owner `root`, mode `0600`, never in Git. The Compose file already sets
   `APOS_HTTPS=1`, `APOS_TRUST_PROXY` (nginx's fixed address) and `APOS_HSTS_MAX_AGE=300`
   ([security-configuration.md](./security-configuration.md)). `APOS_DEMO_SITE` is `0` in the
   image. `APOS_ALLOW_INDEXING=1` on production only.
6. **Releases:** build the images from a tagged commit, then `docker compose up -d`. Compose
   recreates only the containers whose image changed. The entrypoint runs the migrations before the
   app starts ([deployment principles](./deployment-principles.md)). Take a PBM base backup first
   ([PBM runbook](./pbm-backup-and-restore.md) §2).

## 8. TLS proxy

**nginx** (§12 choice 3, decided in m1-040). Installing it needs a tool approval. nginx does not
renew certificates by itself: requirement 1 needs an ACME client as well (for example certbot),
which is a separate tool approval with the license and advisory check. The proxy must:

1. Redirect HTTP to HTTPS, serve TLS 1.2 or later, and renew Let's Encrypt (ACME) certificates
   automatically.
2. Proxy to `127.0.0.1:3000` and set `X-Forwarded-For` and `X-Forwarded-Proto` as described in
   [security-configuration.md](./security-configuration.md#behind-an-https-reverse-proxy-staging-and-production).
3. Limit request body size to the app's upload limit, and rate-limit floods (the app's own form
   limit is per client and does not stop floods).
4. Start HSTS short (`APOS_HSTS_MAX_AGE=300`) and raise it once confirmed.

**m1-055:** nginx 1.30.6 and certbot 5.9.0 run in their own containers, from the official images
with digests pinned (approved by the owner in m1-055). The configuration is
[`docker/staging/nginx/assurer.conf.template`](../../docker/staging/nginx/assurer.conf.template):
point 1 by the port 80 redirect, TLS 1.2 and 1.3, certbot's webroot renewal and a reload every
6 hours; point 2 by proxying to the site container on the Compose network, with `APOS_TRUST_PROXY`
set to nginx's fixed address only; point 3 by `client_max_body_size 32m` (Apostrophe sets no upload
limit of its own) and `limit_req` at 30 requests a second per address with a burst of 60, both
adjustable. Requests for any other host name are refused. First certificate and checks:
[staging container runbook](./staging-container.md) §3.

## 9. Backups and media copy

- **Database:** a continuous backup tool against the one-member replica set, for 7-day PITR and a
  15-minute RPO (D-DB-4). **Direction: Percona Backup for MongoDB, subject to a local proof of
  concept (D-DB-12, m1-045; [options paper](../milestones/m1-045-backup-tool-options.md)).** No install
  is approved. The backup account (`assurerBackup`) and the target's
  credentials are separate from the app's (backup protection plan §2).
  **m1-055:** PBM 2.17.0 is in the staging image, with a daily base backup and 8 days kept, to a
  local volume until the S3 storage is approved: [PBM runbook](./pbm-backup-and-restore.md). The
  backup account is `pbm`, not `assurerBackup` (§6).
- **Portable exports:** encrypted `apos-db-dump` at each release and monthly, 12 kept (D-DB-4),
  per the [backup and restore runbook](./database-backup-and-restore.md).
- **Hetzner Backups** (daily server images) are crash-consistent. They are a server rebuild aid,
  not the database backup.
- **Media:** nightly copy of `uploads/` to a Hetzner Object Storage bucket in the EU, with
  versioning and object lock (D-DB-3, waits for the DPO). The copy tool needs approval. Its
  credentials can write and must not delete.
- First restore drill on staging before CA-5 content entry; then quarterly (D-DB-4).

## 10. Patching and review cadence

| When | What | Who |
|---|---|---|
| Daily (automatic) | Ubuntu security updates (`unattended-upgrades`); check `/var/log/unattended-upgrades/` weekly | ops |
| Weekly | reboot if `/var/run/reboot-required` exists (unless automatic, §4); certificate expiry; disk space; backup job status | ops |
| Monthly | MongoDB and Node.js patch releases: staging first, after a backup, then production; `apt list --upgradable` for non-security updates; CI `audit` result for npm advisories | ops |
| Quarterly | restore drill (D-DB-4); review firewall rules, SSH keys and Hetzner logins; rotate database user passwords; check MongoDB and Ubuntu end-of-life dates | ops + owner |
| On a security alert | MongoDB, Node.js, Ubuntu or Apostrophe advisory rated high or critical: patch staging, then production, within a week | ops |

Major upgrades (MongoDB major version, Ubuntu release, Node.js major) are separate tasks with a
backup, a staging run of the suites and owner approval.

## 11. Verification checklist (run on staging once it exists)

All rows are **NOT EXECUTED**: no server exists.

| # | Check | How | Status |
|---|---|---|---|
| V1 | Only 22, 80, 443 reachable from outside | connect attempts from an outside machine to 22 (non-admin address), 3000, 27017 | NOT EXECUTED |
| V2 | Only nginx publishes host ports; `mongod` on loopback in its container | `sudo ss -tlnp` shows only 22, 80, 443; `docker compose ps` shows no port for `site` | NOT EXECUTED |
| V3 | Host firewall active | `sudo ufw status verbose` | NOT EXECUTED |
| V4 | SSH: no root, no passwords | `ssh root@<host>` and a password login both refused | NOT EXECUTED |
| V5 | MongoDB refuses unauthenticated and non-TLS clients | `mongosh` without credentials, and without TLS | NOT EXECUTED |
| V6 | App user cannot read other databases or manage users | `mongosh` as `assurerApp` | NOT EXECUTED |
| V7 | Data area encrypted | `lsblk -f` shows `crypto_LUKS` under the data mount (option A or B) | NOT EXECUTED |
| V8 | Automatic security updates on | `apt-config dump APT::Periodic::Unattended-Upgrade` returns `"1"` | NOT EXECUTED |
| V9 | App restarts after a crash | kill one web process (`docker compose exec site pkill -KILL -f 'node /app/app'`), then the whole container (`docker kill site`); the site answers again | NOT EXECUTED |
| V10 | HTTPS, redirect and headers | `curl -sI http://<host>/` redirects; `curl -sI https://<host>/` shows the headers in security-configuration.md | NOT EXECUTED |
| V11 | Secrets permissions | `docker compose exec site ls -la /data/secrets` shows `0711` on the directory and no file the `assurer` user can read except `tls/ca.pem`; `stat docker/staging/site.env` shows `0600 root` | NOT EXECUTED |
| V12 | Backup and restore | first restore drill into an isolated target (D-DB-4) | NOT EXECUTED |

## 12. Open choices (owner, with ops)

Choices 1–5 and 8 answered by the owner in session on 2026-11-04 (m1-040), each the agent
suggestion except choice 3. Choices 6 and 7 answered by the owner in session on 2026-11-06 (m1-044),
each the agent suggestion, from the m1-043 test results.
A decision here approves no tool install, account or spending: each tool still needs its own
approval with the license and advisory check.

| # | Choice | Options | Agent suggestion | Decision |
|---|---|---|---|---|
| 1 | Disk encryption (§5) | A full disk · B data volume · C none (risk acceptance) | B, manual announced reboots | **B, LUKS data volume** (2026-11-04, owner) |
| 2 | MongoDB member authentication | key file (MongoDB: test and development) · x.509 | x.509 for production; a key file is acceptable on staging | **x.509 on production; key file acceptable on staging** (2026-11-04, owner) |
| 3 | TLS proxy (§8) | nginx · Caddy | either; Caddy renews certificates by itself, nginx is more widely known | **nginx** (2026-11-04, owner); needs an ACME client, a separate tool approval |
| 4 | Reboot handling (§4) | automatic window · weekly manual | follows choice 1: manual if the data area needs unlocking | **Follows choice 1, so weekly manual** (2026-11-04, owner) |
| 5 | SSH source addresses (§3) | fixed admin addresses · any address (keys only) | fixed addresses if the admins have them | **Fixed admin addresses** (2026-11-04, owner); the addresses are supplied in the staging task |
| 6 | MongoDB major version (§6) | 8.x · 9.x | the newest the Node driver supports, decided in the local MongoDB task | **8.0.x, at 8.0.34 or newer** (2026-11-06, owner, m1-044). All suites passed on 8.0.34 (m1-043). **m1-041:** Apostrophe 4.34.0 accepts only `mongodb` driver 6.x, which supports servers up to **8.2**, so 9.x is ruled out until Apostrophe accepts driver 7 (D-DB-9, owner chose C) |
| 7 | `javascriptEnabled: false` (§6) | on · off | on, if the suites pass against it | **On** (2026-11-06, owner, m1-044). All suites passed with it on, and browser search worked (m1-043) |
| 8 | Uptime and alert monitoring | an external uptime check · none | an external check of `https://<host>/` with email alerts | **External uptime check with email alerts** (2026-11-04, owner); the service is chosen later, with approval |

## 13. Sources

Retrieved 2026-11-04.

1. docs.hetzner.com/cloud/firewalls/overview/
2. docs.hetzner.com/cloud/firewalls/faq/ (stateful; "Can Firewalls secure traffic to my private Hetzner Cloud Networks? Not yet")
3. ubuntu.com/server/docs/how-to/software/automatic-updates/
4. mongodb.com/docs/manual/administration/production-notes/ (manual 9.0)
5. mongodb.com/docs/community-platform-support/
6. mongodb.com/docs/manual/administration/security-checklist/ (manual 9.0)
7. Community write-ups on LUKS for Hetzner Cloud servers (for example "Notes on full disk encryption on a Hetzner cloud VPS", lemmy.world/selfhosted); not vendor documentation
8. mongodb.com/docs/manual/tutorial/deploy-replica-set-with-keyfile-access-control/
9. freedesktop.org/software/systemd/man/latest/systemd.service.html
