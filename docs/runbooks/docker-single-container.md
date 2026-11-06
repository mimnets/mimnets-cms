# Runbook: The whole project in one Docker container

| | |
|---|---|
| **Status** | Built and tested on the owner's PC (`m1-043`, 2026-11-06, agent-executed). See the [m1-043 report](../engineering/reports/2026/11/2026-11-06-m1-043-docker-one-container.report.md) |
| **Purpose** | One image that holds the Apostrophe app and MongoDB 8.0.34, with demo content, for demos and tests |
| **Not for** | Staging or production **as it stands**. The owner chose one container for those sites too (D-DB-10 (b), `m1-044`), but this image is the demo build. D-DB-11 limits the default password and demo content to demo and test use. §5 lists what a staging version still needs |
| **Files** | [`Dockerfile`](../../Dockerfile) · [`compose.yaml`](../../compose.yaml) · [`docker/entrypoint.sh`](../../docker/entrypoint.sh) · [`docker/mongod.conf`](../../docker/mongod.conf) · [`.dockerignore`](../../.dockerignore) |

> **Default login: user `admin`, password `admin` (owner's direction, D-DB-11).**
> Anyone who can reach the site can log in with it. Compose publishes the site on `127.0.0.1` only,
> so only this computer can reach it. Before you run it anywhere else, or change the `ports:` line,
> set `ASSURER_ADMIN_PASSWORD` for the first start, or change the password in the admin UI.

## 1. Start it

```sh
docker compose up -d --build
```

Open <http://localhost:3042/> and log in at <http://localhost:3042/login>. The first start takes
under a minute after the build. It creates:

- the database secrets, in the `secrets` volume (random values, never in the image);
- a one-member replica set with access control and the `assurerApp` database user;
- the demo content (`assurer-demo:seed`) and the `admin` account.

Later starts reuse them and run the migrations. The corporate demo records are not loaded, because
`assurer-demo:seed-corporate` refuses to run with `NODE_ENV=production`.

## 2. Everyday commands

```sh
docker compose logs -f site     # logs
docker compose stop             # stop; all data stays
docker compose start            # start again
docker compose up -d --build    # rebuild after a code change; data stays
```

`docker compose down -v` **deletes the database, media and secrets for good.** Back up first if the
content matters.

## 3. Where the data lives

| Volume | Path in the container | Contents |
|---|---|---|
| `mongo-data` | `/data/db` | MongoDB database |
| `secrets` | `/data/secrets` | Key file, database passwords, session secret. **Treat as secrets** |
| `uploads` | `/app/public/uploads` | Uploaded media |
| `app-data` | `/app/data` | Apostrophe's working files |

This data is separate from the development site. `.env` and the local SQLite database are not used,
and `.dockerignore` keeps them out of the image.

## 4. Architectures

Docker runs Linux containers, so this image runs anywhere Docker can run a Linux container of its
CPU type. The limit comes from the base images: `mongo:8.0.34` is published for Linux on `amd64` and
`arm64` only, so those are the two architectures the project can support.

| Computer | Docker platform | Status |
|---|---|---|
| Intel or AMD server, Windows or Linux PC, Intel Mac | `linux/amd64` | Tested natively (`m1-043`) |
| ARM server (the owner's OCI server, AWS Graviton), Apple silicon Mac | `linux/arm64` | All suites pass under emulation (`m1-043`). Not yet run on real ARM hardware |
| 32-bit ARM, `ppc64le`, `s390x` | — | Not possible: there is no `mongo:8.0.34` image for them |
| Windows containers | — | Not possible: the app stage uses a Linux Node.js image |

Hardware limits from MongoDB 8.0: an `amd64` CPU needs AVX, and an `arm64` CPU needs ARMv8.2-A. Some
older virtual machines and small ARM boards do not meet this, and `mongod` then fails at startup.

`docker compose up --build` builds for the computer it runs on, so no setting is needed. To build
for both and load or share them, build each platform by name:

```sh
docker buildx build --platform linux/arm64 -t assurer-site:local-arm64 --load .
docker buildx build --platform linux/amd64 -t assurer-site:local-amd64 --load .
```

To move an image to a computer without a registry:

```sh
docker save assurer-site:local-arm64 | gzip > assurer-site-arm64.tar.gz
# on the other computer
gunzip -c assurer-site-arm64.tar.gz | docker load
```

The image holds no secrets, but pushing it to a public registry would publish the code. Pushing needs
the owner's approval. Running it on the OCI server also needs approval (D-DB-10).

## 5. Known limits

- **One container means they fail together.** If MongoDB or the app stops, the container stops, and
  `restart: unless-stopped` starts both again. They cannot be scaled, patched or restarted separately.
- **No TLS, no backups, no point-in-time recovery.** The hardening runbook still applies to any real
  site. The database connection stays inside the container on `127.0.0.1`.
- **Plain HTTP.** Secure cookies need `APOS_HTTPS=1` and a TLS proxy
  ([security configuration](./security-configuration.md)).
- **First start always seeds demo content and creates `admin`.** If `ASSURER_ADMIN_PASSWORD` is not
  set, the password is `admin`. A staging version must remove this fallback and the seed, and add
  TLS, x.509 on production (hardening runbook §12 choice 2) and a backup tool.
- **Inside the container the app listens on `0.0.0.0`,** which Docker's port publishing needs. The
  host side stays on `127.0.0.1` through the `ports:` line. Docker's published ports go around a
  server's firewall rules, so never change it to a public address without a proxy in front.
- **Docker Desktop's license:** free only under 250 employees and under $10 million annual revenue.
  The owner confirmed that the company qualifies (`m1-043`). Docker Engine, the usual choice on a
  Linux server, has no such condition. The image works with either.

## 6. Update the pinned versions

The `Dockerfile` pins both base images by digest. Before changing them, check MongoDB's security
alerts and 8.0 release notes. Stay at 8.0.30 or newer (CVE-2026-82067) and at 8.2 or older (D-DB-9).
Get the new digests with `docker buildx imagetools inspect <image>`.
