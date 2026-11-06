# m1-044 start handoff: next owner-approved item

| | |
|---|---|
| **Prepared** | 2026-11-06, by the agent at the end of m1-043 (agent-executed; not a human approval) |
| **Task** | `m1-044`, an item the owner picks. Candidates: (a) settle [hardening runbook](../runbooks/server-hardening-and-patching.md) §12 choices 6 and 7 from the m1-043 results; (b) decide D-DB-10 (b), including separate containers for any real site; (c) choose a MongoDB dashboard tool (owner's request in m1-043); (d) run the image on the OCI server, which needs approval; (e) choose the backup tool |
| **Preconditions** | The m1-042 and m1-043 PRs are merged, in that order, and their hosted CI checks are green |
| **Branch** | `<type>/m1-044-<short-name>` from `origin/main` after those merges |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-8 to D-DB-11) · [m1-043 report](../engineering/reports/2026/11/2026-11-06-m1-043-docker-one-container.report.md) · [single-container runbook](../runbooks/docker-single-container.md) |

## 1. Carry-over

- The owner confirmed in m1-043 that the company meets Docker Desktop's license condition. It covers
  Docker Desktop only; a Linux server would normally use Docker Engine, which has no such condition.
- The owner plans to run the project on their own server later. Which server and when are not
  decided. Before that run: replace the default `admin` password (D-DB-11), check the server's CPU
  type against the [runbook §4](../runbooks/docker-single-container.md#4-architectures), keep both
  ports private, and settle D-DB-10 (b) if the site will hold real content.
- TLS on the database connection was not tested. Record it in the first staging task.
- All items in the [m1-043 handoff §4](m1-043-handoff.md#4-carry-over) still apply.

## 2. Gates

- The MongoDB dashboard needs a tool approval with the license and advisory checks. ADR-0002 allows
  content changes only through Apostrophe APIs, so direct CRUD needs an owner decision.
- Running the image on the OCI server, pushing it to a registry, or any change to production needs
  explicit owner approval.
- Removing a Docker volume needs approval. Commit, push and PR need owner approval.

## 3. Prompt for the new session

> Start m1-044. Read AGENTS.md and docs/milestones/m1-044-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
