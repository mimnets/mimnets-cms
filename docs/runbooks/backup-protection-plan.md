# Backup protection plan (proposal)

| | |
|---|---|
| **Status** | **Proposal, not executed** (`m1-011`, 2026-10-20). Nothing was encrypted, moved, uploaded or deleted. Each step below needs the owner's approval (D-M0-9). |
| **Related** | D-M0-9 · [backup and restore runbook](./database-backup-and-restore.md) · ADR-0002 §3 and §5 |

## 1. Current state (observed 2026-10-20, metadata only)

The archive contents were not opened. What they contain is taken from the m0-004 and m0-006
records (D-M0-9).

| Folder (`../vcl-assurer-group-backups/`) | Files | Size | Recorded contents |
|---|---|---|---|
| `2026-10-19-m0-004-pre-git/` | `database.jsonl`, `project.tar.gz`, `SHA256SUMS` | 0.18 MB + 8.5 MB | Project snapshot **including `.env`** (session secret, test-admin password) and the old, rotated password file; database dump with password hashes and sessions |
| `2026-10-19-m0-006/` | `database.jsonl`, `uploads.tgz`, `SHA256SUMS` | 0.22 MB + 10.5 MB | Database dump (password hashes, sessions, bearer tokens if any, demo form submissions) and media |

- **Access control:** the folder ACL grants full control to `SYSTEM` and the owner's account only.
  It inherits to both subfolders. No other local user or group has access.
- **Sync:** the folder is under `Documents`, which is not redirected to OneDrive on this machine,
  so it is not synced.
- **Disk encryption:** **not verified.** BitLocker status needs an elevated prompt
  (`manage-bde -status C:`). The owner should check it.
- **Encryption of the files:** none.
- **Exposure if leaked:** sessions are invalidated by rotating `APOS_SESSION_SECRET` (already done
  for the m0-004 secret, D-M0-6). Password hashes allow offline guessing. Form submissions are
  demo data. The value is low today, but the same procedure will later hold real personal data.

## 2. Requirements

| | Development (local) | Staging / production |
|---|---|---|
| Encryption at rest | Every dump or archive that contains `.env`, `aposUsersSafe`, `aposSessions`, `aposBearerTokens` or form submissions is encrypted **before** it is written to any shared, synced or removable location. Full-disk encryption (BitLocker) on the machine as a baseline. | Provider-managed encryption (PITR snapshots, KMS) **plus** client-side encryption of portable exports (`apos-db-dump` JSONL, `pg_dump`) before upload. Bucket server-side encryption, versioning, and object lock or retention for the backup bucket. |
| Algorithm | Public-key file encryption (recommended: `age`, X25519 + ChaCha20-Poly1305), or 7-Zip AES-256 with a long random passphrase if a new tool is not approved | Same as development for exports. KMS keys for provider snapshots |
| Key custody | Private key or passphrase in the owner's password manager, plus one offline copy (printed or on a hardware token) in a separate physical place. Never in the repository, `.env`, the backup folder or chat. | Two named custodians; a key in the organisation's secret store; break-glass procedure written down; rotation yearly and when a custodian leaves |
| Access | Owner account only (as today) | Backup bucket in a separate account or project; write-only credentials for the backup job; read access only for named restore operators; access logged |
| Retention | Delete a backup once a newer verified backup supersedes it (m0-004 archive first) | Per D-DB-4 (decided m1-038: 7 days PITR, 12 monthly exports) |
| Restore verification | Decrypt and restore into a **new** throwaway database, then run `npm run test:smoke` | Quarterly drill (runbook §G) into an isolated environment, with a dated report |
| Secrets in dumps | Before any copy to another environment, run the "sanitize after restore" task (D-DB-6 blocker): drop sessions and bearer tokens and rotate `APOS_SESSION_SECRET` | Same |

## 3. Reversible procedure for the existing archives (needs approval)

Each step can be undone until step 6, and step 6 needs its own explicit approval.

1. **Tool approval.** `age` (BSD-3-Clause, single binary, pinned release with checksum, like
   gitleaks in m1-009) is a new tool and needs approval. Without it, use 7-Zip AES-256 with a
   generated passphrase, if 7-Zip is already installed.
2. **Key.** Generate the key pair (`age-keygen`) on this machine. Store the private key in the
   password manager and its offline copy. Only the public key stays on disk.
3. **Encrypt copies** (the originals stay untouched):
   `age -r <public key> -o database.jsonl.age database.jsonl`, and the same for each file in
   both folders. Keep `SHA256SUMS` in plain text (it holds only hashes).
4. **Verify.** Decrypt each `.age` file to a temporary location, compare with `SHA256SUMS`,
   then delete the temporary plaintext.
5. **Restore test.** Decrypt the m0-006 dump to a temporary directory, then
   `apos-db-restore` into a **new** SQLite file there. Run `migration:migrate` and
   `npm run test:smoke` against it on a spare port. Delete the temporary directory.
6. **Remove plaintext** (separate approval). Delete the plaintext originals of the m0-006 folder.
   Delete the whole m0-004 folder once M1 has its own verified, encrypted backup; its `.env`
   secret was already rotated. Record the result under D-M0-9.

Rollback for steps 2–5: delete the `.age` files and the key; the originals are unchanged.

## 4. Changes to the backup procedure (proposed)

- `database-backup-and-restore.md` §A: pipe straight into encryption, so no plaintext file is
  written: `npx apos-db-dump … | age -r <public key> > backups/<date>-local.jsonl.age`, and the
  same for `tar … | age …`. To be adopted together with the tool approval.
- Never include `.env` in a project archive. Use `git archive` for code, and back up secrets
  separately in the password manager or secret store.
