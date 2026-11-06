# m1-046 start handoff: local proof of concept for the backup tool

| | |
|---|---|
| **Prepared** | 2026-11-06, by the agent at the end of m1-045 (agent-executed; not a human approval) |
| **Task** | `m1-046`, recommended by the owner's answer in m1-045: the local PBM proof of concept in [options paper §6](./m1-045-backup-tool-options.md#6-proposed-proof-of-concept-needs-separate-approval). The owner can pick another item |
| **Preconditions** | The m1-045 PR is merged (D-GIT-43) and its hosted CI checks are green. **The owner approves installing PBM in a disposable test image** |
| **Branch** | `<type>/m1-046-<short-name>` from `origin/main` after that merge |
| **Session** | Start a **new Claude Code session** (AGENTS.md, Sessions and context) |
| **Read first** | [AGENTS.md](../../AGENTS.md) · [INDEX](../engineering/INDEX.md) · [decision register](../engineering/decision-register.md) (D-DB-4, D-DB-10, D-DB-12) · [options paper](./m1-045-backup-tool-options.md) · [m1-045 report](../engineering/reports/2026/11/2026-11-06-m1-045-backup-tool.report.md) · [single-container runbook](../runbooks/docker-single-container.md) |

## 1. Carry-over

- **Decided in m1-045:** PBM as the direction, subject to test (D-DB-12). It has not been run on this
  project. If the test fails, the fallback is scheduled `mongodump` (option C).
- **Accepted for now by the owner:** a PBM user with `anyAction`, storage credentials that can delete,
  and Percona's wording that a single-node replica set is for testing. Report anything from the test
  that changes these.
- **Check before installing:** re-read the latest PBM release and its advisories. Read Percona's
  platform lifecycle page for Ubuntu 24.04, which m1-045 did not read. The National Vulnerability
  Database was not searched either.
- **The test stays local and disposable:** a new test image and new volumes, with backups on local
  disk. `assurer-site-1` and its volumes stay untouched. Do not change the demo image as part of the test.
- **Still open, outside this test:** the storage target (I1), SSE-C and object lock on Hetzner, the
  key custodians, an alert on backup status, the staging image and where nginx runs.
- D-DB-2, D-DB-3 and D-DB-7 still wait for the DPO's answer to I1. All items in the
  [m1-045 handoff §1](m1-045-handoff.md#1-carry-over) still apply.

## 2. Gates

- Installing PBM needs the owner's explicit approval, even in a test image. D-DB-12 does not give it.
- An S3 account, spending, a server, a registry push or running anything on a server each need
  explicit owner approval.
- `pbm restore` replaces data: restore only into a new, empty container, with the owner's approval.
  Removing a Docker volume needs approval, except where the owner approves removing the test's own.
- Commit, push and PR need owner approval.

## 3. Prompt for the new session

> Start m1-046. Read AGENTS.md and docs/milestones/m1-046-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.
