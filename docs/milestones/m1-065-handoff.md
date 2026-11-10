# m1-065 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-10, by the agent at the end of m1-064 (agent-executed; not a human approval) |
| **Task** | `m1-065`: an item the owner picks from §2 |
| **Preconditions** | The m1-064 PR is merged and its hosted checks are green, including `staging-arm64`, which runs because the PR touches `docker/staging/` |
| **Branch** | `<type>/m1-065-<description>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-12, D-DB-16, D-DB-17 with its m1-063 amendment, D-DB-18) · [m1-064 report](../engineering/reports/2026/11/2026-11-10-m1-064-installer-design.report.md) · [m1-064 paper](m1-064-installer-design.md) · [staging container runbook](../runbooks/staging-container.md) §9 to §10 |

## 1. Carry-over

- **The installer, `docker/staging/install.sh`** (D-DB-18, runbook §10), is built and tested locally on
  `amd64` against a stand-in for NPM (m1-064 report). It has **not run on a server**, against NPM
  itself, or against Let's Encrypt.
- **The OCI server** holds no test stack (removed in m1-063, "all clear"). NPM is unchanged: not on
  `assurer-npm`, `IP_RANGES_FETCH_ENABLED` not set, port 81 published on all addresses. The server may
  hold two clones of the repository; keep one, on `main` after the merge. A test host name with a
  DNS-only Cloudflare record may still exist (the owner knows it).
- **NPM certificates:** NPM 2.15.1 has no staging certificate per proxy host (`LE_STAGING` is for the
  whole container), so step 7(c) requests the real one. Where NPM keeps `/etc/letsencrypt` is still
  unknown; step 7(a) shows NPM's mounts before the backup.
- **D-DB-17 amended (m1-063):** production may run on the OCI server first. Before real visitors:
  runbook §9.2's list. The installer lists these items as open; it does none of them.

## 2. Candidate tasks

1. **Run the installer on the OCI server, route B** (recommended). The owner runs
   `bash docker/staging/install.sh` in an SSH session, one step at a time, and pastes the output. Each
   change to NPM, Portainer or Cloudflare is the owner's, with approval for each. Records paper §6
   checks 3 to 8 and the installer's own results; the agent fixes what the run finds. Chrome as an
   editor through the public host name needs the owner's approval.
2. **Production readiness on OCI** (D-DB-17 amendment): plan and order the §9.2 items (x.509 member
   authentication, off-server backups with PBM S3 (D-DB-12, needs an account and spending), indexing,
   HSTS, SMTP, a restore drill), each its own approved task.
3. **Automated updates with a local AI agent** (the owner's request in m1-064, for later: "can we have
   anything with a local ai agents to run and implements the vps server updates along with docker and
   docker contianer images updates regularly"). Design first: what the agent may change on its own
   (OS packages, Docker, images) and what needs the owner; the kernel hold (D-DB-16: stay on 6.8 until
   MongoDB 8.0.37); backups before each update; rollback; where it runs and with which permissions;
   alerts. Likely an architecture gate (production, new tooling).
4. **Worker crash and PBM under load** on a disposable copy (m1-061 handoff §2 item 3).

## 3. Gates

- No new dependency, tool, action or image without approval.
- Changing the owner's NPM, Portainer stacks or Cloudflare, and anything on the server, needs the
  owner's approval for each change.
- A restore drill outside the hosted workflow needs the owner's approval each time.
- Changing D-DB-8, D-DB-10, D-DB-12, D-DB-15, D-DB-16, D-DB-17 or D-DB-18 needs the owner. Anything
  touching production is an architecture gate.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-065. Read AGENTS.md and docs/milestones/m1-065-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
