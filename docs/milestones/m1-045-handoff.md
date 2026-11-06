# m1-045 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-06, by the agent at the end of m1-044 (agent-executed; not a human approval) |
| **Task** | `m1-045`, an item the owner picks. Candidates: (a) build the staging version of the one-container image and rewrite the [hardening runbook](../runbooks/server-hardening-and-patching.md) for it; (b) choose a MongoDB dashboard tool; (c) choose the backup tool; (d) run the image on the OCI server, which needs approval |
| **Preconditions** | The m1-044 PR is merged (D-GIT-42) and its hosted CI checks are green |
| **Branch** | `<type>/m1-045-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-7 to D-DB-11) · [m1-044 report](../engineering/reports/2026/11/2026-11-06-m1-044-mongodb-decisions.report.md) · [single-container runbook](../runbooks/docker-single-container.md) |

## 1. Carry-over

- **Decided in m1-044:** MongoDB 8.0.x, `javascriptEnabled: false`, and one container for the app and
  MongoDB on staging and production (D-DB-10 (b)).
- **The staging version of the image does not exist.** It needs: no demo seed, no `admin` password
  fallback, TLS on the database connection, x.509 on production (§12 choice 2), a backup tool that
  meets D-DB-4, `APOS_HTTPS=1` behind nginx, and a test on a server.
- **Not decided:** where nginx runs (on the host or in its own container). Ask the owner in that task.
- **Check in that task:** that Docker's restart policy restarts the container after each failure
  (R6), and how a weekly reboot and the LUKS unlock (§12 choices 1 and 4) fit a container start. Keep
  the app port on `127.0.0.1` and MongoDB unpublished, because Docker's published ports go around the
  firewall (m1-041).
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO's answer to I1.
- All items in the [m1-044 handoff §1](m1-044-handoff.md#1-carry-over) still apply, except that
  D-DB-10 (b) is now decided.

## 2. Gates

- The MongoDB dashboard needs a tool approval with the license and advisory checks. ADR-0002 allows
  content changes only through Apostrophe APIs, so direct CRUD needs an owner decision.
- A server, an account, a tool install, spending, a registry push or running the image on a server
  each need explicit owner approval. D-DB-10 (b) approves none of them.
- Removing a Docker volume needs approval. Commit, push and PR need owner approval.

## 3. Prompt for the new session

> Start m1-045. Read AGENTS.md and docs/milestones/m1-045-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
