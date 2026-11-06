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
| [Server hardening and patching (Hetzner Cloud, self-hosted MongoDB)](./server-hardening-and-patching.md) | Draft — not yet executed (m1-039); §12 choices 1–5 and 8 decided (m1-040), 6 and 7 decided (m1-044); §6 and §7 need rewriting for one container (D-DB-10 (b)) |
| [Install and test the project on the owner's OCI server (Docker, MongoDB 8.0.x)](./project-test-on-oci-docker.md) | Draft — not yet executed (m1-042); disposable test only |
| [The whole project in one Docker container](./docker-single-container.md) | Built and tested locally (m1-043); this build is for demo and test use only (D-DB-11). One container is also the direction for staging and production, in a version not yet built (D-DB-10 (b), m1-044) |
