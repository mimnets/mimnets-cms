# m1-064 — An interactive installer for the stack on a server

| | |
|---|---|
| **Task** | m1-064 |
| **Date** | 2026-11-10 |
| **Scope** | Candidate 1 of the m1-064 handoff: the design (D-DB-18), then the build of `docker/staging/install.sh` and runbook §10, with local tests. Not run on a server |
| **Prompt** | [2026-11-10-m1-064-installer-design.prompt.md](../../../prompts/2026/11/2026-11-10-m1-064-installer-design.prompt.md) |
| **Handoff** | [m1-064 start handoff](../../../../milestones/m1-064-handoff.md) · next: [m1-065 handoff](../../../../milestones/m1-065-handoff.md) |
| **Branch / commits** | `docs/m1-064-installer-design`, from `origin/main` (`4544d1d`); one commit (D-GIT-66, approved) |
| **Related** | D-DB-16 · D-DB-17 · **D-DB-18** · [m1-064 paper](../../../../milestones/m1-064-installer-design.md) · [staging container runbook](../../../../runbooks/staging-container.md) §8, §9.2, §10 |

Every check here was agent-executed on the owner's PC. That is not human approval.

## Status

**Built and tested locally; not run on a server.** The owner approved the design as written
(D-DB-18 A). The script covers both routes, standalone and behind NPM. It changes only the stack and
shows every other change for the owner to make. Route A ran through steps 0 to 8 on `amd64`. Route B
ran through `npm-setup.sh` and step 7, against a throwaway nginx standing in for NPM. Not yet tested:
a server, NPM itself, Let's Encrypt and Cloudflare.

The session was interrupted once when the owner's editor closed. It continued in a new session, from
the files on disk and the Git state.

## Changes

| File | Change |
|---|---|
| `docker/staging/install.sh` (new) | The installer: steps 0 to 9 (paper §4). Options: `--step N`, `--check`, `--help`. Answers come from `/dev/tty`. The log goes to `~/assurer-install-<date>-<time>.log`, mode `0600`. No state file. Route B calls `npm-setup.sh` unchanged |
| `docs/milestones/m1-064-installer-design.md` (new) | The design, D-DB-18. §7's open points now record the build's answers |
| `docs/runbooks/staging-container.md` | New §10 "Interactive install". A new row in §8. §9.2 step 4 corrected: NPM has no staging certificate per proxy host. Status and Files lines |
| `docs/engineering/decision-register.md` | D-DB-18 (decided), D-GIT-66 (open) |
| `docs/milestones/m1-065-handoff.md` (new) | Next candidates, including the owner's request for automated updates with a local AI agent (design first) |
| `docs/engineering/INDEX.md`, prompt record | Entry and in-session decisions |

## Build findings (fixed before this report)

| Finding | Fix |
|---|---|
| `[q]uit` did not stop the run. `choose` runs in `$(...)`, so its `exit` left only the subshell, and the next step ran | `quit_run` signals the main shell (`USR1`), which exits after printing the summary |
| End of input (`Ctrl-D`) looped forever in `ask()`, and in `choose()` wherever `q` was not offered | End of input quits the run |
| Settings written by hand (runbook §3) name no route, so step 1 would ask, and could put a standalone stack with content into NPM mode | Settings without a route count as standalone (or as NPM when `ASSURER_UPSTREAM_PROXY_IP` is set) |
| The 34 MB test could read `100` (`Expect: 100-continue`) instead of a final status | Sends an empty `Expect:` header |
| A failed NPM backup check ended step 7 with no retry | The check uses the same try, skip or quit loop as the others |
| `docker compose run` for certbot from a script with piped output | `run -T` |
| Result labels `7a`/`7b`/`7c` for route B clashed with step 7A (route A) | Labelled `7b(a)`, `7b(b)`, `7b(c)` |

## Open points from the paper (§7)

| Point | Result |
|---|---|
| NPM and Let's Encrypt's staging service | **NPM 2.15.1 has no staging option per proxy host.** Its only switch, `LE_STAGING`, is for the whole container (`backend/lib/config.js`, read on GitHub at tag `v2.15.1`). It would move every site behind NPM to staging certificates. So step 7(c) requests the real certificate and warns about Let's Encrypt's limit of 5 failed validations per host name per hour |
| certbot, from a staging to a real certificate | `--force-renewal` (certbot needs `--break-my-certs` only for the opposite direction; from certbot's documented behaviour, not read in its source). **NOT TESTED**: Let's Encrypt needs a public host name |
| Where NPM keeps `/etc/letsencrypt` | Step 7(a) shows NPM's mounts before the backup. Still unknown on the server |

## Tests executed and actual results

**Set-up.** Owner's PC: `amd64`, Git Bash, Docker 29.9.3, Compose v5.7.0. Disposable projects
`m1064a` (route A, on `127.0.0.1:18080` and `127.0.0.1:18443`) and `m1064b` (route B), and the
network `m1064-npm`. The test used a temporary copy of the script, with these changes only:

- The kernel check accepts any kernel, because Git Bash reports an MSYS kernel.
- Answers come from a file on fd 7 instead of `/dev/tty`, with `TEST_TTY` standing in for the terminal check.
- It calls a temporary copy of `npm-setup.sh` with the same kernel change.
- The NPM backup path is under `$HOME`.

Two test shims stood in for missing tools: `ss` (none in Git Bash) and `getent`, which answered a
documentation address, `203.0.113.5`. The test domain was `m1-064-test.example.org` (never resolved
publicly). A throwaway nginx (`assurer-nginx:staging`, with a self-signed certificate) stood in for
NPM. It sent `X-Real-IP`, and the override `ASSURER_NPM_CONTAINER` pointed the script at it.

| Check | Result |
|---|---|
| `bash -n` on the final script | **PASS** (ShellCheck not installed) |
| Route A, first run: route recommended (ports free, no NPM), `.env` written, build, start, 200 | **PASS** |
| Route A, step 4: HTTPS 200, HTTP 301 to `https://<domain>/` | **PASS** |
| Route A, step 6 with the DNS shim: answer equals the public address | **PASS** |
| Route A, step 7: the certbot commands shown with the domain and e-mail; both skipped | **PASS** (shown); **NOT TESTED** (run) |
| Route A, second run over the running stack: route and settings kept, rebuild and `up -d`, 200 again | **PASS** |
| Step 8, route A: redirect, 200, HSTS once, no `Server` version, `Secure` cookie, 413 at 34 MB, `pbmc status` (agent OK, PITR) | **PASS**. The certificate is self-signed, so the script reports FAIL, as expected |
| Step 8, visitor address: a helper sent the two marked requests in place of the PC; the script found both markers in nginx's log | **PASS** (mechanics). The address was `172.30.55.1` (route A) or `172.17.0.1` (route B), Docker Desktop's gateway, so the script reported FAIL, "a private address", as designed |
| Step 8, forged `X-Real-IP: 203.0.113.9` ignored | **PASS** (both routes) |
| `--check` without a terminal: the server checks run; the visitor check is recorded NOT TESTED | **PASS** |
| A full run without a terminal stops before any change | **PASS** |
| `[q]uit` at step 5: summary, exit 0, no later step | **PASS** (after the fix) |
| End of input at a prompt ends the run | **PASS** (after the fix; first seen as an endless loop) |
| `--step 6`, change to `Bad_Name`: refused, then skipped; the domain unchanged | **PASS** |
| `--step 12`, `--nope`: refused, exit 2 | **PASS** |
| Settings without `ASSURER_PROXY_MODE` (runbook §3 style): kept as standalone, and the route re-added | **PASS** |
| No settings, port 443 busy, no NPM: stops in step 1 before writing anything | **PASS** |
| Route B, first run: B recommended (NPM found), `.env` with NPM's address, `npm-setup.sh` creates the network, builds, starts and gets 200 on `:8080`; nginx logs "NPM mode … trusted from 172.30.56.2 only" | **PASS** |
| Route B, step 6: `npm-setup.sh --domain`, 200 for the new name; the DNS check passes | **PASS** |
| Route B, step 7, stand-in not joined: NPM's mounts shown, the backup commands shown, the check fails, try again offered | **PASS** (after the fix) |
| Route B, step 7, stand-in joined at `172.30.56.2` with `IP_RANGES_FETCH_ENABLED=false` and port 81 on `127.0.0.1`: "already joined", nothing else on the network | **PASS** |
| Route B, step 7(c): 200, 301, and a refusal because the issuer is not Let's Encrypt | **PASS** (the refusal is correct) |
| Route B, step 8: redirect, 200, HSTS once, `Secure` cookie, 413, PBM | **PASS** (413 after the `Expect:` fix; the first run read `100`) |
| Route B, step 8, no `Server` version | FAIL, correctly: the stand-in itself sends `nginx/1.30.6`. NPM's own header is not known |
| Route B, step 8, port 81 question | **PASS** (answered, recorded) |
| The NPM backup check's PASS path (mode `600`) | **NOT TESTED**: NTFS shows no Unix modes. For the same reason, `.env`'s mode `0600` was not verifiable here |
| `npm run lint` | **PASS**, exit 0 (it does not lint shell scripts) |
| `npm run test:smoke` / `test:workflow` / `test:persistence` | **PASS**, 18/18, 15/15, 7/7, against the local site on `127.0.0.1:3000`. This task changes no app code |

## Browser checks (agent-executed, Claude in Chrome)

| # | Check | Result |
|---|---|---|
| 1 | Short smoke check of the local site, `http://127.0.0.1:3000/`: home page renders ("Home", demo content) | **PASS**. No console errors were seen, but tracking started after the page had loaded |
| 2 | The site through the installer on a server, as a non-admin editor | **NOT TESTED**: no server run; a public host name needs the owner's approval |

## Clean-up

The following were removed with `down -v` or `rm`: both projects (containers, volumes, networks), the
stand-in, the `m1064-npm` network, the test `.env`, the temporary script copies, the run logs in the
home folder and the Chrome tab. Left: the rebuilt `assurer-*:staging` images (they existed before,
under the same tags; older layers may now be dangling), and the shims and answer files in the
session's scratch folder, outside the repository.

## Not done or not verified

- Any run on a server. Route A on a real server (no server without NPM yet).
- NPM itself: the Portainer edit text (step 7(b)) was reviewed but not applied anywhere. The proxy
  host and NPM's `Server` header are also untested.
- Let's Encrypt: certbot's `--test-cert` then `--force-renewal`, and NPM's certificate.
- Cloudflare: the real DNS answer and the orange-cloud warning (the address ranges are coded but not
  exercised).
- Step 5 (public address from the PC) was only skipped, not run.
- The NPM backup's mode check and `.env`'s mode on Linux.
- The real `/dev/tty` path and `ss` output (both stood in for in the test copy).
- IPv6, per-visitor 429 (manual by design), and the production items of runbook §9.2.

## Agent errors in this task

- The first version of the script had the quit and end-of-input faults in the table above. They were
  found in local tests.
- In the tests: the first route A answers file had one answer too few, the shims first did not load
  (a `C:` path in `PATH`), and one helper pattern had its words in the wrong order. The affected runs
  were repeated after fixing the test, not the script.
