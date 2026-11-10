# m1-059: the server kernel for MongoDB 8.0 (D-DB-16)

| | |
|---|---|
| **Task** | m1-059 |
| **Date** | 2026-11-10 |
| **Author** | The agent (agent-executed; not a human approval) |
| **Status** | **Decided 2026-11-10 by the owner: option A now, B later** (D-DB-16). The commands in §4 are not tested |
| **Related** | D-DB-16 · D-DB-8 · D-DB-2 · D-DB-7 · [ADR-0004](../architecture/decisions/ADR-0004-mongodb-for-staging-and-production.md) · [m1-058 report](../engineering/reports/2026/11/2026-11-09-m1-058-staging-proof.report.md) · [hardening runbook](../runbooks/server-hardening-and-patching.md) §4 |

This is a paper task. No server was used, and nothing here was tested. Each fact below comes from
the source named next to it, read on 2026-11-10.

## 1. Summary

- MongoDB 8.0.34 is pinned in `docker/staging/Dockerfile`. It stops at startup on kernels 6.19 to
  7.0.13. On **Ubuntu kernels in the 7.0 series it may also stop when the kernel has the fix**. Ubuntu
  reports `7.0.0-<ABI>` and not the upstream patch number, and MongoDB adds the exemption for Ubuntu only
  in 8.0.37, which has not shipped.
- **Ubuntu 24.04 LTS already moves some servers to 7.0.** The 24.04.5 HWE kernel is 7.0 (July 2026).
  Two cloud kernel metapackages now point at 7.0: `linux-oracle`, which is 7.0.0-1016 in `noble-updates`
  since 2026-11-09, and `linux-azure`. A 24.04 server that follows them gets 7.0 at the next upgrade and
  reboot, and MongoDB then stops. This is a likely cause of the m1-058 refusal on `ubuntu-24.04-arm`,
  which runs on Azure. The agent did not read that runner's kernel, so this is not confirmed.
- **Recommendation: option A** (§4). Stay on the Ubuntu 24.04 kernel series **6.8**, through the
  metapackage that stays on 6.8. That is `linux-generic` or `linux-virtual` on a plain VM, and
  `linux-oracle-lts-24.04` on OCI. Check the kernel before every start and every reboot. Plan the move
  to option B (7.0 with a fixed MongoDB) later, as its own approved task.

## 2. The facts

| Fact | Source |
|---|---|
| Kernels 6.19 to 7.0.13 can crash MongoDB 8.0. MongoDB detects them and stops at startup. This applies to every package, Docker included, and no override is documented. 7.0.14 and later resolve it | [Production notes](https://www.mongodb.com/docs/manual/administration/production-notes/) |
| Cause: the TCMalloc inside `mongod` breaks the kernel's rseq ABI | [SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912) |
| 8.0.30 stops refusing kernels 7.0.14 and later | [SERVER-125742](https://jira.mongodb.org/browse/SERVER-125742), fix versions |
| "Ubuntu's Linux kernel version numbers differ from upstream", so the check fails on Ubuntu builds. The fix is in 8.0.37, 8.3.16 and 9.0.4 | [SERVER-131779](https://jira.mongodb.org/browse/SERVER-131779) |
| The newest released 8.0 is **8.0.34 (2026-10-13)**. 8.0.37 is "Upcoming", with no date | [8.0 release notes](https://www.mongodb.com/docs/manual/release-notes/8.0/) |
| Users report the refusal on Ubuntu 26.04 (`7.0.0-22`, `7.0.0-27-generic`) and on Ubuntu 24.04 based systems with `7.0.0-14-generic` | [SERVER-131155](https://jira.mongodb.org/browse/SERVER-131155), [SERVER-129219](https://jira.mongodb.org/browse/SERVER-129219) |
| Ubuntu 24.04 kernels: GA 6.8; HWE 6.17 in 24.04.4 (January 2026); HWE **7.0** in 24.04.5 (July 2026). Ubuntu 22.04: GA 5.15, HWE 6.8 | [Ubuntu kernel lifecycle](https://ubuntu.com/kernel/lifecycle) |
| 24.04, OCI: `linux-oracle` is **7.0.0-1016.18~24.04.1** in `noble-updates` (2026-11-09). `linux-oracle-lts-24.04` stays on 6.8 | [ubuntuupdates: linux-oracle, noble](https://ubuntuupdates.org/package/core/noble/main/updates/linux-oracle) |
| 22.04, OCI: `linux-oracle` is **6.8.0-1067** in `jammy-updates` | [ubuntuupdates: linux-oracle, jammy](https://ubuntuupdates.org/package/core/jammy/main/updates/linux-oracle) |
| 24.04, Azure: `linux-azure` "now points at kernel 7.0". To stay on 6.8, follow `linux-azure-lts-24.04` | [Ubuntu Discourse](https://discourse.ubuntu.com/t/kernel-7-0-is-now-the-default-for-ubuntu-24-04-lts-on-azure/88459) |
| 24.04: `linux-image-generic` and `linux-image-virtual` are on 6.8.0-124 | Search result from ubuntuupdates; the package page itself was not opened |

**A correction to D-DB-16 option C.** The register gives the workaround as
`GLIBC_TUNABLES=glibc.pthread.rseq=1`. SERVER-121912 names
`glibc.pthread.rseq=0:glibc.cpu.hwcaps=-SHSTK` instead, and a linked issue says that this was not enough
on 6.19.8. A blog post from 2026-07
([snowgoons.ro](https://snowgoons.ro/posts/2026-07-01-mongodb-and-the-new-linux-kernel/)) also found no
tunable that kept MongoDB running in containers. Option C is not supported by any source read here.

**Not established here:**

- The kernel flavour on Hetzner's Ubuntu 24.04 image.
- Which Ubuntu `7.0.0-<ABI>` builds contain the upstream 7.0.14 fix.
- The kernel of the owner's OCI server today. The [OCI runbook](../runbooks/project-test-on-oci-docker.md)
  says Ubuntu 22.04 `aarch64`, written in m1-042.
- The kernels of the GitHub runners.
- What SERVER-125742's table means by "8.0.35+". The release notes go from 8.0.34 to an upcoming 8.0.37.

## 3. What this means for the candidate hosts

| Host | Kernel line it follows | MongoDB 8.0.34 |
|---|---|---|
| Ubuntu 24.04, `linux-generic` or `linux-virtual` (GA) | 6.8 | Starts |
| Ubuntu 24.04, HWE (`linux-generic-hwe-24.04`) | 7.0 since 24.04.5 | **Stops** |
| Ubuntu 24.04 on OCI, `linux-oracle` (image default) | 7.0 | **Stops** after the next upgrade and reboot |
| Ubuntu 24.04 on OCI, `linux-oracle-lts-24.04` | 6.8 | Starts |
| Ubuntu 24.04 on Azure, `linux-azure` | 7.0 | **Stops** |
| Ubuntu 22.04 on OCI, `linux-oracle` (the owner's server, m1-042) | 6.8 | Starts. 22.04's standard support ends in 2027 |
| Ubuntu 26.04 LTS | 7.0 | **Stops** until 8.0.37 is pinned |
| Docker Desktop's VM on the owner's PC | 6.18.54 (m1-058) | Starts. A Docker Desktop update can change this |

The rows for the stopping cases follow from §2. None of them was tested here.

## 4. Options

**A. Stay on the 6.8 kernel line of Ubuntu 24.04 (recommended for now).**
Install or keep the metapackage that stays on 6.8, and remove the one that follows newer kernels:

```sh
uname -r                                  # must start with 6.8.
dpkg -l 'linux-image-*' 'linux-oracle*' 'linux-generic*' | grep ^ii
# OCI only: move from the rolling metapackage to the LTS one
sudo apt install linux-oracle-lts-24.04
sudo apt remove linux-oracle              # removes the metapackage only; running kernel stays
```

These commands come from the package names in §2 and are **not tested**. The first server run must
check them and must not reboot until `dpkg -l` shows a 6.8 kernel as the newest installed.
Upsides: no change to the image or to ADR-0004, and the 6.8 kernel line gets security updates for the
life of 24.04's standard support. Downsides: this rule must be kept by hand. It conflicts with the plain
advice to run the newest HWE kernel, and the 6.8 kernel line gets no new hardware support.

**B. Move to 7.0 with a MongoDB that accepts it.** Pin 8.0.37 or later once it ships. This needs
approval for the new `mongo` digest (handoff §3), a rebuild and the staging proof again. It then
works on HWE, on cloud kernels and on 26.04. **Do not choose it until 8.0.37 is on Docker Hub and
tested.** This option replaces A later and does not compete with it.

**C. The glibc tunable.** No source supports it, see §2. Not recommended, not even as a labelled test.

**D. A distribution with an older long-term kernel,** for example Debian 13 (6.12). This changes the
hardening runbook (Ubuntu 24.04) and was not checked against MongoDB's platform table. It is listed
only for completeness.

## 5. If the owner accepts A

1. Record D-DB-16 as decided: A now, B when 8.0.37 is pinned.
2. Add to the hardening runbook §4: the metapackage rule, the check before a reboot, and the OCI step.
3. Add to the staging runbook §7: Ubuntu reports `7.0.0-<ABI>`, so a fixed Ubuntu 7.0 kernel is still
   refused until 8.0.37.
4. Optional, needs approval: a `uname -r` check in the site's start script that prints a clear message
   before MongoDB stops. This is a code change in `docker/staging/` and needs a rebuild.
5. Optional, needs approval: a read-only check of the owner's OCI server (`uname -r`, `dpkg -l`). This is
   the first real data point on a server.
