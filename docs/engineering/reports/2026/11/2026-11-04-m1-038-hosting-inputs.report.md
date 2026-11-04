# m1-038 — hosting inputs, backup targets and database engine

| | |
|---|---|
| **Task** | m1-038 |
| **Date** | 2026-11-04 |
| **Scope** | Candidate (a) of the [m1-038 handoff](../../../../milestones/m1-038-handoff.md): record the hosting decisions. Only the owner's inputs exist, so this task records inputs I2 to I5, D-DB-4, the owner's change of database engine to MongoDB (D-DB-8, new) and the owner's hosting preference (Hetzner, self-hosted). D-DB-2, D-DB-3 and D-DB-7 wait for the DPO (I1) |
| **Prompt** | [2026-11-04-m1-038-hosting-inputs.prompt.md](../../../prompts/2026/11/2026-11-04-m1-038-hosting-inputs.prompt.md) |
| **Handoff** | [m1-038 start handoff](../../../../milestones/m1-038-handoff.md) · next: [m1-039 handoff](../../../../milestones/m1-039-handoff.md) |
| **Branch / commit** | `docs/m1-038-hosting-inputs` from `origin/main` `03ee8ce` (m1-037 merged as PR #40). Commit and push approved by the owner (D-GIT-36); PR opened by the owner |
| **Related** | D-DB-2 · D-DB-3 · D-DB-4 · D-DB-5 · D-DB-6 · D-DB-7 · D-DB-8 (new) · D-CONTENT-15 · D-GIT-35 · D-GIT-36 (new) |

All checks below are **agent-executed**. They are not human approval.

## Approvals used

- Candidate (a): owner, in session ("(a) Hosting decisions").
- D-DB-4: decided by the repository owner acting as business owner ("7 days is enough", "yes,
  i'm the business owner, go ahead"). The 15-minute RPO is kept: the owner chose "Approve a backup
  tool" over relaxing it to 24 hours.
- D-DB-8 (engine): the owner chose "MongoDB (Recommended)" in answer to a question that named it
  an architecture gate and said ADR-0002 would be updated.
- Hosting preference: owner, "i prefere htzner"; media "Server disk + EU copy".
- I1 (applicable law, acceptable regions): **not decided**. Owner: "dpo will decide".
- m1-037 CI checks: read through the public GitHub API for `03ee8ce`: 5 of 5 completed with
  `success` (secrets, test, lint, audit, build).
- The backup tool is approved **in principle only**. The specific tool still needs the license
  and advisory check (AGENTS.md) before it is installed anywhere.
- No provider account created, nothing provisioned, no money spent. No package, lockfile, `.env`,
  database, user account or production system changed. Nothing posted anywhere.

## Requirements

Record the hosting decisions D-DB-2, D-DB-3, D-DB-7 and D-DB-4 once inputs I1 to I5
([hosting options paper](../../../../milestones/m1-031-hosting-options.md) §7) exist. Record only
what the decider gave; do not choose a provider for them.

## Inputs recorded

| # | Input | Answer | From |
|---|---|---|---|
| I1 | Applicable law and acceptable hosting regions | **Open: the DPO decides.** Owner's view: no consent law constrains hosting; Singapore or India acceptable | DPO (owner's view recorded only as a view) |
| I2 | Existing cloud accounts or contracts | Not a factor. The agent explained it affects billing, sign-in and procurement only | Owner |
| I3 | Monthly budget | About $50–100 for staging and production together | Owner |
| I4 | Who operates it | In-house, limited ops experience | Owner |
| I5 | D-DB-4 targets | 7-day PITR; the other proposed targets unchanged (below) | Business owner |

## Course of the session

1. With I1 to I5, the agent first named **option C** of the options paper (DigitalOcean managed
   PostgreSQL, Singapore) as the fit for a limited-ops team and a $50–100 budget. App Platform
   prices checked: 1 GiB $10 (fixed) or $12 (scalable); about $59/month in total without a
   production standby.
2. The owner asked to consider **Hetzner, self-hosted, with MongoDB or Supabase**. The agent
   compared them (paper §10) and recommended keeping C for its lower ops effort. It advised against
   Supabase, hosted or self-hosted.
3. The owner preferred Hetzner, chose MongoDB, kept the 15-minute RPO with a backup tool, and
   chose media on the server disk with a nightly copy to an EU bucket.

## Work completed

| Item | Result |
|---|---|
| D-DB-4 | **Decided:** database RPO ≤ 15 min, media RPO ≤ 24 h, RTO ≤ 4 h, PITR retention 7 days (proposal was 14), encrypted portable exports at each release and monthly with 12 kept, quarterly restore drill. On Hetzner the 15 minutes need a MongoDB replica set and a continuous backup tool (approved in principle) |
| D-DB-8 (new) | **Decided:** MongoDB is the database engine for staging and production. It replaces the PostgreSQL direction of m1-031. D-DB-5 and the D-DB-6 blockers no longer block staging; they matter only if PostgreSQL returns |
| D-DB-2, D-DB-3, D-DB-7 | Stay open, waiting for I1. Owner's preference recorded: **Hetzner Cloud, Singapore**: self-hosted MongoDB on a Linux server, the app under systemd, media on the server disk with a nightly copy to a versioned Hetzner Object Storage bucket in Germany or Finland |
| Options paper | Status row; new **§10, Hetzner self-hosted (m1-038 addendum)** with the facts and sources |
| ADR-0002 | Status note (D-DB-8); §5 note (D-DB-4) |
| Backup protection plan | Retention cell: 7 days PITR (D-DB-4) |
| Register | D-DB-2, D-DB-3, D-DB-5, D-DB-6, D-DB-7 notes; D-DB-4 decided; D-DB-8 new; D-GIT-35 merged (PR #40); D-GIT-36 new |
| Records | This report, the prompt record, INDEX, [m1-039 handoff](../../../../milestones/m1-039-handoff.md) |

## Question for the DPO (I1)

For the owner to send. Neutral; it does not suggest an answer.

> The new Assurer World website (ApostropheCMS) will store two kinds of personal data: contact
> form submissions (today: name, email address, company and message; editors can add fields) and
> staff editor accounts (name, email address, password hash). Before we choose a hosting provider,
> please confirm:
>
> 1. Which country's or countries' data protection law applies to this personal data?
> 2. Which hosting regions are acceptable for it? The preferred setup is a server in Singapore
>    (Hetzner, a German company), with backup copies of the database and uploaded files kept in
>    Germany or Finland.
> 3. Does storing it outside the country of collection need anything else (for example consent
>    wording, a transfer clause or a data processing agreement with the provider)? The answer also
>    fills the hosting placeholder in the privacy notice draft.

## Files changed

- A `docs/engineering/prompts/2026/11/2026-11-04-m1-038-hosting-inputs.prompt.md`
- A `docs/engineering/reports/2026/11/2026-11-04-m1-038-hosting-inputs.report.md`
- A `docs/milestones/m1-039-handoff.md`
- M `docs/engineering/decision-register.md`
- M `docs/engineering/INDEX.md`
- M `docs/architecture/decisions/ADR-0002-database-strategy.md`
- M `docs/runbooks/backup-protection-plan.md`
- M `docs/milestones/m1-031-hosting-options.md`

## Tests executed and actual results

Run after the first round of edits (D-DB-4 and inputs). The later edits are docs only, like the
first; the suites were not run again.

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Lint | `npm run lint` | No errors or warnings | PASS |
| Smoke | `node --env-file=.env app` on `:3000` (SQLite); `npm run test:smoke` | 18/18 | PASS |
| Workflow | `npm run test:workflow` | 15/15 | PASS |
| Persistence | `npm run test:persistence`, same server | 7/7 | PASS |

## Browser acceptance checklist

| Check | Steps | Actual result | Status |
|---|---|---|---|
| Public site smoke (Chrome) | `http://127.0.0.1:3000/` in a new tab; DOM read with JavaScript | Title "Home", H1 "Protection you can rely on", "Demo" label present, no horizontal overflow | PASS |
| Logged out: no admin bar or user data | Same page; checked for admin-bar elements and a `"user":{` object in the HTML | Neither present | PASS |
| Editor flows, layouts 1440/768/375 | — | Docs-only task; no template, layout or content change | NOT TESTED (not applicable) |

## Security observations

- Self-hosting moves OS patching, the firewall, the TLS proxy, MongoDB authentication and TLS, and
  backups to the in-house team, which reported limited ops experience (I4). This is the main risk
  of the owner's choice. A hardening runbook and a patch routine are needed before staging.
- MongoDB must never listen on a public interface: bind to localhost or the private network,
  enable authentication, and keep the Hetzner firewall closed for port 27017.
- Media lives on one server disk between nightly copies. Up to 24 hours of uploads can be lost if
  the server fails, which the decided media RPO (≤ 24 h) allows. The EU bucket needs versioning
  and object lock, and its credentials must be separate from the app's (backup protection plan).
- Hetzner Backups are crash-consistent server images. They do not replace database backups.
- MongoDB Community Server is under the SSPL. Running it for our own website is the normal use;
  legal review belongs with D-M0-7 (licensing).
- MongoDB Community Server has no built-in encryption at rest (an Enterprise feature). Use full-disk
  encryption on the server (for example LUKS) and client-side encryption of backups (backup
  protection plan). The owner asked whether Community Edition is acceptable; the agent's answer
  was yes, with this gap.

## Known limitations

- Hetzner prices for Singapore were not verified; the public page shows only "from €5.99" and
  "from €6.49" per month (excl. VAT).
- The backup tool is not chosen. Percona Backup for MongoDB is an example, not a recommendation
  checked for license and advisories.
- MongoDB server version compatibility with the installed driver (`mongodb` 6.21.0) is not yet
  checked against the driver's compatibility table.
- The project's suites have not been run against MongoDB (they run on SQLite).

## Unresolved decisions

- D-DB-2, D-DB-3, D-DB-7: waiting for the DPO's answer to I1 (Singapore; EU copies).
- Backup tool for MongoDB PITR: tool choice, license and advisory check.
- TLS proxy and server hardening: tools need approval.
- D-GIT-36: approved; the owner opens the PR.

## Rollback guidance

Docs only. Revert the commit; no data or configuration changed.

## Cleanup

- The agent's server on `:3000` was stopped (its own background task) and the Chrome tab was
  closed.
- The suites' test page and workflow content stay in the local SQLite database, as after earlier
  runs. No test account was created.

## Recommended next step

Owner sends the DPO question. When the DPO answers I1, m1-039 records D-DB-2, D-DB-3 and D-DB-7
in a new session ([m1-039 handoff](../../../../milestones/m1-039-handoff.md)). Work that does not
wait for the DPO: run the suites against a local MongoDB, and choose the backup tool.
