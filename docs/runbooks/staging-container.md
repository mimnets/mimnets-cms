# Runbook: the stack (one container per service, nginx, certbot)

| | |
|---|---|
| **Status** | **Draft; built and run on the owner's PC (`amd64`) and on a hosted GitHub runner (`arm64`) only** (`m1-055` to `m1-058`, agent-executed): see §8 for what was run and what was not. **m1-063: started in NPM mode on the owner's OCI server (`arm64`, Ubuntu 22.04, kernel 6.8) with §9.2's script, private (no domain, NPM not joined)**; not yet reached through NPM. **m1-064: the interactive installer (§10), tested locally only.** **m1-065: IP mode (§11), plain HTTP on the public address before go-live.** **m1-068: one container per service (D-DB-20) and images from `ghcr.io` (D-DB-21, §12); built and tested locally on `amd64`, not yet on a server.** Running it on a server needs the owner's approval (D-DB-2, D-DB-3, D-DB-7 and the server task) |
| **Purpose** | The site's stack (ADR-0004 Decision 2, Amendment 1; D-DB-20): the app, MongoDB 8.0.34 with TLS and member authentication, PBM and its schedule, nginx and certbot, each in its own container; no demo content and no default password |
| **Not for** | Production as it stands: production needs x.509 member authentication (hardening runbook §12 choice 2), the S3 backup storage (D-DB-12) and `APOS_ALLOW_INDEXING=1` |
| **Files** | [`docker/staging/`](../../docker/staging/): `compose.yaml`, `compose.build.yaml` (local builds), `compose.npm.yaml` (§9), `compose.ip.yaml` (§11), `app/Dockerfile`, `mongo/Dockerfile`, `setup.sh`, `mongo-entrypoint.sh`, `mongo-health.sh`, `app-entrypoint.sh`, `app-env.sh`, `pbm-agent.sh`, `pbm-env.sh`, `backup-schedule.sh`, `run-as.sh`, `mongod.conf`, `pbm-config.yaml`, `pbmc.sh`, `assurer-task.sh` (§4.1), `deploy.sh` (§12), `host-facts.sh` (§9.1), `npm-setup.sh` (§9.2), `install.sh` (§10), `ip-setup.sh` (§11), `nginx/`, `certbot/` |
| **Related** | [hardening runbook](./server-hardening-and-patching.md) §6–§8 · [PBM runbook](./pbm-backup-and-restore.md) · [HTTP security and HTTPS proxy](./security-configuration.md) · [demo container](./docker-single-container.md) · [m1-054 cluster results](../milestones/m1-054-cluster-mode-results.md) |

> **Setting up a server for the first time? Start at [§11, IP mode](#11-ip-mode-the-site-on-the-public-address-before-go-live-m1-065).**
> As root on the server: `git clone` the repository (or `git pull` in the clone), then
> `bash docker/staging/ip-setup.sh <public-ip>`. The site opens at `http://<public-ip>:8090`; the
> domain, NPM and Cloudflare follow at go-live (§11.4). Works on `arm64` and `amd64`. Since m1-068 the
> server pulls the images CI built for the clone's commit (`docker login ghcr.io` once, §12.1); it
> no longer builds them. **A server running the one-container stack of m1-055 to m1-067: §12.3.**

## 1. Layout

Compose project `mimnets-cms` (m1-068; the containers are `mimnets-cms-<service>-1`). Images from
`ghcr.io/mimnets/`, tagged with the commit (§12).

| Container | Image | Holds | Host ports |
|---|---|---|---|
| `setup` (one-shot, each start) | `assurer-mongo` | writes the missing secrets and the MongoDB TLS files into each service's secrets volume, then exits | none, no network |
| `mongo` | `assurer-mongo`: official `mongo:8.0.34` (digest pinned) plus PBM 2.17.0 and the project's scripts, without `gosu` and `js-yaml` | MongoDB with `requireTLS`, key-file member authentication, one-member replica set `mongo:27017`; creates its users at each start if missing | **none** |
| `pbm` | `assurer-mongo` | `pbm-agent`, as the `pbm` user | none |
| `backup` | `assurer-mongo` | the PBM configuration and the base-backup schedule, as the `pbm` user | none |
| `app` | `assurer-app`: the root `Dockerfile`'s build on `node:24-bookworm-slim` (digest pinned), without npm | Apostrophe (`APOS_CLUSTER_PROCESSES`, default 2), as the `assurer` user; runs the migrations at start | **none** (IP mode: one port) |
| `nginx` | `assurer-nginx`: official `nginx:1.30.6-alpine` (digest pinned) plus zlib 1.4, without the xslt and njs modules and `libxml2` | TLS, HTTP redirect, upload limit, rate limit | `80`, `443` |
| `certbot` | `assurer-certbot`: official `certbot/certbot:v5.9.0` (digest pinned) plus zlib 1.4 | certificate renewal | none |
| `cert-bootstrap` (one-shot) | `assurer-mongo` | a 30-day self-signed certificate if none exists, so nginx can start | none |

Start order: `setup` completes → `mongo` healthy (writable primary, users checked) → `app` and `pbm`
→ `backup`. nginx waits only for `cert-bootstrap`.

Networks: `edge` (nginx and the app; `172.30.57.0/24` by default, changed in m1-068 so it does not
clash with the one-container stack's network; change `ASSURER_EDGE_SUBNET` and `ASSURER_NGINX_IP`
together if that range is taken). `db` is internal, with no route out: only the app, `mongo`,
`pbm` and `backup` are on it. The app trusts the `X-Forwarded-*` headers from nginx's fixed address
only.

Volumes: `mongo-db`; `mongo-secrets`, `app-secrets`, `pbm-secrets` (each mounted read-only in its
own service only); `pbm-backups`; `media` (uploads); `app-data` (with the first admin password);
`certs`, `acme-webroot`. They live under Docker's data directory, which must be on the encrypted data
volume (hardening runbook §5, §7).

## 2. Settings

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `ASSURER_IMAGE_TAG` | `docker/staging/.env` | required | the release: a commit SHA on `main`; `deploy.sh` writes it (§12), with `ASSURER_PREVIOUS_TAG` |
| `ASSURER_PROXY_MODE` | `docker/staging/.env` | required by `deploy.sh` | `ip`, `npm` or `standalone`: which Compose files belong to this server; the setup scripts write it |
| `ASSURER_DOMAIN` | shell or `docker/staging/.env` | required | host name, for example `staging.example.org` |
| `APOS_BASE_URL` | shell or `docker/staging/.env` | required | `https://` plus the host name, no trailing slash |
| `APOS_CLUSTER_PROCESSES` | same | `2` | Node web processes (m1-054: 2 doubles the headroom for about 0.6 GiB) |
| `ASSURER_MONGO_CACHE_GB` | same | `1` | MongoDB cache; size it with the processes against the server's memory |
| `APOS_HSTS_MAX_AGE` | same | `300` | raise once HTTPS is confirmed (hardening runbook §8 point 4) |
| `ASSURER_BACKUP_INTERVAL_HOURS`, `ASSURER_BACKUP_RETENTION` | same | `24`, `8d` | PBM base backups ([PBM runbook](./pbm-backup-and-restore.md) §1) |
| `ASSURER_MONGO_MEMORY`, `ASSURER_APP_MEMORY`, `ASSURER_PBM_MEMORY`, `ASSURER_BACKUP_MEMORY`, `ASSURER_NGINX_MEMORY`, `ASSURER_CERTBOT_MEMORY` | same | `2g`, `2g`, `1g`, `256m`, `256m`, `256m` | memory limit per container; fit them to the server |
| `ASSURER_MAX_BODY`, `ASSURER_RATE_LIMIT`, `ASSURER_RATE_BURST` | same | `32m`, `30r/s`, `60` | nginx upload limit and per-address rate limit |
| `ASSURER_HTTP_BIND`, `ASSURER_HTTPS_BIND` | same | `80`, `443` | host ports, on all network interfaces by default; **set `127.0.0.1:80` and `127.0.0.1:443` for a local test**, so the site is not open to the local network (m1-058) |
| SMTP and form settings | `docker/staging/site.env`, mode `0600`, git-ignored | none | as in [form operations](./form-operations-and-privacy.md) |

The image sets `NODE_ENV=production` and `APOS_DEMO_SITE=0`. Compose sets `APOS_HTTPS=1` and
`APOS_TRUST_PROXY`. Never set `APOS_ALLOW_INDEXING` on staging.

## 3. First start

On a server, use the setup script of the route (§9.2, §10 or §11); each writes `.env` and runs
`deploy.sh --here`, which pulls this commit's images (§12). By hand:

```sh
S="docker compose -f docker/staging/compose.yaml"
bash docker/staging/deploy.sh   # pull, start, check (needs ASSURER_PROXY_MODE in .env)
$S logs -f app                   # wait for "Starting (2 web process(es))"
```

On a PC, build instead of pulling (no `deploy.sh`):

```sh
export ASSURER_IMAGE_TAG=local
B="docker compose -f docker/staging/compose.yaml -f docker/staging/compose.build.yaml"
$B build && $B up -d
```

The first start takes a few minutes. `setup` writes, into the three secrets volumes: the database
passwords, the key file, the session secret and the MongoDB TLS certificate (the CA key is deleted).
`mongo` creates the replica set and its users. The app writes a random password for the `admin`
account to its `app-data` volume. No demo content is loaded.

**First admin login.** Read the password once, log in at `$APOS_BASE_URL/login` as `admin`, change
the password in the admin UI, then delete the file:

```sh
$S exec app cat /app/data/admin-initial-password
$S exec app rm /app/data/admin-initial-password
```

Do not paste the password into a ticket, chat or document.

**First real certificate.** nginx starts with the self-signed certificate. With DNS pointing at the
server and port 80 open:

```sh
$S run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/acme \
  -d "$ASSURER_DOMAIN" --email <ops address> --agree-tos --no-eff-email \
  --deploy-hook assurer-deploy-hook
$S exec nginx nginx -s reload
```

The deploy hook copies the certificate to the path nginx reads; certbot keeps it in the renewal
settings, so the `certbot` container's twice-daily `certbot renew` reuses it, and nginx reloads by
itself every 6 hours. Try it first against Let's Encrypt's staging service (`--test-cert`), which
has higher rate limits.

## 4. Everyday commands

```sh
$S ps                            # state and health
$S logs -f app                   # the app; also mongo, pbm, backup, nginx
$S restart app                   # restart the app; MongoDB keeps running
$S restart mongo && $S restart app pbm backup   # restart the database and its clients
bash docker/staging/deploy.sh    # release: pull, back up, recreate what changed (§12)
```

**Never run `$S down -v`**: it deletes the database, media, secrets, local backups and
certificates for good.

### 4.1 Apostrophe tasks (added m1-067)

`node app <task>` needs the database address and the session secret, which only the entrypoint
builds from the app's secrets volume. `assurer-task` does the same for one command: it reads the
secrets, passes them through the environment (never the command line) and runs the task in the
`app` container, like `pbmc` does for PBM in the `pbm` container.

```sh
$S exec app assurer-task assurer-wp-import:run              # WordPress import: dry run, writes nothing
$S exec app assurer-task assurer-wp-import:run --execute    # writes drafts (docs/content/wordpress-import-design.md)
$S exec app assurer-task assurer-seo:seed-redirects         # legacy redirects, after publishing
$S exec app assurer-task @apostrophecms/user:add <name> editor   # asks for the password
```

Use `exec -T` from a script. A task runs next to the live site on the same database; tasks that
write say so, and the import changes only drafts.

## 5. Checks after a start

```sh
curl -sI http://$ASSURER_DOMAIN/            # 301 to https
curl -sI https://$ASSURER_DOMAIN/           # 200, Strict-Transport-Security, no Server version
$S exec pbm pbmc status                     # agent running, PITR on
```

Then the hardening runbook §11 checks.

## 6. Rotating secrets

The source of each database secret is the `mongo-secrets` volume; `setup` copies the app's and
PBM's values into their volumes at each start when they differ.

- **Admin account:** in the admin UI.
- **Session secret:** replace `session-secret` in the `app-secrets` volume with a new random hex
  value and recreate the app; every user is logged out.
- **Database passwords** (`assurerApp`, `pbm`): change the user's password as `siteAdmin` in
  `mongosh` in the `mongo` container, write the same value to the matching file in the
  `mongo-secrets` volume, then `$S up -d` (setup copies it) and restart the app or `pbm` and
  `backup`. Take a base backup after the change, because a restore needs the passwords that were
  current when its backup was taken.
- **MongoDB TLS certificate:** `setup` makes a new CA and certificate when fewer than 30 days are
  left; `deploy.sh` then restarts `mongo` and its clients (§12). To force it, delete `tls/` in the
  `mongo-secrets` volume and run `deploy.sh` again.

## 7. Known limits

- **MongoDB 8.0 refuses Linux kernels 6.19 to 7.0.13, on any CPU** (m1-058, SERVER-121912): the site
  `mongo` container restarts in a loop, the log shows `[assurer] MongoDB did not start`, and MongoDB's own line
  says `MongoDB cannot start: Linux kernel versions 6.19 and newer ...`. The kernel belongs to the host,
  so check `uname -r` before starting, and after any kernel or Docker Desktop update. MongoDB's fix is
  kernel 7.0.14 or later, but Ubuntu reports its 7.0 kernels as `7.0.0-<ABI>`, and the exemption for
  them comes only in the upcoming 8.0.37 (SERVER-131779), so 8.0.34 refuses every Ubuntu 7.0 kernel.
  D-DB-16 (decided m1-059): servers stay on Ubuntu 24.04's 6.8 kernel line; see the hardening runbook
  §4.
- A build needs a lot of memory on a PC: `amd64` fell from 6.5 GB available to 137 MB in m1-058, even
  with most steps cached. Servers no longer build (§12). `arm64` under emulation was not tried on a
  PC; use the hosted workflow (`.github/workflows/staging-arm64.yml`). It also leaves the four images
  as a one-day artifact for a scan (`docker scout cves archive://<file>.tar`, m1-060).
- The PBM backups are on the same server ([PBM runbook](./pbm-backup-and-restore.md)).
- No alert on backup status, certificate renewal or the site (hardening runbook §12 choice 8, not
  chosen yet).
- Rolling back across a release that added an Apostrophe migration needs a PITR restore (§12.2).
- The self-signed certificate from `cert-bootstrap` lasts 30 days; if no real certificate is issued
  by then, browsers and nginx keep using an expired one.

## 8. Verification

Agent-executed on the owner's PC (`linux/amd64`, Docker Desktop), 2026-11-08, under a disposable
project on `127.0.0.1`. Full results: [m1-055 report](../engineering/reports/2026/11/2026-11-08-m1-055-staging-image.report.md), and [m1-056 report](../engineering/reports/2026/11/2026-11-09-m1-056-staging-gaps.report.md) for the image without `gosu` and `esbuild`'s binaries, in one layer: suites, secrets, MongoDB and upload checks passed again on it.

| Check | Result |
|---|---|
| First start with no demo content or demo notice; `admin`/`admin` refused; the random password logs in; no secret value in the site log | PASS |
| HTTP redirect; HTTPS with HSTS and `Secure` cookies; other host names refused; 34 MB upload refused (413); rate limit (429), recovering within 3 s | PASS |
| MongoDB refuses non-TLS, unauthenticated and untrusted-CA clients; `assurerApp` limited to its database; `$where` refused; no CA key on disk; secrets unreadable by the app and `pbm` users except `ca.pem` | PASS |
| Smoke 18/18, workflow 15/15, persistence 7/7 through nginx, after seeding demo content and setting `APOS_DEMO_SITE=1` for the test only | PASS |
| One web process killed (no failed request of 20, replaced); `pbm-agent` killed (restarted, site up) | PASS |
| certbot `renew` with no certificate, deploy hook with a test certificate, nginx reload | PASS |
| Editor in Chrome: login, in-context edit, draft hidden, publish public | PASS, **bypassing nginx with `APOS_HTTPS=0`** |
| Editor in Chrome through nginx over HTTPS | PASS (`m1-056`: login, edit, draft hidden, publish public, media upload); the owner clicked through the certificate warning, which the extension cannot operate |
| Accepted upload through nginx, file served back complete | PASS (`m1-056`: 5 MB, SHA-256 identical) |
| nginx without the xslt and njs modules: template rendered, `nginx -t`, reload, HTTP redirect, other host names refused, HTTPS answers | PASS (`m1-057`); with the real site behind it, plus upload limit, accepted upload and rate limit, PASS (`m1-058`) |
| Site image with the `apt` upgrade | PASS (`m1-058`): built on both platforms, `2.8.4ubuntu0.1` read inside the image. Rescan on `amd64`: 6 high, no critical |
| `$S build`, `up -d`, `ps`, `logs`, `restart site`, `up -d --build`, the admin password file steps, on `amd64` | PASS (`m1-058`), under the default project name and ports. The memory fell to 137 MB during the build |
| Editor in Chrome through nginx on the changed images, at 1440 px: login, edit, draft hidden, publish public, media upload, session after a restart | PASS (`m1-058`) |
| `linux/arm64` on a hosted runner (`ubuntu-22.04-arm`, native): `$S build`, `up -d`, healthy, `apt`, redirect, HTTPS, 413, 429, first base backup with `pbm-agent` OK, restart | PASS (`m1-058`). **Refused by MongoDB on `ubuntu-24.04-arm`**: §7 |
| `linux/arm64`, same workflow, on every run: runner kernel as an annotation; accepted 5 MB upload through nginx, SHA-256 identical; PITR restore drill (PBM runbook §3) with a page published after the newest base backup | PASS (`m1-060`, kernel `6.8.0-1070-azure`, drill 40 s to a working site). Not run on `arm64`: Chrome, the suites |
| Docker Scout scan of the three `arm64` images (artifact of that workflow), critical and high | PASS (`m1-060`): site 6 high, nginx 1, certbot 13, no critical; the same findings as `amd64` |
| A real Let's Encrypt certificate, first issuance and renewal; a server; §6 rotation | NOT TESTED |
| NPM mode (§9) on `amd64`, behind a throwaway nginx stand-in for NPM, visitors on a non-private test subnet: no host port; visitor address in nginx's log and the app's `req.ip`; spoofed `X-Real-IP` and `X-Forwarded-For` ignored; a rogue sender on the NPM network not trusted; other host names 444; rate limit and form limit per visitor; HSTS once; `Secure` cookie; 413 at 34 MB; 5 MB SHA-256 identical; Chrome as an editor (login, edit, draft hidden, publish, media upload); standalone mode unchanged | PASS (`m1-062`). **Not tested with NPM itself, on a server, over IPv6, or with a real certificate** |
| `install.sh` (§10) on `amd64` (Git Bash, Docker Desktop), disposable projects on `127.0.0.1`, the kernel and terminal checks changed only in a temporary copy: route A through steps 0 to 8 and again over the running stack; route B through `npm-setup.sh` and step 7 against a throwaway nginx standing in for NPM (not joined, then joined); `--step`, `--check` with and without a terminal, quitting, end of input, a bad domain, a busy port, settings without a route; HTTPS 200, redirect, HSTS once, `Secure` cookie, 413, PBM; the forged `X-Real-IP` ignored | PASS (`m1-064`). **Not tested: a server, NPM itself, Let's Encrypt (both routes), the NPM backup's mode check (NTFS), Cloudflare** |

**m1-068 (one container per service, project `mimnets-cms`)**, agent-executed on the owner's PC
(`linux/amd64`, Docker Desktop), stack on `127.0.0.1`; full results in the
[m1-068 report](../engineering/reports/2026/11/2026-11-11-m1-068-release-pipeline.report.md):

| Check | Result |
|---|---|
| Build from `compose.build.yaml`; first start: secrets, replica set `mongo:27017`, users, PBM configured, first base backup; app healthy | PASS |
| No demo notice; `noindex`; `admin`/`admin` refused (400); random password logs in (200); none of five secret values in any log; no CA key on disk; each secrets volume owned by its service only | PASS |
| HTTP redirect, HTTPS with HSTS, 413 at 34 MB, 429 under load, `pbmc status` OK | PASS |
| MongoDB refuses non-TLS and unauthenticated clients; publishes no port; `db` network internal | PASS |
| Smoke 18/18, workflow 15/15, persistence 7/7 (after restarting `mongo`, then its clients) through nginx, with demo content seeded and `APOS_DEMO_SITE=1` for the test only | PASS |
| App recreated: MongoDB not restarted; a web worker killed: respawned, 0 of 20 requests failed; `pbm-agent` exits: restarted by Docker | PASS |
| PITR restore with the restore services (PBM runbook §3): a page published after the newest base backup and a 1 MB upload are back; 35 s from the copy to a working site | PASS |
| Chrome as an editor (not an administrator), through nginx over HTTPS: login, in-context edit, draft hidden from visitors, publish public, image upload, session kept across an app recreate | PASS (the owner clicked through the certificate warning) |
| `deploy.sh` guards and git paths: kernel, no `.env`, no route, changed clone, unknown commit, commit not on `main`, older commit without `--rollback`, failed pull leaves clone and `.env` unchanged | PASS (kernel check passed with a stub; in a throwaway clone) |
| `deploy.sh` pull and start from `ghcr.io`; `ip-setup.sh`, `npm-setup.sh`, `install.sh` with it; the release job; `arm64` of the split stack; a server | NOT TESTED (needs the first release on `main`; the `arm64` workflow runs on the PR) |

## 9. NPM mode (shared host, D-DB-17 option B)

For a host where Nginx Proxy Manager (NPM) already owns ports 80 and 443, such as the owner's OCI
server. Real staging and production use the standalone mode above (D-DB-17 option A); amended in
`m1-063`: production may run on the OCI server first (§9.2). Design:
[m1-061 paper](../milestones/m1-061-npm-proxy-design.md) §4. Built and tested locally in `m1-062`
against a stand-in for NPM, not against NPM itself (§8). Started on the owner's OCI server in `m1-063`
(§9.2), not yet behind NPM.

```
 Internet ──► :80/:443 NPM ──assurer-npm (172.30.56.0/24)──► nginx :8080 ──edge──► app:3000
               TLS, certificate     NPM 172.30.56.2              real_ip from NPM only
```

What changes against the standalone mode:

| Point | NPM mode |
|---|---|
| Host ports | none; `ASSURER_HTTP_BIND` and `ASSURER_HTTPS_BIND` do not apply |
| Entry | nginx's internal port `8080`, on the external network `assurer-npm` only |
| Visitor address | nginx takes `X-Real-IP` from `ASSURER_UPSTREAM_PROXY_IP` only; rate limit, logs and the app's form limit are per visitor. `APOS_TRUST_PROXY` does not change |
| Certificate | NPM issues and renews it. `certbot` does not start; §3 "First real certificate" does not apply |
| HSTS | the app sends it; leave it **off** in NPM, so it is not sent twice |

**Settings** (shell or `docker/staging/.env`), besides §2:

| Variable | Default | Meaning |
|---|---|---|
| `ASSURER_UPSTREAM_PROXY_IP` | required | NPM's fixed address on `assurer-npm`. One IPv4 address; nginx refuses to start on anything else |
| `ASSURER_NPM_NGINX_IP` | `172.30.56.10` | nginx's fixed address on `assurer-npm`; NPM forwards to it |
| `ASSURER_NPM_NETWORK` | `assurer-npm` | the external network's name |

**Owner's steps, once per host** (the owner's NPM, the owner's change; each needs the owner's approval):

1. Create the network. `--internal` keeps it to NPM and nginx, with no route out:
   `docker network create --internal --subnet 172.30.56.0/24 assurer-npm`
2. In NPM's Compose file: join `assurer-npm` (external) with `ipv4_address: 172.30.56.2`; set
   `IP_RANGES_FETCH_ENABLED=false` (paper §3.3); keep port 81 off the internet (an SSH tunnel to it
   is enough). Recreate NPM. Nothing else may join `assurer-npm`: nginx trusts one address on it.
3. Start the stack (below), then in NPM's admin UI add a proxy host for `$ASSURER_DOMAIN`:
   scheme `http`, forward to `172.30.56.10` port `8080`; Let's Encrypt certificate; Force SSL **on**,
   HTTP/2 **on**, HSTS **off**, WebSocket support **off**, Cache Assets **off**, Block Common Exploits
   **off** for the first test (untested with Apostrophe).

**Start and everyday commands:**

```sh
S="docker compose -f docker/staging/compose.yaml -f docker/staging/compose.npm.yaml"
$S config | grep -c published   # 0 in NPM mode (2 in standalone mode)
$S up -d                         # the stack with cert-bootstrap and nginx; no certbot
$S logs nginx | grep assurer-npm  # "NPM mode: port 8080, X-Real-IP trusted from <NPM address> only"
```

Use `$S` for every command in §3 to §6, or nginx loses the NPM settings and publishes 80 and 443
again. Switching a running standalone stack: `$S rm -sf certbot` first, because `up` leaves a running
container of a service that is no longer started. That step was not tested.
`ports: !reset` needs a Compose version that supports it: if `$S config` still lists ports on nginx,
do not start.

**Checks after a start** (paper §6; from outside the host): HTTP redirects to HTTPS; the certificate is
NPM's Let's Encrypt one; `Strict-Transport-Security` appears once; nginx's log
(`$S logs nginx`) shows the visitor's real address, not a `172.x` one, also with a forged
`X-Real-IP: 203.0.113.9` header. A `172.x` address there means Docker's userland proxy is in front of
NPM, and the per-visitor limits do not work: stop and resolve that first.

### 9.1 Before a test on a shared host (owner's steps)

Added in `m1-063` for the disposable test on the owner's OCI server (m1-061 paper §6). Both steps
change nothing on the server. Not yet run as written; m1-063 records the result.

**A throwaway name.** The test uses a new subdomain made only for it and deleted afterwards, such as
`m1-063-test.example.com`. Never use the bare domain, `www`, or any name the WordPress site, email or
another service uses: pointing it at the test server takes that service down.

**A. The DNS record in Cloudflare**

1. Sign in at `https://dash.cloudflare.com` and open the domain, then **DNS → Records**.
2. Check that no existing record has the chosen name. If one does, pick another name.
3. **+ Add record**: **Type** `A`; **Name** the subdomain part only (`m1-063-test`); **IPv4 address**
   the server's public IPv4 (OCI Console: **Compute → Instances →** the instance **→ Public IP
   address**); **Proxy status** **DNS only** (grey cloud); **TTL** `Auto`; **Comment**
   `disposable test, delete after test`. **Save**.
4. **DNS only is required.** With the orange cloud (Proxied), NPM sees Cloudflare's addresses, not the
   visitor's: §6 checks 3 to 5 then test Cloudflare, and every visitor shares one rate-limit bucket.
   nginx trusts NPM's address only. Running behind Cloudflare's proxy needs its own design.
5. No AAAA record unless the server has a public IPv6 address.
6. Check from the PC (PowerShell): `Resolve-DnsName m1-063-test.example.com -Type A`. The answer is the
   server's address. A proxied record usually answers from `104.16.0.0/13` or `172.64.0.0/13` (full list:
   `https://www.cloudflare.com/ips/`): the cloud is still orange.
7. At clean-up, delete the record.

**B. Read-only facts from the server**

Connect as usual (`ssh -i <key> ubuntu@<server-address>`; `ubuntu` is the default user on OCI's Ubuntu
images). The commands are in [`docker/staging/host-facts.sh`](../../docker/staging/host-facts.sh), which
only reads. From the repository clone (for example `/home/ubuntu/vcl-assurer-group`):

```sh
cd /home/ubuntu/vcl-assurer-group
git pull                                 # gets the script if the clone is older
bash docker/staging/host-facts.sh        # sudo may ask for a password
```

It prints the facts and saves a copy to `~/assurer-host-facts.txt`, in the home folder, outside the
clone, so it cannot be committed. Send the output with anything sensitive replaced (for example the
public address as `x.x.x.x`). The file is server output: never add it to the repository.

What the output decides, before anything on the server changes:

| Check | Go | Stop |
|---|---|---|
| Kernel (D-DB-16) | `uname -r` starts with `6.8.` | anything else: MongoDB 8.0.34 may refuse to start |
| Compose | 2.24 or later (`ports: !reset`) | older: nginx would publish 80 and 443 next to NPM |
| Userland proxy | recorded: whether `ss` shows NPM's ports held by `docker-proxy`; §6 check 3 decides whether the visitor's address survives | — |
| Space | enough disk and memory for the images and MongoDB | — |

### 9.2 Ready-made setup on a shared host, settings later (m1-063)

The owner's route (m1-063): start the stack now with one script, and add the domain, Cloudflare and
NPM later. The script never touches NPM or another container, so the site stays private until the
"Later" steps. [`docker/staging/npm-setup.sh`](../../docker/staging/npm-setup.sh) is safe to run again.

**Now** (as root, in the clone, on the branch or `main` that carries the script):

```sh
cd /home/ubuntu/vcl-assurer-group
git pull
bash docker/staging/npm-setup.sh
```

It stops, before changing anything, if the kernel is not on the 6.8 line (D-DB-16), if Compose is
older than 2.24, or if a standalone stack is there. Then it:

1. creates the `assurer-npm` network (`172.30.56.0/24`, internal) if missing, or checks the existing one;
2. writes `docker/staging/.env` (git-ignored, mode `0600`) once, with the placeholder domain
   `assurer.invalid` and NPM's address `172.30.56.2`; it never overwrites the file;
3. checks that the stack publishes no host port, then pulls and starts the clone's release
   (`deploy.sh --here`, §12);
4. waits up to 10 minutes for a 200 from the site on nginx's internal port 8080, and prints how to
   read the first admin password (§3).

**Later, when the domain is chosen** (each step the owner's, with the owner's approval):

1. Cloudflare record for the host name, **DNS only** (§9.1 A).
2. NPM joins `assurer-npm` at `172.30.56.2`, with `IP_RANGES_FETCH_ENABLED=false` and port 81 on
   `127.0.0.1` only (§9 owner's step 2). When NPM is a Portainer stack, make the change in Portainer
   (**Stacks →** the stack **→ Editor → Update the stack**), not in the file on disk. Updating
   recreates NPM: every site behind it is down for a moment. First copy the stack text and back up
   NPM's `data` folder and certificates.
3. Set the domain; this recreates `app` and `nginx`:
   `bash docker/staging/npm-setup.sh --domain <host name>`
4. NPM proxy host for the host name (§9 owner's step 3), Let's Encrypt staging certificate first.
   Corrected in m1-064: NPM has no staging certificate per proxy host, so it is the real one (§10).
5. The checks after a start (§9) and m1-061 paper §6.

**Production on this host.** The owner decided on 2026-11-10 (m1-063) that production may also run on
the OCI server first and move to another server later (D-DB-17, amended). This stack is the
staging build. Before real visitors use it as production, at least: x.509 member authentication
(hardening runbook §12 choice 2); backups off the server (D-DB-12, PBM S3); `APOS_ALLOW_INDEXING=1`;
HSTS raised (§2); SMTP in `site.env`; a restore drill on a copy; the per-visitor checks of paper §6
passed with NPM. Each is its own approved task.

### 9.3 Removing a test stack from a shared host (m1-063)

For a disposable test only. `down -v` **deletes the stack's database, media, secrets and backups for
good**; never run it on a stack with content to keep. NPM, Portainer and other containers are not
touched. As root, in the clone:

```sh
cd /home/ubuntu/vcl-assurer-group
S="docker compose -f docker/staging/compose.yaml -f docker/staging/compose.npm.yaml"

# 1. Look first: what will go
$S ps -a
docker volume ls --format '{{.Name}}' | grep -E '^(assurer-staging|mimnets-cms|assurer)_'
docker image ls --format '{{.Repository}}:{{.Tag}}  {{.Size}}' | grep -E '^(ghcr.io/mimnets/)?assurer-'

# 2. The test stack: containers, its networks and volumes
$S down -v --remove-orphans
# 3. The demo container's volumes, if `docker compose up -d` was run in the clone
docker compose down -v
# 4. The shared network (only after the stack is down; NPM must not be joined to it)
docker network rm assurer-npm
# 5. The images (frees several GB) and the settings file
docker image rm $(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E '^(ghcr.io/mimnets/)?assurer-')
rm -f docker/staging/.env

# 6. Check: no output from these three
docker ps -a --format '{{.Names}}' | grep assurer
docker volume ls --format '{{.Name}}' | grep -E '^(assurer-staging|mimnets-cms|assurer)_'
docker network ls --format '{{.Name}}' | grep assurer
```

If NPM was never changed, its backup from §9.2 is no longer needed and holds private keys:
`rm -rf /root/npm-backup-m1-063 /root/npm-backup-m1-063.tar.gz`. The Cloudflare record can stay
for a later run or be deleted (§9.1 A step 7).

## 10. Interactive install (m1-064)

One script for a server: it starts the stack (pulling the clone's release since m1-068), checks it, then guides the owner one step at
a time through the public address, the domain, the certificate and the final checks. Design and
decision: [m1-064 paper](../milestones/m1-064-installer-design.md) (D-DB-18). Tested locally only
(§8); not yet run on a server.

**What it changes.** Only this stack: `docker/staging/.env`, the `assurer-npm` network, the images,
the containers and, in route A, certbot in the stack's own container. For NPM, Portainer, Cloudflare,
the OCI console and the firewall it shows the exact command or setting and waits; the owner makes
each of those changes. It never reads or prints the admin password.

**Run it** as root, from the clone of `main`, in an SSH session (it reads answers from the terminal):

```sh
cd /home/ubuntu/vcl-assurer-group
git pull
bash docker/staging/install.sh              # all steps
bash docker/staging/install.sh --step 6     # start at one step (0 to 9)
bash docker/staging/install.sh --check      # the final checks only (also without a terminal)
```

At each prompt: `[r]un` (a command on the stack), `[d]one` (the owner made the shown change), `[s]kip`,
`[t]ry` a failed check again, or `[q]uit`. `Ctrl-D` also quits. Every quit prints the summary so far.
Everything on screen also goes to `~/assurer-install-<date>-<time>.log` (mode `0600`, outside the
clone). Keep the log off the repository; it holds the host name and the public address.

**Running it again is safe.** It keeps no state file. A route already in `.env` is kept (settings
written by hand as in §3 count as route A, settings from `npm-setup.sh` as route B), so the script
never switches a stack with content between routes. Existing settings are kept; only step 6 changes
the domain. A real certificate already in place skips step 7.

| Step | Route A, standalone (D-DB-17 A) | Route B, behind NPM (D-DB-17 B, §9) |
|---|---|---|
| 0 Host checks, read-only | Stops if the kernel is not on the 6.8 line (D-DB-16) or Compose is older than 2.24. Warns on the branch, local changes, an older clone and under 15 GB free disk. Shows ports 80, 81 and 443, NPM and existing `assurer` containers | same |
| 1 Route | Recommended when ports 80 and 443 are free and no NPM runs | Recommended when NPM runs. If something else owns 80 or 443, the script stops |
| 2 Settings | Writes `.env` once (mode `0600`): domain (Enter keeps the placeholder `assurer.invalid` until step 6), web processes, MongoDB cache (§2) | same, plus `ASSURER_UPSTREAM_PROXY_IP=172.30.56.2` |
| 3 Pull and start | `deploy.sh --here` (§12), waits for a 200 | runs `npm-setup.sh` (§9.2) |
| 4 Check on the server | HTTPS 200 and HTTP 301 through the stack's nginx; shows the first admin login (§3) | 200 on nginx's port 8080; same login text |
| 5 Public address | From the PC with `curl.exe --resolve`; if it fails, the OCI security list path and `iptables -S DOCKER-USER` (read-only) | does not apply: nothing is published |
| 6 Domain and Cloudflare | Sets the domain in `.env`, `up -d`; shows the Cloudflare record (§9.1 A, **DNS only**); checks the DNS answer, and names a Cloudflare address as an orange cloud | `npm-setup.sh --domain`; the same record and check |
| 7 Certificate | certbot as in §3: `--test-cert` first, then the real certificate with `--force-renewal`, `nginx -s reload`; checks the issuer | (a) NPM backup commands, after showing NPM's mounts; (b) the lines for NPM's stack in Portainer; (c) the proxy-host settings (§9 owner's step 3). The script checks: NPM on `assurer-npm` at `172.30.56.2`, nothing else there, `IP_RANGES_FETCH_ENABLED=false`, port 81 on `127.0.0.1` only, then 200, a redirect and a Let's Encrypt issuer |
| 8 Final checks | From the server: redirect, 200, real certificate, HSTS once, no `Server` version, `Secure` cookie, 413 at 34 MB, `pbmc status`. From the PC, two `curl.exe` requests with random markers: the script finds them in nginx's log; the logged address must be the PC's, not a private one, and a forged `X-Real-IP` must be ignored. Per-visitor 429 is listed as manual (two outside addresses) | same, plus `Test-NetConnection <ip> -Port 81` from the PC (must be `False`) |
| 9 Summary | PASS, FAIL, SKIPPED, NOT TESTED and MANUAL per check, the production items still open (§9.2) and the log's path | same |

**Certificates.**

- Route A: certbot replaces a staging certificate with a real one when `--force-renewal` is given
  (certbot needs `--break-my-certs` only for the opposite direction). Not run against Let's Encrypt:
  it needs a public host name.
- Route B: **NPM has no staging certificate per proxy host.** NPM 2.15.1 reads one setting,
  `LE_STAGING`, for the whole container (`backend/lib/config.js`), which would move every site behind
  NPM to staging certificates. So step 7(c) requests the real certificate directly. Check the DNS
  record first (step 6): Let's Encrypt allows 5 failed validations per host name per hour. This
  replaces "Let's Encrypt staging certificate first" in §9.2 step 4 for NPM.

**Not covered:** route A on a real server; IPv6; Cloudflare's proxy (orange cloud), which needs its
own design (§9.1 A, point 4); Chrome as an editor through the public host name (the agent runs it with
the owner's approval). The script makes nothing production-ready: step 9 lists what is still open.

## 11. IP mode: the site on the public address before go-live (m1-065)

The owner's route (m1-065): start the site on the server's public address and one port, sign in and
set up the content there, and switch to the domain later. The WordPress site keeps serving the domain
until go-live. One script, safe to run again. It never touches NPM or another container.

```
 Internet ──► http://<public-ip>:8090 ──► app:3000         (no nginx, no NPM, no TLS)
```

**Read this first.** IP mode is **plain HTTP**: the admin password and every page cross the internet
unencrypted, and anyone who finds the address can see the site. There is no nginx in front, so no
upload size limit at the proxy and no proxy rate limit. Use it only until go-live, then change the
admin password again. The production items in §9.2 stay open.

### 11.1 Start

As root, in the clone, on `main`:

```sh
cd /home/ubuntu/vcl-assurer-group
git switch main && git pull
bash docker/staging/ip-setup.sh <public-ip>          # port 8090
bash docker/staging/ip-setup.sh <public-ip> 8091     # another port
```

The public IP is in the OCI console: **Compute → Instances →** the instance **→ Public IP address**.
The script stops, before it changes anything, if the kernel is not on the 6.8 line (D-DB-16), if a
standalone stack is there, or if the port is in use (§11.2). Then it writes `docker/staging/.env`
(git-ignored, mode `0600`; the same keys as §9.2, plus `ASSURER_PUBLIC_IP` and `ASSURER_IP_PORT`),
pulls and starts the clone's release (`deploy.sh --here`, §12), waits for a 200 and prints the
next steps. The first time, run `docker login ghcr.io` before it (§12.1).

**Open the port** (the owner's change, OCI console): **Networking → Virtual cloud networks →** the
VCN **→ Security Lists → Default Security List → Add Ingress Rules**: Source CIDR `0.0.0.0/0`, IP
Protocol `TCP`, Destination Port Range `8090` (or the port chosen). Docker's published ports do not
pass the host's `INPUT` rules, so no `iptables` change is needed on the server.

**Sign in:** `http://<public-ip>:8090/login`, user `admin`. The first password, read once and then
changed in the admin UI:

```sh
docker compose -f docker/staging/compose.yaml -f docker/staging/compose.ip.yaml \
  exec app cat /app/data/admin-initial-password
```

### 11.2 When the port is already in use

The script checks the port first and names what holds it:

| Message | Meaning | What to do |
|---|---|---|
| `port 8090 is used by container(s): <names>` | Another Docker container publishes that port | Pick a free port: `bash docker/staging/ip-setup.sh <public-ip> 8091` |
| `port 8090 is in use by a program on this server` | A program outside Docker listens on it | See which: `ss -tlnp 'sport = :8090'`; pick another port as above |
| `port 8090 is free` | Free, or already this site's own port (a run again) | Nothing |

To list ports already taken on the server: `ss -tlnp` and `docker ps --format '{{.Names}}  {{.Ports}}'`.
Ports 80, 81 and 443 belong to NPM: never use them here. After a change of port, change the OCI
ingress rule to match and remove the old one.

### 11.3 Everyday commands

```sh
S="docker compose -f docker/staging/compose.yaml -f docker/staging/compose.ip.yaml"
$S ps           # app and mongo running (healthy)
$S logs app     # the app's log
$S restart app
$S stop         # stops the stack; data stays in the volumes
$S exec app assurer-task assurer-wp-import:run   # any Apostrophe task (§4.1); this one is a dry run
```

Never run `$S down -v`: it deletes the database, media, secrets and backups (§9.3).

### 11.4 Go-live: from IP mode to the domain

The database, media and secrets stay; only the way in changes. Each step is the owner's change, with
the owner's approval. The WordPress site stops answering for the domain at step 1, so do it when the
content is ready.

1. Cloudflare: change the domain's record to an `A` record with the server's IPv4, **DNS only** (§9.1 A).
2. NPM joins `assurer-npm` at `172.30.56.2` (§9 owner's step 2, §9.2 "Later" step 2).
3. `bash docker/staging/npm-setup.sh --domain <host name>`. This removes the public port from the
   app, starts nginx in NPM mode and switches the site to `https://<host name>`.
4. NPM proxy host for the host name (§9 owner's step 3), real Let's Encrypt certificate (§10).
5. Remove the OCI ingress rule for port 8090. Change the admin password again.
6. The checks after a start (§9).

Not yet run on a server (m1-065 records the result).

## 12. Releases: images from `ghcr.io` (m1-068, D-DB-21)

CI builds the four images for each commit on `main` after every check passes, on native `amd64` and
`arm64` runners. It starts the stack and checks it on each architecture, then pushes the images as
private packages. The tag `<commit SHA>` exists only when both architectures passed. The server
never builds; `deploy.sh` pulls a release and starts it. Design:
[m1-068 design note](../milestones/m1-068-release-pipeline-design.md).

```sh
bash docker/staging/deploy.sh                 # the newest commit on origin/main
bash docker/staging/deploy.sh <commit>        # a given commit on main
```

It moves the clone to the commit (detached), so the Compose files match the images; pulls them,
and if that fails, changes nothing; takes a PBM base backup if the stack runs (a PITR point just
before the release); writes `ASSURER_IMAGE_TAG` (and `ASSURER_PREVIOUS_TAG`) to `.env`; runs `up -d`,
which recreates only what changed (**an app release does not restart MongoDB**); restarts `mongo`
and its clients if `setup` made a new MongoDB certificate; waits for the app and `pbm-agent`, then
prints the image digests and the rollback command. After a deploy the clone is on a detached
commit: use `deploy.sh`, not `git pull`, to move it.

### 12.1 The pull token (once per server; the owner's step)

The packages are private, so the server signs in once with a GitHub token that can only read them.
At the time of writing, GitHub's container registry accepts a *classic* personal access token:

1. GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic) →
   Generate new token (classic)**: note `mimnets-cms server pull`, expiry one year (set a
   reminder), scope **`read:packages` only**.
2. On the server, as root: `docker login ghcr.io -u <github user> --password-stdin`, paste the
   token, press Enter, then Ctrl-D. Docker keeps it in `/root/.docker/config.json` (mode `0600`).
3. Never put the token in the clone, `.env`, a script, a log or a chat. To replace it, sign in again;
   to revoke it, delete it on GitHub.

### 12.2 Rollback

```sh
bash docker/staging/deploy.sh <ASSURER_PREVIOUS_TAG from .env> --rollback
```

`deploy.sh` refuses an older commit without `--rollback`. **Apostrophe migrations only go forward:**
if a release after the target added one (the PR says so), the older code meets data it did not
write. Then also restore the database to the backup `deploy.sh` took before that release (PBM
runbook §4), with its media.

### 12.3 From the one-container stack (once per server)

For a server that runs the one-container stack (project `assurer-staging`, m1-055 to m1-067). The
new stack has its own volumes; nothing old is reused or deleted. **A fresh start: the content is
not carried over** (D-DB-22); run the WordPress import again afterwards.

1. `git pull` in the clone (on `main`), and `docker login ghcr.io` (§12.1).
2. Run the setup script of the route again with `--switch-from-one-container`, for example
   `bash docker/staging/ip-setup.sh <public-ip> 8090 --switch-from-one-container`. Through
   `deploy.sh`, it takes a base backup in the old `site` container, stops the old containers (their
   volumes stay), and starts the new stack.
3. New admin password (§3); the WordPress import again: a dry run, then `--execute` (§4.1).
4. The old volumes (`assurer-staging_*`) stay as the fallback. Removing them is a later step with
   its own approval, after the new site is checked.
