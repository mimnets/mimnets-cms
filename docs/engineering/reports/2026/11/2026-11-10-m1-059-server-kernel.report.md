# m1-059 — Decide the server kernel (D-DB-16)

| | |
|---|---|
| **Task** | m1-059 |
| **Date** | 2026-11-10 |
| **Scope** | Candidate 1 of the handoff, the paper part: which kernel a server may run for MongoDB 8.0.34. No server, image or code was changed |
| **Prompt** | [2026-11-10-m1-059-server-kernel.prompt.md](../../../prompts/2026/11/2026-11-10-m1-059-server-kernel.prompt.md) |
| **Handoff** | [m1-059 start handoff](../../../../milestones/m1-059-handoff.md) · next: [m1-060 handoff](../../../../milestones/m1-060-handoff.md) |
| **Branch / commits** | `docs/m1-059-server-kernel`: one commit with this report (D-GIT-57) |
| **Related** | D-DB-16 (decided) · D-DB-8 · D-DB-2 · D-DB-7 |

All checks below are **agent-executed**. They are not human approval.

## Status

**D-DB-16 is decided: option A now, B later** (owner, 2026-11-10). Servers stay on Ubuntu 24.04's 6.8
kernel line. The move to 7.0 is its own approved task, after MongoDB 8.0.37 is pinned and tested. The
decision paper is [m1-059-server-kernel.md](../../../../milestones/m1-059-server-kernel.md). **Nothing was
tested on a server.**

## Findings

- **MongoDB 8.0.34 refuses Ubuntu's 7.0 kernels, even when they carry the fix.** Ubuntu reports
  `7.0.0-<ABI>`, not the upstream patch number. The exemption for Ubuntu is in 8.0.37 (SERVER-131779),
  which is "Upcoming". 8.0.34 (2026-10-13) is the newest released version.
- **Ubuntu 24.04 already installs 7.0 in some setups:** through the HWE kernel (24.04.5), through
  `linux-oracle` (7.0.0-1016 in `noble-updates`, 2026-11-09) and through `linux-azure`. A server that
  follows them stops MongoDB after the next upgrade and reboot. The GA `linux-generic`, `linux-virtual` and
  `linux-oracle-lts-24.04` stay on 6.8. This is a likely explanation of the m1-058 refusal on
  `ubuntu-24.04-arm`, not confirmed.
- **D-DB-16 option C was recorded with the wrong value.** The source names
  `glibc.pthread.rseq=0:glibc.cpu.hwcaps=-SHSTK`, not `rseq=1`, and a linked report says it was not enough.
  The register now says so.

## Changes

- New: the decision paper, this report, the prompt record and the [m1-060 handoff](../../../../milestones/m1-060-handoff.md).
- D-DB-16 in the decision register: decided, with the findings above.
- Hardening runbook §4 item 7: the 6.8 rule, the metapackages, and the check before a start or a reboot.
- Staging runbook §7: why every Ubuntu 7.0 kernel is refused until 8.0.37.
- INDEX: the task row, the paper and the next free ID.

## Tests executed and actual results

On the local SQLite site, with `npm start` on `127.0.0.1:3000`:

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
| Home page | Opened `http://127.0.0.1:3000/` | Header, nav, hero and demo banner shown; no console errors | PASS |
| Navigation | Clicked "Acceptance Test" in the nav | Page opened with breadcrumb and title | PASS |

No screenshots kept. Tablet and mobile widths were not checked, because no layout changed.

## Clean-up

- The local server was stopped, and the agent's Chrome tab was closed.
- No accounts or content were created, apart from what `test:workflow` creates and archives on every run.
- Nothing was changed on the owner's PC Docker setup or on any server.

## Not done or not verified

- **No server was checked.** The OCI read-only check was declined for now (owner).
- The `apt` commands in the paper's §4 and the runbook are **not tested**.
- Not established: the kernel flavour of Hetzner's Ubuntu 24.04 image; which Ubuntu `7.0.0-<ABI>` builds
  carry the upstream fix; the kernels of the GitHub runners; what SERVER-125742 means by "8.0.35+".
- `ubuntu-22.04-arm` is still the runner for the hosted `arm64` check. Its kernel is likely 6.8, not read.
- The optional start-script check of `uname -r` (paper §5 item 4) was not made. It needs approval.
