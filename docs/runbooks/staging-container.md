# Runbook: the staging stack (one site container, nginx, certbot)

| | |
|---|---|
| **Status** | **Draft; built and run on the owner's PC (`amd64`) and on a hosted GitHub runner (`arm64`) only** (`m1-055` to `m1-058`, agent-executed): see §8 for what was run and what was not. Not run on a server. Running it on a server needs the owner's approval (D-DB-2, D-DB-3, D-DB-7 and the server task) |
| **Purpose** | The staging version of the one-container image (ADR-0004 Decision 2, D-DB-10 (b)): app and MongoDB 8.0.34 in one container with TLS, member authentication, PBM, no demo content and no default password; nginx and certbot in their own containers |
| **Not for** | Production as it stands: production needs x.509 member authentication (hardening runbook §12 choice 2), the S3 backup storage (D-DB-12) and `APOS_ALLOW_INDEXING=1` |
| **Files** | [`docker/staging/`](../../docker/staging/): `compose.yaml`, `compose.npm.yaml` (§9), `Dockerfile`, `entrypoint.sh`, `run-as.sh`, `mongod.conf`, `pbm-config.yaml`, `pbmc.sh`, `nginx/`, `certbot/` |
| **Related** | [hardening runbook](./server-hardening-and-patching.md) §6–§8 · [PBM runbook](./pbm-backup-and-restore.md) · [HTTP security and HTTPS proxy](./security-configuration.md) · [demo container](./docker-single-container.md) · [m1-054 cluster results](../milestones/m1-054-cluster-mode-results.md) |

## 1. Layout

| Container | Image | Holds | Host ports |
|---|---|---|---|
| `site` | `assurer-site:staging`, built from the root `Dockerfile` plus `docker/staging/Dockerfile` | Apostrophe (`APOS_CLUSTER_PROCESSES`, default 2), MongoDB with `requireTLS`, `pbm-agent`, the base-backup schedule | **none** |
| `nginx` | `assurer-nginx:staging`, official `nginx:1.30.6-alpine` (digest pinned) plus zlib 1.4, without the xslt and njs modules and `libxml2` | TLS, HTTP redirect, upload limit, rate limit | `80`, `443` |
| `certbot` | `assurer-certbot:staging`, official `certbot/certbot:v5.9.0` (digest pinned) plus zlib 1.4 | certificate renewal | none |
| `cert-bootstrap` (one-off) | the site image | a 30-day self-signed certificate if none exists, so nginx can start | none |

nginx reaches the site on the `edge` Compose network (`172.30.55.0/24` by default; change
`ASSURER_EDGE_SUBNET` and `ASSURER_NGINX_IP` together if that range is taken). The app trusts the
`X-Forwarded-*` headers from nginx's fixed address only.

Volumes: `mongo-data`, `secrets`, `uploads`, `app-data`, `backups` (site); `certs`, `acme-webroot`
(nginx and certbot). They live under Docker's data directory, which must be on the encrypted data
volume (hardening runbook §5, §7).

## 2. Settings

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `ASSURER_DOMAIN` | shell or `docker/staging/.env` | required | host name, for example `staging.example.org` |
| `APOS_BASE_URL` | shell or `docker/staging/.env` | required | `https://` plus the host name, no trailing slash |
| `APOS_CLUSTER_PROCESSES` | same | `2` | Node web processes (m1-054: 2 doubles the headroom for about 0.6 GiB) |
| `ASSURER_MONGO_CACHE_GB` | same | `1` | MongoDB cache; size it with the processes against the server's memory |
| `APOS_HSTS_MAX_AGE` | same | `300` | raise once HTTPS is confirmed (hardening runbook §8 point 4) |
| `ASSURER_BACKUP_INTERVAL_HOURS`, `ASSURER_BACKUP_RETENTION` | same | `24`, `8d` | PBM base backups ([PBM runbook](./pbm-backup-and-restore.md) §1) |
| `ASSURER_MAX_BODY`, `ASSURER_RATE_LIMIT`, `ASSURER_RATE_BURST` | same | `32m`, `30r/s`, `60` | nginx upload limit and per-address rate limit |
| `ASSURER_HTTP_BIND`, `ASSURER_HTTPS_BIND` | same | `80`, `443` | host ports, on all network interfaces by default; **set `127.0.0.1:80` and `127.0.0.1:443` for a local test**, so the site is not open to the local network (m1-058) |
| SMTP and form settings | `docker/staging/site.env`, mode `0600`, git-ignored | none | as in [form operations](./form-operations-and-privacy.md) |

The image sets `NODE_ENV=production` and `APOS_DEMO_SITE=0`. Compose sets `APOS_HTTPS=1` and
`APOS_TRUST_PROXY`. Never set `APOS_ALLOW_INDEXING` on staging.

## 3. First start

```sh
S="docker compose -f docker/staging/compose.yaml"
$S build                         # or pull the images built for the release
$S up -d                         # site, cert-bootstrap, nginx, certbot
$S logs -f site                  # wait for "Started (site mode, ...)"
```

The first start takes a few minutes and creates, in the `secrets` volume: the database passwords,
the key file, the session secret, the MongoDB TLS certificate (the CA key is deleted) and a random
password for the `admin` account. No demo content is loaded.

**First admin login.** Read the password once, log in at `$APOS_BASE_URL/login` as `admin`, change
the password in the admin UI, then delete the file:

```sh
$S exec site cat /data/secrets/admin-initial-password
$S exec site rm /data/secrets/admin-initial-password
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
$S logs -f site                  # app, MongoDB, PBM schedule
$S restart site                  # restart the site; data stays
$S up -d --build                 # release: rebuild, recreate what changed, migrations run first
```

**Never run `$S down -v`**: it deletes the database, media, secrets, local backups and
certificates for good.

## 5. Checks after a start

```sh
curl -sI http://$ASSURER_DOMAIN/            # 301 to https
curl -sI https://$ASSURER_DOMAIN/           # 200, Strict-Transport-Security, no Server version
$S exec site pbmc status                    # agent running, PITR on
```

Then the hardening runbook §11 checks.

## 6. Rotating secrets

- **Admin account:** in the admin UI.
- **Session secret:** replace `/data/secrets/session-secret` with a new random hex value and restart
  the site; every user is logged out.
- **Database passwords** (`assurerApp`, `pbm`): change the user's password as `siteAdmin` in
  `mongosh` inside the container, write the same value to the matching file in `/data/secrets`, then
  restart the site. Take a base backup after the change, because a restore needs the passwords that
  were current when its backup was taken.
- **MongoDB TLS certificate:** delete `/data/secrets/tls/` and restart the site; a new CA and
  certificate are made.

## 7. Known limits

- **MongoDB 8.0 refuses Linux kernels 6.19 to 7.0.13, on any CPU** (m1-058, SERVER-121912): the site
  container restarts in a loop, the log shows `[assurer] MongoDB did not start`, and MongoDB's own line
  says `MongoDB cannot start: Linux kernel versions 6.19 and newer ...`. The kernel belongs to the host,
  so check `uname -r` before starting, and after any kernel or Docker Desktop update. MongoDB's fix is
  kernel 7.0.14 or later, but Ubuntu reports its 7.0 kernels as `7.0.0-<ABI>`, and the exemption for
  them comes only in the upcoming 8.0.37 (SERVER-131779), so 8.0.34 refuses every Ubuntu 7.0 kernel.
  D-DB-16 (decided m1-059): servers stay on Ubuntu 24.04's 6.8 kernel line; see the hardening runbook
  §4.
- A build needs a lot of memory on a PC: `amd64` fell from 6.5 GB available to 137 MB in m1-058, even
  with most steps cached. `arm64` under emulation was not tried there; use the hosted workflow
  (`.github/workflows/staging-arm64.yml`). It also leaves the three images as a one-day artifact
  for a scan (`docker scout cves archive://<file>.tar`, m1-060).
- The PBM backups are on the same server ([PBM runbook](./pbm-backup-and-restore.md)).
- No alert on backup status, certificate renewal or the site (hardening runbook §12 choice 8, not
  chosen yet).
- One container puts the app and MongoDB on one failure and update cycle (ADR-0004, Negative).
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

## 9. NPM mode (shared host, D-DB-17 option B)

For a host where Nginx Proxy Manager (NPM) already owns ports 80 and 443, such as the owner's OCI
server. Real staging and production use the standalone mode above (D-DB-17 option A). Design:
[m1-061 paper](../milestones/m1-061-npm-proxy-design.md) §4. Built and tested locally in `m1-062`
against a stand-in for NPM, not against NPM itself (§8).

```
 Internet ──► :80/:443 NPM ──assurer-npm (172.30.56.0/24)──► nginx :8080 ──edge──► site:3000
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
$S up -d                         # site, cert-bootstrap, nginx; no certbot
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
