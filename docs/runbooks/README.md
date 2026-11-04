# Runbooks

Step-by-step operational procedures. Each runbook states its verification status: "Verified"
(with date and task ID) or "Draft — not yet executed". Never mark a step as verified unless it was
actually run.

| Runbook | Status |
|---|---|
| [Database and media backup and restore](./database-backup-and-restore.md) | Draft (SQLite verified, PostgreSQL pending) |
| [New site initialization](./new-site-initialization.md) | Draft |
| [Deployment principles](./deployment-principles.md) | Reference only (no deployment approved) |
| [SEO operations](./seo.md) | §1–§4 verified locally (m1-018); launch checks not yet executed |
| [Disposable PostgreSQL 16 on OCI (Docker), dev connection, export/import](./postgresql-dev-on-oci-docker.md) | Draft — not yet executed (m1-033); fallback, not chosen |
| [Disposable PostgreSQL 16 on Neon (free plan), D-DB-5 test, export/import](./postgresql-dev-on-neon.md) | Draft; §2–§4 verified (m1-033, m1-034); export/import not executed |
| [Server hardening and patching (Hetzner Cloud, self-hosted MongoDB)](./server-hardening-and-patching.md) | Draft — not yet executed (m1-039); §12 choices 1–5 and 8 decided (m1-040); 6 and 7 open, MongoDB 8.2 is the driver limit (m1-041) |
