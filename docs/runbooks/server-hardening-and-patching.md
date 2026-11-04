# Runbook: server hardening and patching (Hetzner Cloud, self-hosted MongoDB)

| | |
|---|---|
| **Status** | **Draft, not yet executed** (`m1-039`, 2026-11-04). No server, account or bucket exists. Nothing in this runbook approves an account, spending, a tool install or a provider choice |
| **Task** | [m1-039 report](../engineering/reports/2026/11/2026-11-04-m1-039-hardening-runbook.report.md) |
| **Applies to** | The owner's preferred stack ([hosting options paper](../milestones/m1-031-hosting-options.md) §10): one Hetzner Cloud server per site in Singapore, Ubuntu LTS, MongoDB Community Server (D-DB-8), the Node app under systemd behind a TLS proxy, media on the server disk with a nightly copy to a versioned EU bucket |
| **Waits for** | D-DB-2, D-DB-3 and D-DB-7 (DPO input I1). The open choices in §12 |
| **Related** | [ADR-0002](../architecture/decisions/ADR-0002-database-strategy.md) · [deployment principles](./deployment-principles.md) · [HTTP security and HTTPS proxy](./security-configuration.md) · [backup protection plan](./backup-protection-plan.md) · [backup and restore](./database-backup-and-restore.md) · D-DB-4 · D-DB-8 |
| **Facts as of** | 2026-11-04, from vendor documentation (sources in §13). Re-check versions before use |

Each step that installs software (MongoDB, Node.js, the TLS proxy, the backup tool, the media
copy tool) needs its own approval, license check and advisory check (AGENTS.md). Staging and
production are **separate servers** with their own database, media, secrets and backup
credentials. Never copy one site's database into another.

## 1. Target layout (one server per site)

| Component | Listens on | Reachable from |
|---|---|---|
| TLS proxy (nginx or Caddy, §12) | `0.0.0.0:80`, `0.0.0.0:443` (and IPv6) | the internet |
| SSH | `22` | admin addresses only (§3) |
| Node app (`npm run serve`) | `127.0.0.1:3000` (project default `ADDRESS`) | the proxy only |
| `mongod` | `127.0.0.1:27017` | the app and backup tool on the same server |
| Media | `/srv/assurer/<site>/uploads` on the encrypted data area (§5) | the app; nightly copy to the EU bucket |
| Backup tool | outbound only | sends to the backup target (§9) |

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
| TCP 22 | admin addresses only (§12, choice 5) | SSH |
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
5. Remove or disable services that are not needed. Persistent `journald` with a size cap
   (`SystemMaxUse=1G` in `/etc/systemd/journald.conf.d/size.conf`).
6. MongoDB host settings [4]: data on **XFS** (strongly recommended for WiredTiger),
   `vm.swappiness = 1`, open-files limit at least 64000 (the package's systemd unit sets it),
   transparent huge pages **enabled** for MongoDB 8.0 and later, `noatime` on the data volume.
   If antivirus or EDR software is ever installed, exclude the MongoDB data and log paths [6].

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

Agent suggestion (not a decision): **B**, with manual reboots announced in advance, because the
RTO (D-DB-4, ≤ 4 h) allows a manual unlock and the OS stays reachable for patching.

## 6. MongoDB

Install from MongoDB's official apt repository (tool approval needed). Pick the major version in
the local MongoDB task, after checking it against the installed Node driver (`mongodb` 6.21.0)
in MongoDB's driver compatibility table (not verified in m1-039).

`/etc/mongod.conf` (outline; verify every key against the chosen version's reference):

```yaml
storage:
  dbPath: /srv/mongodb            # on the encrypted XFS data area (§5)
net:
  port: 27017
  bindIp: 127.0.0.1               # add the private address only for a separate DB server
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/mongodb/tls/server.pem
    CAFile: /etc/mongodb/tls/ca.pem
security:
  authorization: enabled
  keyFile: /etc/mongodb/keyfile   # or x.509 member authentication (§12 choice 2)
  javascriptEnabled: false        # only if the suites pass with it (§12 choice 7)
replication:
  replSetName: rs0                # one member; needed for PITR (D-DB-4)
```

Steps, from MongoDB's replica set tutorial [8] and security checklist [6]:

1. Create the key file with `openssl rand -base64 756`, owner `mongodb`, mode `400`. MongoDB says
   key files are for test and development and recommends x.509 for production [8] (§12 choice 2).
2. Create a private CA and a server certificate for TLS. Keep the CA key off the server.
3. Start `mongod`, connect through `127.0.0.1` (the localhost exception), run `rs.initiate()`
   with one member, then **at once** create the user administrator. The localhost exception
   closes once the first user exists.
4. Create one user per purpose, least privilege [6]:

   | User | Roles | Used by |
   |---|---|---|
   | `siteAdmin` (break-glass) | `userAdminAnyDatabase`, `clusterAdmin` | admins, by hand only |
   | `assurerApp` | `readWrite` on the site database only | the app |
   | `assurerBackup` | `backup` (and `restore` only on the restore target) | the backup tool |

   Optionally limit each user to `127.0.0.1` with `authenticationRestrictions` [6].
5. App connection string in the app's environment file (§7), never in Git:
   `APOS_DB_URI=mongodb://assurerApp:<secret>@127.0.0.1:27017/<site-db>?replicaSet=rs0&tls=true&authSource=<site-db>`
   (plus the CA file option for the driver). Verify the exact form in the local MongoDB task.
6. Log rotation: `systemLog.logRotate: reopen` with a `logrotate` rule, or the default rename.

Ongoing [6]: watch MongoDB's security alerts and end-of-life dates, apply patch releases,
review network rules, rotate database user passwords.

## 7. The app under systemd

Per the [deployment principles](./deployment-principles.md): releases are replaceable code;
`data/`, uploads and `.env` live outside the release; build, migrate, then switch.

`/etc/systemd/system/assurer.service` (outline):

```ini
[Unit]
Description=Assurer World website
After=network-online.target mongod.service
Wants=network-online.target

[Service]
User=assurer
Group=assurer
WorkingDirectory=/srv/assurer/<site>/current
EnvironmentFile=/etc/assurer/<site>.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node app
Restart=always
RestartSec=2
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/srv/assurer/<site>/uploads /srv/assurer/<site>/data

[Install]
WantedBy=multi-user.target
```

- `Restart=always` meets R6 (options paper §2): systemd restarts the app after any exit [9].
- `/etc/assurer/<site>.env`: owner `root`, group `assurer`, mode `0640`. It holds
  `APOS_DB_URI`, `APOS_SESSION_SECRET`, `APOS_RELEASE_ID` and the settings in
  [security-configuration.md](./security-configuration.md) (`APOS_HTTPS=1`,
  `APOS_TRUST_PROXY=loopback`, `APOS_HSTS_MAX_AGE`), SMTP and `APOS_BASE_URL`.
  `APOS_ALLOW_INDEXING=1` on production only; `APOS_DEMO_SITE` unset on both.
- Node.js 24 (the `engines` field), from an approved source (tool approval).
- Check that `ProtectSystem=strict` leaves every path the app writes to in `ReadWritePaths`
  (uploads, local data, any build cache), and adjust it in the first staging task.

## 8. TLS proxy

Choice open (§12 choice 3). Whichever is used must:

1. Redirect HTTP to HTTPS, serve TLS 1.2 or later, and renew Let's Encrypt (ACME) certificates
   automatically.
2. Proxy to `127.0.0.1:3000` and set `X-Forwarded-For` and `X-Forwarded-Proto` as described in
   [security-configuration.md](./security-configuration.md#behind-an-https-reverse-proxy-staging-and-production).
3. Limit request body size to the app's upload limit, and rate-limit floods (the app's own form
   limit is per client and does not stop floods).
4. Start HSTS short (`APOS_HSTS_MAX_AGE=300`) and raise it once confirmed.

## 9. Backups and media copy

- **Database:** a continuous backup tool against the one-member replica set, for 7-day PITR and a
  15-minute RPO (D-DB-4). The tool is approved in principle only; choosing it is a separate task
  with the license and advisory check. The backup account (`assurerBackup`) and the target's
  credentials are separate from the app's (backup protection plan §2).
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
| V2 | `mongod` and the app bound to loopback | `sudo ss -tlnp` | NOT EXECUTED |
| V3 | Host firewall active | `sudo ufw status verbose` | NOT EXECUTED |
| V4 | SSH: no root, no passwords | `ssh root@<host>` and a password login both refused | NOT EXECUTED |
| V5 | MongoDB refuses unauthenticated and non-TLS clients | `mongosh` without credentials, and without TLS | NOT EXECUTED |
| V6 | App user cannot read other databases or manage users | `mongosh` as `assurerApp` | NOT EXECUTED |
| V7 | Data area encrypted | `lsblk -f` shows `crypto_LUKS` under the data mount (option A or B) | NOT EXECUTED |
| V8 | Automatic security updates on | `apt-config dump APT::Periodic::Unattended-Upgrade` returns `"1"` | NOT EXECUTED |
| V9 | App restarts after a crash | `sudo systemctl kill -s KILL assurer`; the site answers again within seconds | NOT EXECUTED |
| V10 | HTTPS, redirect and headers | `curl -sI http://<host>/` redirects; `curl -sI https://<host>/` shows the headers in security-configuration.md | NOT EXECUTED |
| V11 | Secrets file permissions | `stat /etc/assurer/<site>.env` shows `0640 root:assurer` | NOT EXECUTED |
| V12 | Backup and restore | first restore drill into an isolated target (D-DB-4) | NOT EXECUTED |

## 12. Open choices (owner, with ops)

| # | Choice | Options | Agent suggestion |
|---|---|---|---|
| 1 | Disk encryption (§5) | A full disk · B data volume · C none (risk acceptance) | B, manual announced reboots |
| 2 | MongoDB member authentication | key file (MongoDB: test and development) · x.509 | x.509 for production; a key file is acceptable on staging |
| 3 | TLS proxy (§8) | nginx · Caddy | either; Caddy renews certificates by itself, nginx is more widely known |
| 4 | Reboot handling (§4) | automatic window · weekly manual | follows choice 1: manual if the data area needs unlocking |
| 5 | SSH source addresses (§3) | fixed admin addresses · any address (keys only) | fixed addresses if the admins have them |
| 6 | MongoDB major version (§6) | 8.x · 9.x | the newest the Node driver supports, decided in the local MongoDB task |
| 7 | `javascriptEnabled: false` (§6) | on · off | on, if the suites pass against it |
| 8 | Uptime and alert monitoring | an external uptime check · none | an external check of `https://<host>/` with email alerts |

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
