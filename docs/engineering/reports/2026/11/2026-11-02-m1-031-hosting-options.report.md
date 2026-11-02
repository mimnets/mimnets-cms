# m1-031 — Hosting options paper (D-DB-2, D-DB-3, D-DB-4)

| | |
|---|---|
| **Task** | m1-031 |
| **Date** | 2026-11-02 |
| **Scope** | Candidate 2.1 of the [m1-031 handoff](../../../../milestones/m1-031-handoff.md): an options paper for the staging and production database, media store, app hosting and backup targets. Docs only; no provider chosen, no account created |
| **Prompt** | [2026-11-02-m1-031-hosting-options.prompt.md](../../../prompts/2026/11/2026-11-02-m1-031-hosting-options.prompt.md) |
| **Handoff** | [m1-031 start handoff](../../../../milestones/m1-031-handoff.md) · next: [m1-032 handoff](../../../../milestones/m1-032-handoff.md) |
| **Branch / commit** | `docs/m1-031-hosting-options` from `origin/main` `f81f087` (m1-030 merged as PR #33). Commit and push approved by the owner (D-GIT-29); PR opened by the owner |
| **Related** | D-DB-2 · D-DB-3 · D-DB-4 · D-DB-5 · D-DB-6 · D-DB-7 (new) · D-CONTENT-15 · D-CONTENT-16 · D-GIT-28 · D-GIT-29 (new) |

## Approvals used

- Task chosen by the owner in session: "(a) Hosting options paper (Recommended)".
- Engine direction from the owner: "ok, stick with postgres, continue". The paper compares
  PostgreSQL providers only. MongoDB stays the ADR-0002 fallback. The direction does **not** lift
  the D-DB-6 staging blockers.
- No architecture gate was passed. Nothing was decided for D-DB-2/3/4/7. No package changed, no
  code changed, no account was created.

## Start state

- PR #33 merged (`f81f087` on `origin/main`). Hosted CI on it: **not checked** by the agent
  (`gh` is not installed); the owner stated in the prompt that its checks are green.
- `docs/m1-030-content-entry-decision` was clean. The dev server was already running on `:3000`
  (SQLite, `APOS_DEMO_SITE=1`).

## What was done

| Item | Result |
|---|---|
| [Hosting options paper](../../../../milestones/m1-031-hosting-options.md) | Requirements R1–R8; the effect of D-DB-5 on the choice; comparison of managed PostgreSQL, object storage and app hosting; shortlist A (AWS, UAE), B (Azure, UAE), C (DigitalOcean, Singapore or Bangalore); D-DB-4 mapping; owner and DPO inputs I1–I6; path to staging |
| Decision register | D-DB-2, D-DB-3, D-DB-4: status notes pointing to the paper. **D-DB-7** (new, open): app hosting and supervision. D-GIT-28 marked merged. **D-GIT-29** (new, open) |
| Records | Prompt, this report, INDEX row and next-task line, [m1-032 handoff](../../../../milestones/m1-032-handoff.md) |

### Research method and limits

- A research subagent read official provider documentation and public price APIs on 2026-11-02
  (read-only). Sources are listed in paper §9. Items it could not confirm are marked "not
  verified" in the paper: the Cloud SQL price, Azure Container Apps and App Service in UAE North,
  Azure storage price and HA on Burstable, ECS task replacement wording, and Spaces replication.
- The subagent reported creating and then deleting a temporary price file in the repository root.
  The agent checked afterwards: the file is gone and `git status` showed only this task's files.
- Upstream: `@apostrophecms/db-connect` is still **1.1.0** on npm, and no GitHub issue about the
  missing pool `error` listener exists. D-DB-5 is unchanged.

### Findings

1. **Every managed PostgreSQL drops connections during maintenance or failover**, as the RDS,
   Cloud SQL, Azure and Neon docs state. Until D-DB-5 is fixed upstream, each such event restarts
   the app. A supervisor with health checks is required on every option, not only on some.
2. **Neon and Supabase are excluded.** Their scale-to-zero and pooler idle timeouts close idle
   connections as normal operation.
3. **Only AWS and Azure offer UAE regions** among the providers checked. DigitalOcean has no
   Middle East region. Google has Doha and Dammam but not the UAE.
4. **Cloudflare R2 has no object versioning**, so it fails ADR-0002 §3.
5. **AWS App Runner is closed to new customers.** ECS on Fargate is the AWS path.

### In-session questions answered (not decisions)

- "what db are we using?": SQLite locally (`APOS_DB_URI` scheme `sqlite:`); nothing chosen for
  staging or production.
- "can we use mysql?": no supported adapter (db-connect ships `mongodb`, `postgres`, `sqlite`).
- Appwrite as the database: not a fit. It is a backend-as-a-service reached through its own API,
  not a database Apostrophe can connect to. Keeping content there would be the parallel CMS
  database that ADR-0002 forbids, and Appwrite Storage is not an uploadfs backend.
- Cheapest suitable option for a site of this size: one small single-node instance. At about
  $15/month list, that is DigitalOcean (Singapore or Bangalore) or Azure Burstable B1MS (UAE
  North), each plus storage and media. The choice depends on the DPO's residency answer (I1).

## Test results

| Command | Result |
|---|---|
| `npm run lint` | PASS (exit 0, no ESLint output) |
| `npm run test:smoke` (`:3000`) | PASS, 18/18 |
| `npm run test:workflow` (`:3000`) | PASS, 15/15 |
| `npm run test:persistence` (`:3000`) | PASS, 7/7 |

Not run: `test:unit`, `test:ci`, `build`, `audit:check` (no code or dependency change).

### Browser checks (Claude in Chrome, agent-executed; not human approval)

Docs-only task: short smoke check of the public site on `http://127.0.0.1:3000`, window 1440 px.

| # | Check | Result |
|---|---|---|
| B1 | Home page loads logged out | PASS: title "Home", one H1, "Log in" button, no admin bar, demo notice shown, no horizontal overflow (screenshot viewed, not saved) |
| B2 | Draft privacy page stays hidden | PASS: `/privacy` returns 404 to a request without cookies |
| B3 | 768 and 375 px | NOT TESTED: no layout or template change |

## Clean-up

- The Chrome tab used for the check was closed. No accounts or content were created.
- The dev server on `:3000` is still running. The m1-027 draft page `/privacy` is unchanged.
- Outside the repository: the agent saved the PostgreSQL direction to its local memory, at the
  owner's request.

## Open items

- D-GIT-29: commit and push approved; PR to be opened by the owner, hosted CI to be confirmed on it.
- Owner and DPO inputs I1–I6 (paper §7), then decisions D-DB-2, D-DB-3, D-DB-7 and D-DB-4.
- D-DB-5: upstream issue still not filed (text ready in the D-DB-5 proposal).
- D-DB-6 staging blockers: Linux repeat test with the chosen major version; "sanitize after
  restore" task.
- D-CONTENT-15 (privacy notice DPO review) and D-CONTENT-11 (publishing workflow) unchanged.
