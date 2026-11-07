# m1-047 start handoff

| | |
|---|---|
| **Prepared** | 2026-11-07, by the agent at the end of m1-046 (agent-executed; not a human approval) |
| **Task** | `m1-047`: an item the owner picks from §2 |
| **Preconditions** | The m1-046 PR is merged (D-GIT-44) and its hosted CI checks are green |
| **Branch** | `<type>/m1-047-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-4, D-DB-10, D-DB-12, D-SEC-5) · [m1-046 results](./m1-046-pbm-poc-results.md) · [m1-046 report](../engineering/reports/2026/11/2026-11-07-m1-046-pbm-poc.report.md) · [single-container runbook](../runbooks/docker-single-container.md) |

## 1. Carry-over

- **D-DB-12:** PBM is confirmed for local use. It becomes final after the S3 tests: Hetzner SSE-C,
  object lock with versioning, cleanup on a locked bucket, and how PBM gets credentials without
  keeping them in plain text in `admin.pbmConfig` (for example its Vault support).
- **D-SEC-5:** three high findings in PBM 2.17.0 are accepted until a fix. Check for a newer PBM
  release and scan again before any staging use.
- **Owner's rules for Docker (m1-046):** every image supports `linux/arm64` as well as `linux/amd64`,
  and everything runs with Docker Compose. Cross-builds need the `build-only` profile in
  `docker/pbm-poc/compose.yaml`; a staging Compose file needs the same care.
- **For the staging image,** from the m1-046 results: a slice length and base backup schedule that keep
  the RPO within 15 minutes; RTO measured on realistic data; a scheduler, retention and an alert on
  backup status; a secret store for the database secrets that a restore needs; no admin password in
  the app's environment.
- **Not run yet:** PITR restore and RPO on `arm64`, and anything on real ARM hardware.
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO's answer to I1. All items in the
  [m1-046 handoff §1](m1-046-handoff.md#1-carry-over) still apply.

## 2. Candidates

| Item | Needs |
|---|---|
| Staging version of the one-container image with PBM, and the hardening runbook rewrite (§6, §7, §9) | No account. Changing the Docker setup for staging is a design step the owner confirms first |
| PBM S3 tests (SSE-C, object lock, credentials) | An S3 account and a small spend, approved by the owner. The storage region waits for I1 |
| Running the image on the owner's OCI server | Owner approval (D-DB-10) |
| MongoDB dashboard tool (owner's requirement, m1-044) | A tool choice and its license and advisory check |

## 3. Gates

- An S3 account, spending, a server, a registry push or running anything on a server each need
  explicit owner approval.
- `pbm restore` replaces data: restore only into a new, empty container, with the owner's approval.
- Adding or upgrading a package or tool needs the owner's approval and the license and advisory checks.
- Commit, push and PR need owner approval.

## 4. Prompt for the new session

> Start m1-047. Read AGENTS.md and docs/milestones/m1-047-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
