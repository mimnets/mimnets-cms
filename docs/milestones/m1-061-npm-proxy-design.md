# m1-061: the staging stack behind Nginx Proxy Manager (design)

| | |
|---|---|
| **Task** | m1-061 |
| **Date** | 2026-11-10 |
| **Author** | The agent (agent-executed; not a human approval) |
| **Status** | **D-DB-17 decided 2026-11-10 by the owner: A for real staging and production, B (this design) for shared hosts.** The design itself is not built or tested |
| **Related** | D-DB-17 (new) · D-DB-2 · D-DB-3 · D-DB-7 · D-DB-16 · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [staging container runbook](../runbooks/staging-container.md) · [HTTP security and HTTPS proxy](../runbooks/security-configuration.md) · [hardening runbook](../runbooks/server-hardening-and-patching.md) §8 · [m1-061 handoff](m1-061-handoff.md) §1 |

This is a paper task. No server and no container were used. The facts about Nginx Proxy Manager (NPM)
come from its source at tag `v2.16.0` (the latest release, 2026-09-24, MIT licence), read on
2026-11-10. The facts about this stack come from `docker/staging/` on `origin/main` (`65e8f6b`).

## 1. Summary

- **The problem.** The owner's OCI server already runs NPM on ports 80, 81 and 443. The staging stack's
  own nginx also wants 80 and 443. Only one of them can own those ports.
- **Two defects appear if NPM is simply put in front.** (1) The stack's nginx and the app would see
  NPM's address for every visitor. The nginx rate limit (30 requests a second per address) and the
  app's contact-form limit (10 per 15 minutes per address) would then apply to **all visitors
  together**, and the logs would lose the visitor's address. (2) NPM cannot reach the stack's HTTPS
  port as it stands. NPM sends no SNI to its upstream, and the stack's nginx refuses a TLS handshake
  without the site's name (`ssl_reject_handshake on`).
- **Recommended design (§4):** a dedicated Docker network between NPM and the stack's nginx, plain HTTP
  on that one hop to a new internal-only nginx port, `real_ip` in the stack's nginx that trusts NPM's
  fixed address only, and **NPM issues the certificate**. The stack then publishes no host port. The
  app's `APOS_TRUST_PROXY` does not change.
- **Two NPM settings are part of the design:** `IP_RANGES_FETCH_ENABLED=false`, and the admin port 81
  not reachable from the internet. Without the first, anyone who routes a request through Cloudflare
  or CloudFront can choose the address the site sees (§3.3).
- **For the real staging server, the recommendation is still no NPM** (D-DB-17 option A): the owner's
  preference is a dedicated Hetzner server (D-DB-2, D-DB-7), where the stack's nginx owns 80 and 443 as
  designed and tested. This design is for a shared host such as the OCI server.

## 2. The stack today

```
 Internet ──► :80/:443 nginx (stack) ──edge network──► site:3000 (Apostrophe + MongoDB)
                 │  TLS (certbot, HTTP-01 on :80)
                 │  limit_req per $binary_remote_addr, client_max_body_size 32m
                 │  X-Forwarded-For = $remote_addr, X-Forwarded-Proto = https
                 └─ any other host name: 444 on :80, handshake refused on :443
```

| Point | Where | What it does |
|---|---|---|
| Ports | `compose.yaml`, `nginx.ports` | `${ASSURER_HTTP_BIND:-80}:80`, `${ASSURER_HTTPS_BIND:-443}:443` |
| App trust | `compose.yaml`, `site.environment` | `APOS_TRUST_PROXY` = nginx's fixed address `172.30.55.10` only |
| Rate limit | `nginx/assurer.conf.template` | `limit_req_zone $binary_remote_addr`, `${ASSURER_RATE_LIMIT}` (30r/s), burst 60 |
| Client address to the app | same | `proxy_set_header X-Forwarded-For $remote_addr` (nginx is the first hop) |
| Unknown host names | same | `listen 443 ssl default_server; ssl_reject_handshake on;` and `return 444` on 80 |
| Certificate | `certbot` service | `certbot renew --webroot` twice a day; the first one by hand, HTTP-01 on port 80 |
| Form limit | `modules/assurer-security` | per `req.ip`, which only honours `X-Forwarded-For` from `APOS_TRUST_PROXY` |

## 3. What NPM does (v2.16.0 source)

### 3.1 Forwarding

Every proxy host uses `conf.d/include/proxy.conf`:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Scheme $x_forwarded_scheme;
proxy_set_header X-Forwarded-Proto  $x_forwarded_proto;
proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP          $remote_addr;
proxy_pass       $forward_scheme://$server:$port$request_uri;
```

- `Host` is the public name, so the stack's `server_name ${ASSURER_DOMAIN}` matches.
- `X-Forwarded-For` **appends** to whatever the visitor sent. `X-Real-IP` is NPM's own `$remote_addr`,
  after NPM's `real_ip` step (§3.3).
- `X-Forwarded-Proto` passes on a visitor's `http` or `https` value unchanged (a `map` in
  `nginx.conf`). The stack's nginx overwrites it with `https`, so this does not reach the app.

### 3.2 Upstream TLS

NPM's templates set no `proxy_ssl_*` directive, so nginx's defaults apply: no SNI to the upstream
(`proxy_ssl_server_name off`) and no certificate check (`proxy_ssl_verify off`). Forwarding to the
stack's port 443 therefore fails at the handshake, unless the NPM host gets this in its "Advanced"
box:

```nginx
proxy_ssl_server_name on;
proxy_ssl_name $host;
```

Even then the hop is encrypted but not authenticated, because the stack's certificate is the 30-day
self-signed one from `cert-bootstrap` and NPM does not check it.

### 3.3 NPM's own `real_ip`

`nginx.conf` sets:

```nginx
set_real_ip_from 10.0.0.0/8;
set_real_ip_from 172.16.0.0/12; # Includes Docker subnet
set_real_ip_from 192.168.0.0/16;
include conf.d/include/ip_ranges[.]conf;   # Cloudflare and CloudFront, fetched by NPM
real_ip_header X-Real-IP;
real_ip_recursive on;
```

So NPM **accepts a visitor's `X-Real-IP` header** when the connection comes from a private address
or from a Cloudflare or CloudFront range. CloudFront and Cloudflare Workers are open to anyone, so a
visitor can route requests through them and choose the address NPM reports. NPM fetches those ranges
unless `IP_RANGES_FETCH_ENABLED=false` (`backend/index.js`). The private ranges matter if visitors'
connections reach NPM from a private address, which happens when Docker's userland proxy handles the
published port instead of its NAT rules (§6, check 3).

### 3.4 Other defaults

| Setting | NPM | Stack's nginx | Effect |
|---|---|---|---|
| `client_max_body_size` | `2000m` | `32m` | the stack's limit still applies |
| `proxy_read_timeout`, `proxy_send_timeout` | `90s` | `120s` | a request is cut at 90 s; raise in NPM's "Advanced" box only if needed |
| Ports | 80, 443 public; **81 admin UI** | — | port 81 must not be reachable from the internet |
| Certificates | Let's Encrypt, HTTP-01 on its port 80, or DNS-01; renewed by NPM | certbot, HTTP-01 | only one of them can answer HTTP-01 for the name |
| HSTS | per host, off by default | the app sends it (`APOS_HSTS_MAX_AGE`) | leave NPM's off, so the header is not sent twice |

## 4. Recommended design

```
 Internet ──► :80/:443 NPM (owner's) ──assurer-npm network──► nginx (stack) :8080 ──edge──► site:3000
                 │ TLS, Let's Encrypt            172.30.56.0/24        │ real_ip from NPM only
                 │ Force SSL, HTTP/2             NPM 172.30.56.2       │ limit_req, 32m, Host check
                 │ X-Real-IP = visitor                                 │ X-Forwarded-For = visitor
                                                                       │ X-Forwarded-Proto = https
```

### 4.1 Network path: a dedicated Docker network

| Option | How | Verdict |
|---|---|---|
| **N1. Host port** | Stack's nginx publishes a port; NPM forwards to the host | **No.** `127.0.0.1:8443` is not reachable from inside NPM's container (its `127.0.0.1` is itself). Binding the Docker gateway address instead publishes a port, and Docker's published ports bypass the host firewall (m1-041) |
| **N2. Shared network (recommended)** | An external network `assurer-npm` with a fixed subnet; NPM and the stack's nginx both join it, each with a fixed address; NPM forwards to `assurer-nginx:8080` | Nothing published by the stack; the only route in is through NPM. Needs one change to the owner's NPM Compose file (join the network) |
| **N3. NPM straight to the site** | NPM forwards to `site:3000` | **No.** Loses the rate limit, the upload limit and the host-name check, and the app would have to trust NPM |

The network carries only NPM and the stack's nginx. It should not be NPM's general network shared with
the owner's other containers, because §4.3 trusts one address on it.

### 4.2 The hop: plain HTTP to an internal port

| Option | How | Verdict |
|---|---|---|
| **H1. HTTP to `:8080` (recommended)** | A new `server` block in the stack's nginx, `listen 8080`, not published, same `location /` as the 443 block, plus §4.3 | The hop never leaves the host's bridge network. Nothing to configure in NPM's "Advanced" box; no certificate on the hop to expire |
| H2. HTTPS to `:443` | NPM's "Advanced" box gets `proxy_ssl_server_name on; proxy_ssl_name $host;` (§3.2) | Encrypts the hop but does not authenticate it. Puts part of the site's setup in NPM's database, outside Git |

With H1, the existing `:80` and `:443` blocks stay in the template for the standalone mode (D-DB-17
option A) and are simply not published in NPM mode.

### 4.3 The visitor's address: `real_ip` from NPM only

In the stack's nginx, for the `:8080` block only:

```nginx
set_real_ip_from ${ASSURER_UPSTREAM_PROXY_IP};   # NPM's fixed address on assurer-npm
real_ip_header X-Real-IP;
```

- `X-Real-IP` is what NPM decided the visitor's address is (§3.1). The stack inherits NPM's decision,
  so NPM's trust list (§3.3) becomes part of this site's trust list.
- After that step, `$remote_addr` and `$binary_remote_addr` are the visitor's address. The existing
  `limit_req` and `proxy_set_header X-Forwarded-For $remote_addr` then work per visitor with no other
  change, and so does the app's form limit, because the app still trusts only the stack's nginx.
- `ngx_http_realip_module` is in the stack's nginx image (`nginx -V` on `assurer-nginx:staging` shows `--with-http_realip_module`, checked 2026-11-10); no new module or image.
- A request that reaches `:8080` from any other address keeps that address. Nothing else is on the
  network (§4.1).

**`APOS_TRUST_PROXY` does not change** (stack's nginx only). The app never trusts NPM directly.

### 4.4 The certificate: NPM issues it

| Option | Verdict |
|---|---|
| **C1. NPM (recommended)** | NPM already owns port 80 and renews by itself. The stack's `certbot` service is not started in NPM mode |
| C2. The stack's certbot | Needs HTTP-01 on port 80, which NPM owns. NPM could forward `/.well-known/acme-challenge/` to the stack, but the certificate would then sit in the stack's nginx, which no longer terminates the public TLS (NPM has no TLS passthrough on a shared port 443). No use |
| C3. DNS-01 in the stack's certbot | A DNS provider plugin and an API token. A new dependency and a new secret, for no gain over C1 |

Consequences of C1, for the owner to accept:

- The certificate's private key lives in NPM's data volume, outside the stack's `certs` volume and
  outside its backups. Losing it costs a reissue, nothing more.
- Whoever can log in to NPM's admin UI can change or remove the site's TLS and forwarding. Keep port
  81 closed to the internet (an SSH tunnel to it is enough) and the NPM admin password out of Git.
- NPM settings for the host: Force SSL **on**, HTTP/2 **on**, HSTS **off** (the app sends it),
  WebSocket support **off** (the site does not use it), Cache Assets **off**. Block Common Exploits
  is untested with Apostrophe: off for the first test, then try it on.

## 5. Changes this would need (not made)

| File | Change |
|---|---|
| `docker/staging/compose.npm.yaml` (new) | An override used with `-f compose.yaml -f compose.npm.yaml`: `nginx.ports: !reset []`; nginx joins the external `assurer-npm` network with a fixed address; `ASSURER_UPSTREAM_PROXY_IP` passed to nginx; `certbot` moved to a profile, so it does not start. `!reset` needs a recent Compose v2; the first version that supports it is not confirmed here (this PC has v5.7.0), so check it on the server |
| `docker/staging/nginx/` | The `:8080` block of §4.2 and §4.3, rendered only in NPM mode: either a second template the image renders when `ASSURER_UPSTREAM_PROXY_IP` is set, or one template the override mounts. To choose in the build task |
| Owner's NPM Compose file | Join `assurer-npm` with a fixed address; `IP_RANGES_FETCH_ENABLED=false`. **The owner's file, the owner's change** |
| NPM admin UI | The proxy host of §4.4, forward to `http://<stack nginx name or address>:8080` |
| `docs/runbooks/staging-container.md` | An "NPM mode" section: start, checks, the cases where `ASSURER_HTTP_BIND` and certbot do not apply |

No new image, package or tool for this stack. NPM itself is the owner's, already running, but putting
it in the site's path is a tool approval (§7).

## 6. Checks for the test task

Run on a disposable stack, with the owner's approval for the server (handoff §3), kernel first
(D-DB-16). Each one is NOT TESTED until it runs.

1. `uname -r` is on the 6.8 line; `docker compose version` accepts `!reset` (`docker compose -f compose.yaml -f compose.npm.yaml config` shows no `ports` on nginx).
2. Nothing of the stack is published: `docker ps` shows no host port for `nginx` or `site`.
3. **The visitor's address reaches NPM.** From an outside address, one request; NPM's
   `/data/logs/proxy-host-<id>_access.log` and the stack's nginx log show that outside address, over
   IPv4 and, if the host has it, IPv6. If either shows a `172.x` address, Docker's userland proxy is in
   the path and the design must not go further until that is resolved.
4. **Spoofing is refused.** A request with `X-Real-IP: 203.0.113.9` and `X-Forwarded-For: 203.0.113.9`
   is logged under the real address, in NPM and the stack.
5. **Per-visitor limits.** A burst from one address gets 429 while a second address is still served;
   the form limit counts per address (security runbook, contact-form rate limit).
6. HTTP redirects to HTTPS (NPM); the certificate is the Let's Encrypt one (staging service first);
   `Strict-Transport-Security` is sent once; the session cookie is `Secure`; a 34 MB upload gets 413
   and a 5 MB upload passes intact.
7. Port 81 is not reachable from outside the host.
8. Chrome, as a non-admin editor, through NPM: login, edit, draft hidden, publish public, media
   upload, logged-out user sees no draft.

## 7. Decision for the owner: D-DB-17

**Where the staging stack's public entry is, when the host already runs a reverse proxy.**

| Option | Meaning |
|---|---|
| **A. No NPM (recommended for real staging and production)** | A dedicated server per environment (the owner's Hetzner preference, D-DB-2, D-DB-7); the stack's nginx owns 80 and 443, as built and tested |
| **B. Behind NPM, as §4 (recommended for a shared host)** | For the OCI server or any host where NPM already runs. Needs the changes of §5, the owner's NPM changes and the checks of §6 |
| C. NPM replaces the stack's nginx | NPM forwards straight to the site. Loses the rate limit, upload limit and host check; the app must trust NPM. Not recommended |

Choosing B approves no server use, no change to the owner's NPM and no build: each is its own step
with its own approval. Choosing B does not decide D-DB-2, D-DB-3 or D-DB-7.

## 8. Not established here

- How the owner's NPM is installed: its version, its networks, whether port 81 is open to the
  internet, whether it fetches the CDN ranges today.
- Whether visitors' addresses reach NPM on the OCI server (§6 check 3), on IPv4 and IPv6.
- Whether Block Common Exploits breaks any Apostrophe editor request.
- The Compose version on the OCI server.
