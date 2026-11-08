# Runbook: the staging stack (one site container, nginx, certbot)

| | |
|---|---|
| **Status** | **Draft; built and run on the owner's PC only** (`m1-055`, 2026-11-08, agent-executed): see §8 for what was run and what was not. Not run on a server. Running it on a server needs the owner's approval (D-DB-2, D-DB-3, D-DB-7 and the server task) |
| **Purpose** | The staging version of the one-container image (ADR-0004 Decision 2, D-DB-10 (b)): app and MongoDB 8.0.34 in one container with TLS, member authentication, PBM, no demo content and no default password; nginx and certbot in their own containers |
| **Not for** | Production as it stands: production needs x.509 member authentication (hardening runbook §12 choice 2), the S3 backup storage (D-DB-12) and `APOS_ALLOW_INDEXING=1` |
| **Files** | [`docker/staging/`](../../docker/staging/): `compose.yaml`, `Dockerfile`, `entrypoint.sh`, `mongod.conf`, `pbm-config.yaml`, `pbmc.sh`, `nginx/`, `certbot/` |
| **Related** | [hardening runbook](./server-hardening-and-patching.md) §6–§8 · [PBM runbook](./pbm-backup-and-restore.md) · [HTTP security and HTTPS proxy](./security-configuration.md) · [demo container](./docker-single-container.md) · [m1-054 cluster results](../milestones/m1-054-cluster-mode-results.md) |

## 1. Layout

| Container | Image | Holds | Host ports |
|---|---|---|---|
| `site` | `assurer-site:staging`, built from the root `Dockerfile` plus `docker/staging/Dockerfile` | Apostrophe (`APOS_CLUSTER_PROCESSES`, default 2), MongoDB with `requireTLS`, `pbm-agent`, the base-backup schedule | **none** |
| `nginx` | `assurer-nginx:staging`, official `nginx:1.30.6-alpine` (digest pinned) plus zlib 1.4 | TLS, HTTP redirect, upload limit, rate limit | `80`, `443` |
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
| `ASSURER_HTTP_BIND`, `ASSURER_HTTPS_BIND` | same | `80`, `443` | host ports; `127.0.0.1:8080` and so on for a local test |
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

- The PBM backups are on the same server ([PBM runbook](./pbm-backup-and-restore.md)).
- No alert on backup status, certificate renewal or the site (hardening runbook §12 choice 8, not
  chosen yet).
- One container puts the app and MongoDB on one failure and update cycle (ADR-0004, Negative).
- The self-signed certificate from `cert-bootstrap` lasts 30 days; if no real certificate is issued
  by then, browsers and nginx keep using an expired one.

## 8. Verification

Agent-executed on the owner's PC (`linux/amd64`, Docker Desktop), 2026-11-08, under a disposable
project on `127.0.0.1`. Full results: [m1-055 report](../engineering/reports/2026/11/2026-11-08-m1-055-staging-image.report.md).

| Check | Result |
|---|---|
| First start with no demo content or demo notice; `admin`/`admin` refused; the random password logs in; no secret value in the site log | PASS |
| HTTP redirect; HTTPS with HSTS and `Secure` cookies; other host names refused; 34 MB upload refused (413); rate limit (429), recovering within 3 s | PASS |
| MongoDB refuses non-TLS, unauthenticated and untrusted-CA clients; `assurerApp` limited to its database; `$where` refused; no CA key on disk; secrets unreadable by the app and `pbm` users except `ca.pem` | PASS |
| Smoke 18/18, workflow 15/15, persistence 7/7 through nginx, after seeding demo content and setting `APOS_DEMO_SITE=1` for the test only | PASS |
| One web process killed (no failed request of 20, replaced); `pbm-agent` killed (restarted, site up) | PASS |
| certbot `renew` with no certificate, deploy hook with a test certificate, nginx reload | PASS |
| Editor in Chrome: login, in-context edit, draft hidden, publish public | PASS, **bypassing nginx with `APOS_HTTPS=0`** |
| Editor in Chrome through nginx over HTTPS | **BLOCKED**: Chrome's warning for the self-signed certificate was not bypassed |
| Accepted upload through nginx, file served back complete | **NOT VERIFIED**: the upload call ran, but the download check was invalid |
| `linux/arm64` | **NOT TESTED**: the build was stopped because the PC ran low on memory |
| A real Let's Encrypt certificate, first issuance and renewal; a server; §6 rotation; a clean run of the `$S` commands as written (the test used its own project name and ports) | NOT TESTED |
