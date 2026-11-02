# Hosting options paper: staging and production database, media and backups

| | |
|---|---|
| **Status** | **Options paper** (`m1-031`, 2026-11-02). Agent-prepared; **not a decision**. No provider chosen, no account created, nothing provisioned |
| **Decisions** | D-DB-2 (PostgreSQL provider and region) · D-DB-3 (media store) · D-DB-4 (RPO/RTO) · D-DB-7 (application hosting, new) · related: D-DB-5, D-DB-6, D-CONTENT-15, D-CONTENT-16 |
| **Engine** | **PostgreSQL**. Owner direction in m1-031: "ok, stick with postgres, continue". MongoDB remains the ADR-0002 fallback only. MySQL is not an option: `@apostrophecms/db-connect` 1.1.0 ships only `mongodb`, `postgres` and `sqlite` adapters |
| **Depends on** | [ADR-0002](../architecture/decisions/ADR-0002-database-strategy.md) · [D-DB-5 proposal](./m1-d-db-5-postgresql-connection-loss-proposal.md) · [backup protection plan](../runbooks/backup-protection-plan.md) · [deployment principles](../runbooks/deployment-principles.md) |
| **Facts as of** | 2026-11-02, from official provider documentation and public price lists (sources in §9). Prices are list, on-demand, USD, before tax, storage and egress, and change often; re-check before buying |

## 1. What has to be decided, and what is fixed already

Fixed by ADR-0002 and earlier decisions (not reopened here):

- One database, one media store and one set of secrets **per site**; no `multipostgres`.
- PostgreSQL 14 or later; the m1-010 acceptance test used **16.15**.
- Media in an object store with versioning (ADR-0002 §3); local disk only as a stopgap.
- Primary backup is managed point-in-time recovery (PITR) or a consistent `pg_dump`; the portable
  `apos-db-dump` export is taken with writes frozen, at each release and before migrations.
- App role without `CREATEDB`; database pre-created; TLS in the connection string.
- CA-5 content is entered on the target site, once it exists (D-CONTENT-16, option A).

Open, and covered by this paper:

| ID | Question | Decided by |
|---|---|---|
| D-DB-2 | Managed PostgreSQL provider, region and major version | Architect + ops; owner approval (architecture gate) |
| D-DB-3 | Media store (provider, region, versioning, replication) | Architect + ops; owner approval |
| D-DB-4 | RPO, RTO, retention and drill cadence | Business owner |
| D-DB-7 (new) | Where the Node app runs, and how it is supervised and health-checked | Architect + ops; owner approval |

Inputs only the owner or the DPO can give (§7) come before the choice.

## 2. Requirements every option must meet

| # | Requirement | Source |
|---|---|---|
| R1 | Managed PostgreSQL 16 or 17 (match the version the Linux repeat test uses) | ADR-0002 §6, D-DB-6 |
| R2 | PITR, with a retention that meets D-DB-4 (proposed 14 days) | ADR-0002 §5, backup protection plan §2 |
| R3 | TLS enforced; private network access between app and database | D-DB-2 |
| R4 | A region the DPO accepts for personal data (form submissions, user accounts) | D-DB-2, D-CONTENT-15 |
| R5 | Object store with versioning and lifecycle rules, supported by uploadfs (S3-compatible, Azure Blob or Google Cloud Storage) | ADR-0002 §3, D-DB-3 |
| R6 | **App supervisor with automatic restart and health checks** | D-DB-5 mitigation, D-DB-6 blocker |
| R7 | **No pooler or "scale to zero" that routinely closes idle connections** | D-DB-5 (see §3) |
| R8 | Backups and backup credentials separable from the app's own credentials | Backup protection plan §2 |

## 3. Why D-DB-5 shapes the choice

`@apostrophecms/db-connect` 1.1.0 is still the latest release (npm, checked 2026-11-02), and no
upstream issue about the missing pool `error` listener exists yet (GitHub search, 2026-11-02).
So the app still **exits** whenever PostgreSQL closes an idle pooled connection.

Every managed service closes connections sometimes. The docs say so for RDS failover and patching
[37], Cloud SQL maintenance and failover [38][15], Azure patching restarts [9] and Neon updates
[33]. Two consequences:

1. **R6 is mandatory on every provider**: the platform must restart the process within seconds
   and route traffic only to healthy instances. Expect a short outage per maintenance event until
   D-DB-5 is fixed upstream.
2. **Services that close idle connections as normal operation are excluded**, because they would
   turn a rare event into a routine one:
   - **Neon** suspends compute after 5 minutes idle (can be switched off on paid plans), and
     weekly updates drop connections [32][33].
   - **Supabase**'s transaction pooler closes connections unused for 5 minutes [35]. TLS
     enforcement is also off by default [29], and PITR is a paid add-on from about $100/month [28].

This does not remove the D-DB-6 blocker. Staging still needs D-DB-5 resolved **or mitigated**
(R6 plus a test), a repeat of the acceptance test on Linux with the chosen major version, and the
"sanitize after restore" task.

## 4. Provider comparison

### 4.1 Managed PostgreSQL (D-DB-2)

| | AWS RDS | Azure Flexible Server | Google Cloud SQL | DigitalOcean |
|---|---|---|---|---|
| Versions | 16, 17, 18 [1] | 16, 17, 18 [7] | 16, 17, 18 [11] | 15–18 (Standard) [16] |
| PITR retention | up to 35 days [2] | 7–35 days, RPO ≤ 5 min [8] | 7 days (Enterprise), 35 (Enterprise Plus) [12] | 7 days, fixed [16] |
| TLS | forced by default on PG 15+ [3] | TLS 1.2+ enforced by default [9] | configurable, "encrypted only" [13] | required, cannot be disabled [18] |
| Private network | VPC | VNet integration [9] | private IP | VPC hostname [19] |
| UAE region | **yes**, me-central-1 [4] | **yes**, UAE North [9] | no (Doha, Dammam) [14] | no |
| India / Singapore | Mumbai, Hyderabad, Singapore [4] | Central/South India, Southeast Asia [9] | Mumbai, Delhi, Singapore [14] | Bangalore (limited plans), Singapore [20] |
| High availability | Multi-AZ standby [5] | zone-redundant standby (UAE North) [9] | regional HA, ~60 s failover [15] | standby node, automatic failover [17] |
| Smallest sensible tier, list | db.t4g.small ≈ $28/mo single, ≈ $55 Multi-AZ, + gp3 $0.14/GB-mo (me-central-1) [6] | B1MS ≈ $15/mo (UAE North); GP 2 vCore ≈ $158/mo [10]; storage not verified | not verified | $15/mo single; $60/mo with standby [21] |

Not shortlisted: **Neon** and **Supabase** (R7, §3); **Google Cloud SQL** meets the requirements
but has no UAE region and its price was not verified. It is a valid alternative if Assurer already
uses Google Cloud.

### 4.2 Media store (D-DB-3)

| | Versioning | Replication | Regions near users | uploadfs backend | Notes |
|---|---|---|---|---|---|
| AWS S3 | yes [43] | cross-region [43] | UAE, India, Singapore [4] | S3 (native) | ADR-0002's default target |
| Azure Blob | yes [44] | object replication (needs versioning on both sides) [44] | UAE North, India, Southeast Asia | Azure (native in uploadfs) | no S3 API; uploadfs does not need it |
| Google Cloud Storage | yes | dual-region, e.g. India [45] | Doha, Dammam, India, Singapore [45] | GCS (native) | |
| DigitalOcean Spaces | yes, set via API/CLI only [47] | none found [48] | Bangalore, Singapore [20] | S3-compatible | $5/mo incl. 250 GiB and 1 TiB transfer [49] |
| Cloudflare R2 | **no** [50] | **no** [50] | `apac` hint only [51] | S3-compatible | free egress, but fails R5 |
| Backblaze B2 | not verified | separate account per region [53] | US, EU, CA only [54] | S3-compatible | fails R4 for an Asian or Gulf choice |

Rule: put the bucket in the **same provider and region** as the database. Then a backup pair
(ADR-0002 §3) stays inside one residency boundary and one set of access controls.

### 4.3 App hosting and supervision (D-DB-7)

| | Restart and health checks | Regions | Notes |
|---|---|---|---|
| AWS ECS on Fargate | container health checks mark tasks unhealthy [58]; replacement by the ECS service still to be confirmed | UAE, Bahrain, India, Singapore [57] | App Runner is closed to new customers; AWS points to ECS Express Mode [56] |
| Azure Container Apps | liveness and readiness probes, restarts failing replicas [60] | UAE North availability **not verified** | |
| Azure App Service | health check removes an unhealthy instance; needs Basic tier and 2+ instances [59] | not verified | |
| Google Cloud Run | a failed liveness probe restarts the instance [61] | Doha, Dammam, India, Singapore [62] | |
| DigitalOcean App Platform | liveness probe restarts the app; health checks stop traffic [63] | Bangalore, Singapore [20] | |
| Linux VM with systemd | `Restart=always` restarts after any exit; `WatchdogSec` for liveness [64] | any | cheapest; we patch the OS and run the proxy and TLS ourselves |

Whatever runs the app must also meet the deployment principles: build, migrate, then switch;
persistent state outside the release; `NODE_ENV=production` behind a TLS proxy.

## 5. Shortlist

All three are complete stacks: database, media, app hosting and backups from one provider in one
region.

| | **A. AWS, UAE** | **B. Azure, UAE** | **C. DigitalOcean, Singapore or Bangalore** |
|---|---|---|---|
| Stack | RDS PostgreSQL + S3 + ECS Fargate, me-central-1 | Flexible Server + Blob + Container Apps, UAE North | Managed PostgreSQL + Spaces + App Platform (or a Droplet with systemd), SGP1 |
| Residency | UAE | UAE | Singapore or India; **no Middle East** |
| PITR | up to 35 days | 7–35 days | 7 days (fixed; meets a 7-day D-DB-4 only) |
| Media versioning and replication | yes / yes | yes / yes | yes / no |
| Fit with ADR-0002 | closest (S3 is the documented target) | good (uploadfs Azure backend) | good; the backup protection plan's separate backup account is harder |
| Staging database, single node, list | ≈ $28/mo + storage | ≈ $15/mo + storage | $15/mo |
| Production with HA standby, list | ≈ $55/mo (t4g.small Multi-AZ) + storage | depends on tier; HA on Burstable not verified | $60/mo |
| Ops effort | highest (IAM, VPC, ECS) | medium–high | lowest |
| Unverified items | ECS task replacement wording | Container Apps in UAE North; storage price; HA on Burstable | Spaces replication |

**Agent recommendation (not a decision):**

- If the DPO wants personal data kept in the UAE (Dubai is described as HQ), or Assurer already
  has an AWS account: **A**. It has the most complete backup story (35-day PITR, S3 versioning and
  cross-region replication) and matches ADR-0002 as written.
- If Assurer already uses Microsoft 365 or Azure: **B**, after the two unverified items are checked.
- If the DPO accepts Singapore or India and lowest cost and effort come first: **C**. It is
  enough for a brochure site with a few editors, but accept 7-day PITR and no media replication,
  or add a nightly media copy to a second region.

Size for a site like this: one small instance (1–2 vCPU, 1–2 GB RAM, 10–20 GB storage) is enough
for staging and very likely for production. Add the HA standby for production only if D-DB-4
needs an RTO under about an hour. Otherwise PITR restore covers the proposed 4 h RTO.

## 6. Backup targets (D-DB-4, business owner)

Proposed, unchanged from ADR-0002 §5 and the backup protection plan, now with what each option
can deliver:

| Target | Proposal | A | B | C |
|---|---|---|---|---|
| RPO (database) | ≤ 15 min | PITR (exact RPO not verified) | PITR, ≤ 5 min [8] | PITR (exact RPO not verified) |
| RPO (media) | ≤ 24 h | versioning + replication | versioning + replication | versioning; replication is manual |
| RTO | ≤ 4 h | yes | yes | yes |
| PITR retention | 14 days | yes | yes | **no, fixed at 7** |
| Portable exports | encrypted `apos-db-dump`, at each release and monthly, 12 kept | yes | yes | yes |
| Restore drill | quarterly, into an isolated environment, dated report | yes | yes | yes |

## 7. Inputs needed before a choice

| # | Input | From | Why |
|---|---|---|---|
| I1 | Which countries' law applies to the website's personal data, and which hosting regions are acceptable | DPO | R4; also fills the privacy notice's hosting placeholder (D-CONTENT-15) |
| I2 | Existing cloud accounts or contracts (AWS, Azure, Google, Microsoft 365) | Owner | Billing, single sign-on, procurement |
| I3 | Monthly budget for staging and production | Owner | Tier and HA |
| I4 | Who operates it (in-house, contractor) and their platform skills | Owner | Ops effort, R6, patching |
| I5 | D-DB-4 targets confirmed or changed | Business owner | PITR retention excludes C at 14 days |
| I6 | Who files the D-DB-5 upstream issue (the text is ready) | Owner | Upstream fix removes the outage on each maintenance |

## 8. After the choice: path to staging

Each step is a separate task with its own approvals. Account creation and spending need explicit
owner approval.

1. Record D-DB-2, D-DB-3, D-DB-7 (and D-DB-4) with the decider and date; amend ADR-0002 status.
2. D-DB-5 mitigation: R6 configured, plus a repeatable test that drops connections and checks the
   app comes back. File the upstream issue (I6).
3. Repeat the m1-010 acceptance test on Linux with the chosen major version (D-DB-6 blocker).
4. Build and review the "sanitize after restore" task (D-DB-6 blocker).
5. Provision staging: separate account or project, database pre-created, app role without
   `CREATEDB`, TLS, bucket with versioning, secrets in the platform store, backup job with
   write-only credentials.
6. Deployment design per the deployment principles (ADR), then the first deploy and
   `node app @apostrophecms/migration:migrate`.
7. First restore drill on staging; then CA-5 content entry (D-CONTENT-16, option A).

## 9. Sources

Retrieved 2026-11-02. Numbering matches the m1-031 research notes.

1. docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-versions.html
2. docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.BackupRetention.html
3. docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html
4. docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html
5. docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html
6. AWS price list API, AmazonRDS, me-central-1 (offer 20261029070635)
7. learn.microsoft.com/en-us/azure/postgresql/configure-maintain/concepts-supported-versions
8. learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore
9. learn.microsoft.com/en-us/azure/postgresql/overview
10. prices.azure.com/api/retail/prices (uaenorth)
11. docs.cloud.google.com/sql/docs/postgres/db-versions
12. docs.cloud.google.com/sql/docs/editions-intro
13. docs.cloud.google.com/sql/docs/postgres/configure-ssl-instance
14. docs.cloud.google.com/sql/docs/postgres/locations
15. docs.cloud.google.com/sql/docs/postgres/high-availability
16. docs.digitalocean.com/products/databases/postgresql/details/limits/
17. docs.digitalocean.com/products/databases/postgresql/details/features/
18. docs.digitalocean.com/products/databases/postgresql/how-to/secure/
19. docs.digitalocean.com/products/databases/postgresql/how-to/connect/
20. docs.digitalocean.com/platform/regional-availability/
21. docs.digitalocean.com/products/databases/postgresql/details/pricing/
28. supabase.com/docs/guides/platform/backups
29. supabase.com/docs/guides/platform/ssl-enforcement
32. neon.com/docs/introduction/scale-to-zero
33. neon.com/docs/manage/updates
35. supabase.com/kb/troubleshooting/supavisor-faq-YyP5tI
37. docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.Failover.html
38. docs.cloud.google.com/sql/docs/postgres/maintenance
43. docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html and replication.html
44. learn.microsoft.com/en-us/azure/storage/blobs/object-replication-overview
45. docs.cloud.google.com/storage/docs/locations
47. docs.digitalocean.com/products/spaces/how-to/enable-versioning/
48. docs.digitalocean.com/products/spaces/details/features/
49. docs.digitalocean.com/products/spaces/details/pricing/
50. developers.cloudflare.com/r2/api/s3/api/
51. developers.cloudflare.com/r2/reference/data-location/
53. backblaze.com/docs/cloud-storage-cloud-replication
54. backblaze.com/docs/cloud-storage-data-regions
56. docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html
57. docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate-Regions.html
58. docs.aws.amazon.com/AmazonECS/latest/developerguide/healthcheck.html
59. learn.microsoft.com/en-us/azure/app-service/monitor-instances-health-check
60. learn.microsoft.com/en-us/azure/container-apps/health-probes
61. docs.cloud.google.com/run/docs/configuring/healthchecks
62. docs.cloud.google.com/run/docs/locations
63. docs.digitalocean.com/products/app-platform/how-to/manage-health-checks/
64. freedesktop.org/software/systemd/man/latest/systemd.service.html
