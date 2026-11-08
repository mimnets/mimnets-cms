# Litestream proof of concept (superseded)

**Not for staging or production.** These files are the local, disposable test setup for SQLite
with Litestream (D-DB-13): the m1-048 proof of concept and the m1-050 load test. The owner reversed
D-DB-13 on 2026-11-08 (m1-051). Staging and production run MongoDB in one container with the app
([ADR-0004](../../docs/architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md),
accepted in m1-052).

The files are kept as evidence for the
[m1-048 results](../../docs/milestones/m1-048-litestream-poc-results.md) and the
[m1-050 results](../../docs/milestones/m1-050-load-test-results.md). Litestream 0.5.18 was approved for
local use only (m1-048); its dependency findings are D-SEC-6. The `assurer-backup:dump` task that m1-049 built for this setup was
removed in m1-052, so the m1-049 steps no longer run on the current code.
