# Prompt — m1-038: hosting inputs and backup targets (D-DB-4)

| | |
|---|---|
| **Task** | m1-038 |
| **Date** | 2026-11-04 |
| **Source** | Repository owner, typed into a new Claude Code session. Recorded as given; nothing redacted (the prompts contain no secrets). Owner replies are quoted as given. |

---

Start from this docs/milestones/m1-038-handoff.md

---

**In-session decisions (2026-11-04, owner):**

1. The agent listed candidates (a) to (d) from the handoff and asked which one to do. The owner
   chose:

   > (a) Hosting decisions

   The agent found that none of the inputs I1 to I5 ([hosting options paper](../../../../milestones/m1-031-hosting-options.md)
   §7) were recorded, and listed them.

2. The owner replied:

   > no personal data submission law concent required, why do we need to know the services assurer are usingi?, singapore or india either.

   The agent explained that I2 (existing cloud accounts) only affects billing, sign-in and
   procurement, and is not required. It then asked three multiple-choice questions. The owner
   answered:

   > 7 days is enough

   (PITR retention for D-DB-4; the question said the other proposed targets stay unchanged.)

   > About $50–100

   (monthly budget for staging and production together.)

   > In-house, limited ops

3. While the agent was checking App Platform prices, the owner wrote:

   > dpo will decide

   The agent's reading: the DPO, not the owner, gives I1 (applicable law and acceptable hosting
   regions). So D-DB-2, D-DB-3 and D-DB-7 stay open. The owner's statement in item 2 is recorded as
   the owner's view and preference, not as the DPO's answer.

4. The agent proposed a docs-only task: record I2 to I5, decide D-DB-4 if the owner is the
   business owner, mark the provider decisions as waiting for the DPO, and prepare a question for
   the DPO. The owner replied:

   > yes, i'm the business owner, go ahead

5. Before the commit, the owner asked:

   > can you please consider using Hetzner - self-hosted server with monogodb or supabase?

   The agent checked Hetzner's documentation (locations, Object Storage) and compared Hetzner with
   self-hosted MongoDB against DigitalOcean (option C). It recommended keeping C for its lower ops
   effort, and advised against Supabase, hosted or self-hosted. The owner replied:

   > i prefere htzner

6. The agent asked three multiple-choice questions. The owner answered:

   > MongoDB (Recommended)

   (database engine; the question named it an architecture gate and said ADR-0002 would be
   updated.)

   > Approve a backup tool

   (keep the 15-minute RPO; the question said the specific tool still needs a license and
   advisory check.)

   > Server disk + EU copy

   (media on the Singapore server, a nightly copy to a versioned Hetzner bucket in the EU; the DPO
   must accept the EU copy.)

7. The owner asked:

   > MongoDB Community Edition would be okay for us right?

   The agent answered yes: the SSPL restricts offering MongoDB as a service to others, not running
   it for one's own website; Apostrophe runs on it natively. The gap is encryption at rest, which
   is Enterprise-only; full-disk encryption on the server covers it.

8. The agent asked whether to commit and push the branch (D-GIT-36). The owner replied:

   > yes
