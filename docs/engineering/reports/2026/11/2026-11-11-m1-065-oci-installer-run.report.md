# m1-065 — The site on the owner's OCI server in IP mode, and the import and design decisions

| | |
|---|---|
| **Task** | m1-065 |
| **Date** | 2026-11-11 |
| **Scope** | Candidate 1 of the m1-065 handoff (the installer on the OCI server, route B), changed in session by the owner to IP mode: the stack on the server's public address and one port, set-up through web UIs. Then the owner's decisions on the WordPress import and the design approach |
| **Prompt** | [2026-11-11-m1-065-oci-installer-run.prompt.md](../../../prompts/2026/11/2026-11-11-m1-065-oci-installer-run.prompt.md) |
| **Handoff** | [m1-065 start handoff](../../../../milestones/m1-065-handoff.md) · next: [m1-066 handoff](../../../../milestones/m1-066-handoff.md) |
| **Branch / commits** | `test/m1-065-oci-installer-run`, from `origin/main` (`8a194f3`); `17ef42e` (D-GIT-67, approved), and the records commit (D-GIT-68) |
| **Related** | **D-DB-19** · D-DB-17 · D-DB-18 · **D-CONTENT-16 (changed), D-CONTENT-17, D-CONTENT-18** · [staging container runbook](../../../../runbooks/staging-container.md) §11 · [CA-5 checklist](../../../../content/ca5-migration-checklist.md) |

Every check here was agent-executed. That is not human approval.

## Status

**The site runs on the owner's OCI server (`arm64`) in IP mode**, on plain HTTP at the server's
public address, port 8090, open to everyone (D-DB-19; the address is kept out of the records). The
editor workflow passed in Chrome through the public address. The installer (`install.sh`, D-DB-18)
was not run: the owner asked for a simpler package. Nothing about the domain, NPM, Cloudflare or the
certificate changed. The WordPress site is unchanged and still serves the domain.

The stack is still the staging build. The runbook §9.2 production items stay open.

## Owner's decisions in this task

| Decision | Summary |
|---|---|
| Production, not test (prompt items 2 to 4) | The OCI install is production (D-DB-17 as amended); no throwaway host names. The production host name is served by WordPress today, so the domain switch is the go-live and waits for the owner |
| D-DB-19 | IP mode in place of the installer run; port open to everyone, against the agent's advice. Risk accepted: plain HTTP |
| D-CONTENT-16 → B, D-CONTENT-17 | An automated, repeatable WordPress import into drafts, read-only on WordPress. Test run on the OCI site; its database is wiped before the final run ("Same site, wipe later"), with a backup and its own approval then |
| D-CONTENT-18 | Design after the import, from example sites the owner names; original directions, no copying |

## Changes

| File | Change |
|---|---|
| `docker/staging/compose.ip.yaml` (new) | IP mode: `site` publishes `${ASSURER_IP_PORT:-8090}:3000`; `APOS_BASE_URL` is `http://<public IP>:<port>`; `APOS_HTTPS=0`, no proxy trust, no HSTS; `cert-bootstrap`, `nginx` and `certbot` do not start |
| `docker/staging/ip-setup.sh` (new) | Checks the IP, the port (1024 to 65535), the kernel (6.8, D-DB-16), a standalone stack, and whether a container or another program holds the port; writes `.env` with the same keys as `npm-setup.sh`, so `npm-setup.sh --domain` takes over at go-live; builds and starts the site; waits for a 200; prints the next steps |
| `docs/runbooks/staging-container.md` | New §11 (start, port in use, everyday commands, go-live); "start here" note at the top; Status and Files lines |
| `README.md` | "Server setup" section pointing to §11 |
| `docs/engineering/decision-register.md` | D-DB-19, D-CONTENT-16 changed, D-CONTENT-17, D-CONTENT-18, D-GIT-66 merged, D-GIT-67, D-GIT-68 |
| `docs/content/ca5-migration-checklist.md` | §6 note: D-CONTENT-16 changed to the automated import |
| `docs/milestones/m1-066-handoff.md` (new), `docs/engineering/INDEX.md`, prompt record | Next task, entry, in-session decisions |

`install.sh`, `npm-setup.sh` and the app code are unchanged.

## Tests executed and actual results

**Owner's PC** (`amd64`, Docker 29.x, Compose v5.7.0, Git Bash). A disposable project `m1065ip`
on port 18090, from the existing `assurer-site:staging` image (built in m1-064; no app change since).

| Check | Result |
|---|---|
| `bash -n docker/staging/ip-setup.sh` | **PASS** |
| `compose config` with the IP override: services `base` and `site` only; `site` publishes 8090; `APOS_HTTPS` `0`, `APOS_TRUST_PROXY` and `APOS_HSTS_MAX_AGE` empty | **PASS** |
| `m1065ip` site starts, healthy; home 200 on the published port | **PASS** |
| Admin login over plain HTTP: login API 200; session, login and CSRF cookies without `Secure`; draft pages API 200 when signed in | **PASS** |
| Port held by another container (`m1065ip-site-1` on 18090): stops and names it | **PASS** (temporary copy with the kernel check removed; nothing written) |
| Bad IP (`999.1.1.1`) and port `80`: refused | **PASS** |
| Port held by a program outside Docker | **NOT TESTED** (no `ss` in Git Bash) |
| The script's full build-and-start run | **NOT TESTED** on the PC (kernel check); run on the server, below |
| `npm run lint` | **PASS** (it does not lint shell scripts) |
| `npm run test:smoke` / `test:workflow` / `test:persistence` | **PASS**, 18/18, 15/15, 7/7, against the local site on `127.0.0.1:3000`. No app code changed |

The `m1065ip` project was removed with `down -v` (its own containers, volumes and network only).

**OCI server** (owner-executed): `ip-setup.sh <public IP>` on `main` after PR #75 (`ca671ae`) ran to
the end and printed its next steps (owner's paste). From the agent's PC: home 200 in 0.54 s, `/login`
200 on port 8090. The OCI ingress rule was not needed: the port answered at once.

## Browser checks (agent-executed, Claude in Chrome, public address, port 8090)

| # | Check | Result |
|---|---|---|
| 1 | Home page signed in (the owner's Chrome session as `admin`): admin bar, no console errors, no broken images, no horizontal overflow at 1440 px; canonical and links on the public address | **PASS** (the page is empty: no demo content in this build) |
| 2 | Logged out (curl): drafts API 403, users API 404, `X-Robots-Tag: noindex, nofollow`, `robots.txt` `Disallow: /`, no `Server` header, CSRF cookie without `Secure` (plain HTTP) | **PASS** |
| 3 | Editor account `m1-065-editor` (made by the owner in the UI): first saved with the default role, so no editing menus and drafts 403 | **FAIL**, then fixed by the owner (role Editor) |
| 4 | As editor: Pages, Content, Media, Forms, Redirects; no Site admin | **PASS** |
| 5 | New page "m1-065 test - delete me", Hide in Navigation on, saved as draft; logged out 404 | **PASS** |
| 6 | Rich Text added (autosave), published; logged out 200 with the text; not in the public menu | **PASS** |
| 7 | An edit after publishing, not published: the marker absent from the public page | **PASS** |
| 8 | Archived through More options → Archive; logged out 404 | **PASS** |
| 9 | 768 and 375 px | **NOT TESTED**: the Chrome window did not resize (it reported 1440 px). No template or layout changed in this task |

## Clean-up and leftovers

- The test page is archived (not deleted), by the editor, through the UI.
- **Left:** the `m1-065-editor` account on the OCI site. An editor cannot archive users; the owner
  archives it as admin or keeps it.
- The agent's Chrome tab is closed. The owner's Chrome may still hold the editor session.
- The site's first admin password file is still in the secrets volume until the owner removes it
  (runbook §3).

## Not done or not verified

- The installer (`install.sh`) on a server; NPM, Cloudflare, Let's Encrypt and the go-live switch
  (runbook §11.4), including `npm-setup.sh --domain` over an IP-mode stack.
- Tablet and phone widths in Chrome.
- The runbook §9.2 production items.
- **Running Apostrophe tasks inside the staging container** (`user:add`, `assurer-seo:seed-redirects`)
  has no documented command: the entrypoint builds the database URI, so a plain `exec … node app`
  lacks it. The editor account was made in the UI for this reason. Needed before the import's redirect
  step (m1-066 handoff).

## Agent errors in this task

- The agent described the WordPress move as manual entry only (D-CONTENT-16 A) and did not say that
  an automated import was possible. The owner challenged it, and the decision changed (D-CONTENT-17).
- The first port check accepted a port held by any Docker container; fixed before the commit after
  the owner's request for the port-in-use guide.
- Two local test commands failed from Git Bash path conversion and a `/tmp` path passed to Windows
  `curl`; repeated with the paths fixed.
