# Prompt — m1-065: running the installer on the owner's OCI server, route B

| | |
|---|---|
| **Task** | m1-065 |
| **Date** | 2026-11-11 |
| **Source** | Repository owner, typed into a new Claude Code session. Owner replies are quoted as given. No secrets were in the prompt. |

---

start from handoff

---

**In-session decisions (owner):**

1. The agent reported that PR #74 was merged (`8a194f3`), carrying `2df6c55` (m1-064), with lint,
   secrets, audit, test, `staging-arm64` and build green on `2df6c55` (read from the GitHub API; `gh`
   is not installed on this PC). Of the four candidates in the m1-065 handoff §2, the owner chose:
   **"Run installer on OCI (Recommended)"**.
2. The agent proposed phases 0 to 8 and asked whether step 6 would use a throwaway test host name.
   The owner: **"please remember don't go with any test i need production and what is throwaway?"**
   The agent reads this as: the OCI install is the production install (D-DB-17 as amended in m1-063),
   not a disposable test, and explained what a throwaway host name is.
3. The agent explained that production on this stack still leaves the runbook §9.2 items open, and
   that pointing a name WordPress serves today at the server is the go-live. Asked which host name
   production uses, the owner: **"no need any temporary subdomain"**.
4. Asked whether the WordPress site serves the production host name today, the owner: **"yes,
   wordpress serves it now"**. So installer step 6 (the Cloudflare record) is the go-live and takes
   the WordPress site offline for that name. The agent stops before step 6 for a separate go-ahead.
5. The owner: **"please skip this install sh procedures - i am not clear why we are doing this? can
   you make this simple docker compose package and then expose the ip with port and then users can
   browse the web ui to complete the setup process for domain, ngnix, cloudflare, data migration
   etc?"** The agent advised against a setup page that changes nginx, NPM or Cloudflare from inside
   the site (Docker and root control from the web) and against plain HTTP open to everyone. Asked how
   to reach the site before go-live, the owner chose **"Port open to everyone"**, then **"don't waste
   my time"**. Built as IP mode: `compose.ip.yaml`, `ip-setup.sh`, runbook §11.
6. The owner: **"also add guide into md file alogn with if port already exists"** (runbook §11.2),
   **"what is docker.ip.yaml file?"**, **"docker is running now"**, and **"i have told you i will run
   on the armbased oci server first and later will maybe move to amd based server. so, plan and build
   as per requirements."**
7. The owner asked whether a push comes first and whether the guide is in a Markdown file as the
   first setup step. The agent added "start here" pointers (runbook top, README "Server setup"). The
   owner: **"yes, commit and push"** (D-GIT-67).
