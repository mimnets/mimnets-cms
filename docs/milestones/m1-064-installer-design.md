# m1-064: an interactive installer for the stack on a server (design)

| | |
|---|---|
| **Task** | m1-064 |
| **Date** | 2026-11-10 |
| **Author** | The agent (agent-executed; not a human approval) |
| **Status** | **D-DB-18 decided 2026-11-10 by the owner: approved as written** ("Approve as written (Recommended)"). Built in m1-064 as `docker/staging/install.sh` (runbook §10); not run on a server |
| **Related** | D-DB-16 · D-DB-17 (amended m1-063) · D-DB-12 · [staging container runbook](../runbooks/staging-container.md) §3, §5, §9 to §9.3 · [m1-061 paper](m1-061-npm-proxy-design.md) §6 · [m1-063 report](../engineering/reports/2026/11/2026-11-10-m1-063-oci-npm-test.report.md) · [m1-064 handoff](m1-064-handoff.md) §2 item 1 |

This is a paper task. No server and no container were used. The facts about the stack come from
`docker/staging/` on `origin/main` (`4544d1d`).

## 1. The request

The owner's words (m1-063): "build and ship and continue to main and then we will check during docker
installton with the production ... after docker setup successfully and then in the local or public ip
we will continue the rest ngnix and domain setup interactively ... it will give me command for nginx
and rest with command into terminal".

So: **one script, run on the server from the clone of `main`**. It builds and starts the stack and
checks it. Then it guides the owner, one step at a time, through the address check, the proxy route,
the domain, the certificate and the final checks. At each step it shows the exact command or UI
setting, waits for the owner, and then checks the result.

## 2. Summary of the design

- **New file:** `docker/staging/install.sh`, Bash, with no new dependency. It uses only what
  `npm-setup.sh` and `host-facts.sh` already use (`docker`, `docker compose`, `ss`, `sed`, `grep`,
  `awk`), plus `curl`, `getent` and `openssl`, which Ubuntu installs by default.
- **Two routes, both already built:** A, standalone: the stack's nginx owns ports 80 and 443 and
  certbot issues the certificate (`compose.yaml`; D-DB-17 A). B, behind NPM: the stack publishes no
  port and NPM issues the certificate (`compose.yaml` plus `compose.npm.yaml`; D-DB-17 B). The script
  finds which route the host allows and recommends that route.
- **Route B reuses `npm-setup.sh` without changes.** That script is already tested on the OCI server,
  so the installer calls it and does not copy its logic.
- **What the script does itself:** it changes only the stack. It writes `docker/staging/.env`,
  creates the `assurer-npm` network, builds the images, starts the stack and runs certbot in the
  stack's own container.
- **What the script only shows:** changes outside the stack. It never changes NPM, Portainer,
  Cloudflare, the OCI console, the host firewall, packages or the kernel. For each of these it shows
  the command or UI setting, and the owner makes the change. The handoff §3 gates still apply.
- **It does not make the stack production-ready.** The stack is still the staging build. The
  production items in runbook §9.2 (x.509, off-server backups, indexing, HSTS, SMTP, a restore
  drill) stay open, and each one remains its own approved task. The script lists them at the end as
  open (§5).

## 3. How each step works

Each step uses the same five parts:

1. **Explain:** what the step is for, in two or three lines.
2. **Show:** the exact command, or the UI path and its values. Values come from `.env` and earlier
   answers, so the owner can copy them as they are.
3. **Ask:** `[r]un` (only for commands on the stack itself), `[d]one` (the owner made the change),
   `[s]kip` or `[q]uit`.
4. **Check:** a read-only test of the result, such as an HTTP status, a DNS answer or a
   `docker inspect` field.
5. **Report:** `PASS` or `FAIL` with the actual value. After a `FAIL` the owner can retry, skip or
   quit.

**Running it again.** The script keeps no state file. Each step first checks whether its work is
already done, and if so it says so and moves on, so running the script again is safe.
`--step <name>` starts at one step. `--check` runs only the final checks (step 8).

**Input and log.** Answers are read from the terminal (`/dev/tty`). Without a terminal the script
stops, except with `--check`. Everything shown on screen also goes to
`/root/assurer-install-<date>.log`, with mode `0600`, outside the clone. The script never reads or
prints the admin password. It only shows the command that reads the password (runbook §3).

## 4. The steps

| # | Step | The script itself (on the stack only) | The owner, from shown commands or UI settings | The check |
|---|---|---|---|---|
| 0 | **Host checks** (read-only) | Kernel on the 6.8 line (D-DB-16); Compose 2.24 or later; `arm64` or `amd64`; free disk and memory; the clone is on `main`, clean and level with `origin/main`; which process owns ports 80, 81 and 443; whether an NPM container (`jc21/nginx-proxy-manager`) runs; existing `assurer` containers | — | Stops on the kernel or Compose, as `npm-setup.sh` does. A warning on the branch or a dirty clone |
| 1 | **Choose the route** | Recommends B if NPM or another process owns 80 or 443, and A if both ports are free. Writes `ASSURER_PROXY_MODE=standalone` or `npm` to `.env` | Confirms the route | If `.env` already names the other route, the script stops: switching a stack with content is not tested (runbook §9) |
| 2 | **Settings** | Writes `.env` once, with mode `0600`: domain (it can stay the placeholder `assurer.invalid` until step 6); for A, the address for Let's Encrypt; workers and MongoDB cache sized from the server's memory (runbook §2). Before it changes any existing value, it shows the change and asks | Answers the questions | `.env` is readable by the owner only, and the domain is in lower case |
| 3 | **Build and start** | A: `docker compose -f compose.yaml build` and `up -d`. B: `bash docker/staging/npm-setup.sh` | — | `site` is healthy. A: two host ports. B: no host port |
| 4 | **Check on the server** | A: `curl -k --resolve <domain>:443:127.0.0.1` gives 200, and port 80 gives a 301 redirect. B: a 200 on nginx's port 8080, as in `npm-setup.sh` | Reads the first admin password with the shown command, and changes it after step 7 | PASS or FAIL with the status |
| 5 | **Check on the public address** (A only; it can be skipped) | Asks for the server's public IPv4 | From the PC: `curl.exe -skI --resolve <domain>:443:<ip> https://<domain>/`, and the same on port 80. If this fails: the OCI console path for the security list (ingress TCP 80 and 443). Docker's published ports pass through Docker's own `iptables` chains, not the host's `INPUT` rules, so the script shows `iptables -S DOCKER-USER` (read-only) instead of `INPUT` rules. Corrected during the build (m1-064); the first draft named `iptables -S INPUT` | The PC result as the owner reports it. The certificate is still self-signed here. In B nothing is published, so this step does not apply |
| 6 | **Domain and Cloudflare** | When the domain changes: A: updates `.env` and runs `up -d`. B: `npm-setup.sh --domain <name>` | The Cloudflare record, as in runbook §9.1 A (an `A` record, **DNS only**, no `AAAA` without IPv6) | `getent ahostsv4 <domain>` gives the public address. An address in Cloudflare's ranges means the record is proxied (orange cloud): `FAIL` |
| 7A | **Certificate, standalone** | certbot from runbook §3, first with `--test-cert`, then the real certificate; `nginx -s reload` | — | `openssl s_client` shows the issuer. The staging issuer first, then the real one |
| 7B | **NPM changes and proxy host** | — | (a) The backup: copy the stack text from Portainer, and run `docker cp` for NPM's `/data` and `/etc/letsencrypt` after `docker inspect` shows the mounts (the m1-063 open item). (b) The lines to paste into NPM's stack in Portainer: join `assurer-npm` at `172.30.56.2`, `IP_RANGES_FETCH_ENABLED=false`, port 81 on `127.0.0.1`. Updating the stack recreates NPM, and every site behind NPM is down for a moment. (c) The proxy-host settings from runbook §9, step 3 | Read-only: NPM is on `assurer-npm` at `172.30.56.2`; the variable is `false`; port 81 is bound to `127.0.0.1`; `curl -sI https://<domain>/` gives 200 with a Let's Encrypt issuer |
| 8 | **Final checks** (paper §6, runbook §5) | From the server: redirect to HTTPS; 200; `Strict-Transport-Security` sent once; `Secure` session cookie; no `Server` version; 413 for a 34 MB body; `pbmc status` | From the PC, the shown commands with a random marker, such as `?check=7f3a`: a normal request, and one with a forged `X-Real-IP: 203.0.113.9`. For B, also `Test-NetConnection <ip> -Port 81` | The script finds the marker in nginx's log and shows the logged address, which must be the PC's and not `172.x` (paper §6 checks 3 and 4). Port 81 is closed. Per-visitor 429 (check 5) needs two outside addresses and is shown as a manual step |
| 9 | **Summary** | A table of PASS, FAIL and SKIPPED for each step; the open production items (§5); where the log is | — | — |

Chrome as an editor (paper §6 check 8) is not part of the script. The agent runs it in the build task,
with the owner's approval for the public host name.

## 5. Production and the gates

- The script does not set `APOS_ALLOW_INDEXING`. It does not raise `APOS_HSTS_MAX_AGE` above 300, and
  it does not change the backup storage. Step 9 lists these items, from runbook §9.2, as **open**:
  x.509 member authentication; PBM S3 backups off the server (D-DB-12, which needs an account and
  spending); `APOS_ALLOW_INDEXING=1`; HSTS raised; SMTP in `site.env`; a restore drill on a copy; the
  per-visitor checks passed. Each item later adds its own step to the script, in its own approved
  task.
- When the owner runs the script and answers `[r]un` at a step, that is the owner's approval for
  that one step on the stack. The script makes no change outside the stack, so every change to NPM,
  Portainer, Cloudflare, the firewall or the OCI console is made by the owner's own hand, as the
  handoff §3 requires.
- Route A on the OCI server is not possible while NPM owns ports 80 and 443. The script says so in
  step 1 and recommends B.

## 6. The build task, if approved

| Part | Content |
|---|---|
| Files | New `docker/staging/install.sh`. A new runbook §10 "Interactive install" with the steps above. Status and Files lines in the runbook. `npm-setup.sh` and `host-facts.sh` stay unchanged |
| Local tests (agent, owner's PC) | `bash -n`; route A and route B in disposable projects. Ports go to `127.0.0.1` through `ASSURER_HTTP_BIND`/`ASSURER_HTTPS_BIND`, and the kernel check is removed only in a temporary copy, as in m1-063. Running again, `--step`, `--check`, a refused route switch and a refused bad domain. A throwaway nginx stands in for NPM in step 7B's read-only checks. The usual lint and suites |
| Server run (owner) | On the OCI server, route B, one step at a time, with the output pasted in the session. Each change to NPM, Portainer or Cloudflare needs the owner's approval, as in m1-063. Chrome as an editor through the public host name needs the owner's approval |
| Not covered | Route A on a real server (no server without NPM yet); IPv6; Cloudflare's proxy (orange cloud), which needs its own design (runbook §9.1 A, point 4) |

## 7. Open points for the build

- **NPM and Let's Encrypt's staging service.** Runbook §9.2 says "staging certificate first", but
  NPM's proxy-host UI may not offer the staging service. The build task checks this in NPM's source.
  If NPM has no such option, step 7B issues the real certificate directly, within Let's Encrypt's
  rate limits. **Build (m1-064):** NPM 2.15.1 has no such option; its only switch, `LE_STAGING`, is
  for the whole container (`backend/lib/config.js`). Step 7B issues the real certificate (runbook §10).
- **certbot, from the staging certificate to the real one.** The exact flags, which may include
  `--force-renewal`, are tested locally against Let's Encrypt's staging service where possible, and
  noted where not. **Build (m1-064):** `--force-renewal`; not run, as Let's Encrypt needs a public
  host name (m1-064 report).
- **Where NPM keeps `/etc/letsencrypt`** is still not known (m1-063). Step 7B(a) shows the mounts
  first, and the backup follows what those mounts show. **Build (m1-064):** done as written; still
  unknown on the server.

## 8. Decision for the owner: D-DB-18

**Approve this design for the build task?**

- **A. Approve as written (recommended).** One script with two routes. Route B reuses
  `npm-setup.sh`. The script changes only the stack, and shows every other change for the owner to
  make. No state file. Production items are listed as open, not done.
- **B. Approve with changes,** named by the owner.
- **C. Not now.**
