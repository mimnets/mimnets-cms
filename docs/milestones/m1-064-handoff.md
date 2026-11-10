# m1-064 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-10, by the agent at the end of m1-063 (agent-executed; not a human approval) |
| **Task** | `m1-064`: an item the owner picks from §2 |
| **Preconditions** | The m1-063 PR is merged and its hosted checks are green, including `staging-arm64`, which runs because the PR touches `docker/staging/` |
| **Branch** | `<type>/m1-064-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-12, D-DB-16, D-DB-17 with its m1-063 amendment) · [m1-063 report](../engineering/reports/2026/11/2026-11-10-m1-063-oci-npm-test.report.md) · [staging container runbook](../runbooks/staging-container.md) §9 to §9.3 · [m1-061 paper](m1-061-npm-proxy-design.md) §6 |

## 1. Carry-over

- **The test stack on the owner's OCI server** (`assurer-staging`, NPM mode, `arm64`, Ubuntu 22.04,
  kernel `6.8.0-1049-oracle`) ran healthy and private. At the end of m1-063 the owner chose to remove it
  (runbook §9.3). **First confirm on the server that it is gone** (§9.3 step 6) and that the NPM backup
  with private keys is deleted. After the merge, the owner switches the clone to `main`
  (`git switch main && git pull`).
- **Not done:** NPM's changes (join `assurer-npm` at
  `172.30.56.2`, `IP_RANGES_FETCH_ENABLED=false`, port 81 on `127.0.0.1`), the proxy host, and paper §6
  checks 3 to 8. NPM is a Portainer stack: change it in Portainer, after copying the stack text and
  backing up NPM's `data` folder and certificates. Where NPM keeps `/etc/letsencrypt` is still unknown:
  check `docker inspect` mounts first (m1-063 report). A test host name with a DNS-only Cloudflare
  record exists (kept out of the records; the owner knows it).
- **D-DB-17 amended (owner, m1-063):** production may run on the OCI server first and move later.
  Before real visitors: runbook §9.2's list.
- A reboot moves the server to `6.8.0-1054-oracle`, still on the 6.8 line (D-DB-16).
- §9.3 also removes the demo container's volumes (`assurer_*`) from the owner's earlier
  `docker compose up -d`.

## 2. Candidate tasks

1. **The owner's request: an interactive installer for the production install.** Owner's words
   (m1-063): "build and ship and continue to main and then we will check during docker installton with
   the production ... after docker setup successfully and then in the local or public ip we will
   continue the rest ngnix and domain setup interactively ... it will give me command for nginx and
   rest with command into terminal". One script, run on the server, that builds and starts the stack
   and checks it, then offers, step by step: a check on the local or public address; the proxy route
   (standalone nginx, D-DB-17 A, or NPM, B); the domain and Cloudflare record; NPM's changes and proxy
   host, or certbot; the certificate; the checks. At each step it prints the exact command or UI
   setting, waits, and checks the result. Builds on `npm-setup.sh` and `host-facts.sh`. It must not
   change NPM, Portainer or Cloudflare by itself, and the production items of runbook §9.2 still
   apply. Needs a design the owner approves first (production is an architecture gate).
2. **Finish the OCI test behind NPM** (runbook §9.2 "Later", paper §6 checks 3 to 8). The owner picks
   the host name, adds the record and makes each NPM change, with approval for each; the agent writes
   the steps and records the checks. Chrome against the public host name needs the owner's approval.
3. **Production readiness on OCI** (D-DB-17 amendment): plan and order the §9.2 items (x.509 member
   authentication, off-server backups with PBM S3 (D-DB-12, needs an account and spending), indexing,
   HSTS, SMTP, a restore drill), each its own approved task.
4. **Worker crash and PBM under load** on a disposable copy (m1-061 handoff §2 item 3).

## 3. Gates

- No new dependency, tool, action or image without approval.
- Changing the owner's NPM, Portainer stacks or Cloudflare, and anything on the server, needs the
  owner's approval for each change.
- A restore drill outside the hosted workflow needs the owner's approval each time.
- Changing D-DB-8, D-DB-10, D-DB-12, D-DB-15, D-DB-16 or D-DB-17 needs the owner. Anything touching
  production is an architecture gate.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-064. Read AGENTS.md and docs/milestones/m1-064-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
