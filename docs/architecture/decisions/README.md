# Architecture Decision Records

One file per significant, hard-to-reverse decision: `ADR-NNNN-short-title.md`, numbered
sequentially and never renumbered.

| ADR | Title | Status |
|---|---|---|
| [ADR-0001](./ADR-0001-cms-platform-and-starter.md) | CMS platform and starting point | Accepted 2026-10-19 |
| [ADR-0002](./ADR-0002-database-strategy.md) | Database and media storage strategy | Accepted 2026-10-19 (PostgreSQL conditional); in part superseded by ADR-0004 |
| [ADR-0003](./ADR-0003-corporate-content-model.md) | Corporate content model | Accepted 2026-10-20 |
| [ADR-0004](./ADR-0004-mongodb-for-staging-and-production.md) | MongoDB for staging and production | Accepted 2026-11-08 (m1-052); supersedes ADR-0002 in part |

## Lifecycle

`Proposed` → `Accepted` (by a named human approver, with date) → optionally `Superseded by
ADR-NNNN` or `Deprecated`. Accepted ADRs are not edited in substance. To change a decision, write a
new ADR that supersedes the old one, and update the old one's status line only.

## Template

```markdown
# ADR-NNNN: <title>

| | |
|---|---|
| **Status** | Proposed |
| **Date** | YYYY-MM-DD |
| **Task** | `mN-NNN` · report: <link> |
| **Approved by** | <name, date> — once accepted |

## Context
## Decision
## Consequences
## Alternatives considered
```
