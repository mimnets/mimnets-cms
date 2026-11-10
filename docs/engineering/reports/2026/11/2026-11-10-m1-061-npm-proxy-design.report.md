# m1-061 — The staging stack behind Nginx Proxy Manager (design)

| | |
|---|---|
| **Task** | m1-061 |
| **Date** | 2026-11-10 |
| **Scope** | Candidate 2 of the handoff: a design paper for running the staging stack behind the owner's Nginx Proxy Manager (NPM). No server, image or code was changed |
| **Prompt** | [2026-11-10-m1-061-npm-proxy-design.prompt.md](../../../prompts/2026/11/2026-11-10-m1-061-npm-proxy-design.prompt.md) |
| **Handoff** | [m1-061 start handoff](../../../../milestones/m1-061-handoff.md) · next: [m1-062 handoff](../../../../milestones/m1-062-handoff.md) |
| **Branch / commits** | `docs/m1-061-npm-proxy-design`, from `origin/ci/m1-060-arm64-checks` (`0dc9ce2`) by the owner's choice: one commit with this report (D-GIT-59) |
| **Related** | D-DB-17 (new, decided) · D-DB-2 · D-DB-3 · D-DB-7 · D-DB-16 |

All checks below are **agent-executed**. They are not human approval.

## Status

**D-DB-17 is decided: A (no NPM, a dedicated server) for real staging and production, B (behind NPM,
the paper's §4 design) for shared hosts** (owner, 2026-11-10). The paper is
[m1-061-npm-proxy-design.md](../../../../milestones/m1-061-npm-proxy-design.md). **Nothing of B is built
or tested.**

## Findings

- **NPM in front, as it is, breaks the per-visitor limits.** The stack's nginx keys `limit_req` on
  `$binary_remote_addr` and passes `$remote_addr` to the app as the client. Behind NPM both are NPM's
  address, so all visitors share one 30 r/s bucket and one contact-form quota, and the logs lose the
  visitor's address.
- **NPM cannot reach the stack's port 443.** NPM's templates set no `proxy_ssl_*` directive, so it sends
  no SNI, and the stack's nginx refuses a handshake without the site's name (`ssl_reject_handshake on`).
- **NPM trusts `X-Real-IP` from Cloudflare and CloudFront ranges and from private ranges** (v2.16.0
  `nginx.conf`, `real_ip_recursive on`). Anyone can route through those CDNs and choose the address NPM
  reports. `IP_RANGES_FETCH_ENABLED=false` turns the CDN part off.
- **A loopback port is not reachable from NPM's container**, so the m1-060 loopback-port idea cannot be
  NPM's upstream. A shared Docker network is.
- **The m1-060 records commit `0dc9ce2` is not on `main`.** It was committed after PR #67 was merged
  (11:53 merge, 12:21 commit, +06:00). By the owner's choice, this branch starts from it, so the m1-061
  PR carries it.

## Changes

- New: the design paper, this report, the prompt record and the
  [m1-062 handoff](../../../../milestones/m1-062-handoff.md).
- Decision register: D-DB-17, decided.
- INDEX: the m1-061 row and the next free ID.
- Carried from `0dc9ce2` (unchanged): the m1-060 report, prompt, INDEX row, register change, runbook
  notes and m1-061 handoff.

## Sources

NPM `v2.16.0` (latest release, 2026-09-24, MIT), read on 2026-11-10:
`docker/rootfs/etc/nginx/nginx.conf`, `docker/rootfs/etc/nginx/conf.d/include/proxy.conf`,
`backend/templates/proxy_host.conf`, `backend/templates/_listen.conf`, `backend/index.js`,
`backend/internal/ip_ranges.js`. `nginx -V` on the local `assurer-nginx:staging` image shows
`--with-http_realip_module`.

## Tests executed and actual results

On the local SQLite site (`npm start` on `127.0.0.1:3000`, left running from m1-060):

| Check | Result |
|---|---|
| `npm run lint` | **PASS**, no output from ESLint |
| `npm run test:smoke` | **PASS**, 18/18 |
| `npm run test:workflow` | **PASS**, 15/15 |
| `npm run test:persistence` | **PASS**, 7/7, without a server restart |

## Browser checks (agent-executed, Claude in Chrome)

Docs-only task, so this was the short smoke check of the public site, logged out, at 1440 px.

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Home page | Opened `http://127.0.0.1:3000/` | Demo banner, header, nav and hero shown | PASS |
| Navigation | Clicked "Acceptance Test" in the nav | Page opened with breadcrumb and title; no console errors after the click (console read started after the home page load) | PASS |

No screenshots kept. Tablet and mobile widths were not checked, because no layout changed.

## Clean-up

- The agent's Chrome tab was closed. The local server was left running as it was found.
- No accounts or content were created, apart from what `test:workflow` creates and archives on every run.
- Nothing was changed on the owner's PC Docker setup, NPM or any server.

## Not done or not verified

- **Nothing of design B is built or tested** (paper §5, §6).
- Not established: the owner's NPM version, networks, whether port 81 is public, whether it fetches
  the CDN ranges; whether visitors' addresses reach NPM on the OCI server (Docker NAT or userland
  proxy, IPv4 and IPv6); Block Common Exploits with Apostrophe; the first Compose version that supports
  `!reset` (this PC: v5.7.0).
- The hosted checks of PR #67 were not read (`gh` not installed).
