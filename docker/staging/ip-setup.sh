#!/bin/bash
# Starts the stack in IP mode (m1-065; runbook docs/runbooks/staging-container.md
# §11): plain HTTP on http://<public-ip>:<port>, no domain, no nginx, no NPM.
# Safe to run again. It never touches NPM or any other container. The images
# come from ghcr.io for the clone's commit (deploy.sh --here, m1-068). Usage,
# as root or a docker user, from anywhere:
#   bash docker/staging/ip-setup.sh <public-ip> [port]     # port defaults to 8090
# Once only, from the one-container stack (runbook §12.3): add
# --switch-from-one-container
# Go-live later keeps the same database and media:
#   bash docker/staging/npm-setup.sh --domain <host name>
set -euo pipefail

cd "$(dirname "$0")/../.."
S=(docker compose -f docker/staging/compose.yaml -f docker/staging/compose.ip.yaml)
ENV_FILE=docker/staging/.env
PLACEHOLDER=assurer.invalid

say() { echo "[ip-setup] $*"; }
die() { echo "[ip-setup] STOP: $*" >&2; exit 1; }

switch=()
args=()
for arg in "$@"; do
  case "$arg" in
    --switch-from-one-container) switch=("$arg") ;;
    *) args+=("$arg") ;;
  esac
done
ip="${args[0]:-}"
port="${args[1]:-8090}"
octet='(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])'
printf '%s\n' "$ip" | grep -Eqx "($octet\.){3}$octet" \
  || die "usage: bash docker/staging/ip-setup.sh <public-ip> [port]  (the server's public IPv4)"
printf '%s\n' "$port" | grep -Eqx '[0-9]{2,5}' && [ "$port" -ge 1024 ] && [ "$port" -le 65535 ] \
  || die "the port must be a number from 1024 to 65535"

# 1. The host (read-only), as in npm-setup.sh.
kernel=$(uname -r)
case "$kernel" in
  6.8.*) say "kernel $kernel: on the 6.8 line (D-DB-16)" ;;
  *) die "kernel $kernel is not on the 6.8 line; MongoDB 8.0.34 may refuse it (D-DB-16)" ;;
esac
say "Compose $(docker compose version --short), $(uname -m)"
if docker ps -a --format '{{.Names}}' | grep -qxE '(assurer-staging|mimnets-cms)-certbot-1'; then
  die "a standalone stack is here (certbot container); see runbook §9 before switching"
fi
# The port must be free, or already this site's own (a run again, or the
# one-container site, which deploy.sh stops with --switch-from-one-container).
users=$(docker ps --filter "publish=$port" --format '{{.Names}}' | grep -vxE 'mimnets-cms-app-1|assurer-staging-site-1' || true)
[ -z "$users" ] || die "port $port is used by container(s): $users. Pick another port: bash docker/staging/ip-setup.sh $ip <port>"
if [ -z "$(docker ps --filter "publish=$port" --format '{{.Names}}')" ] \
  && ss -Htln "sport = :$port" 2>/dev/null | grep -q .; then
  die "port $port is in use by a program on this server (see: ss -tlnp 'sport = :$port'). Pick another port: bash docker/staging/ip-setup.sh $ip <port>"
fi
say "port $port is free"

# 2. The settings file (git-ignored, owner only). Same keys as npm-setup.sh, so
# npm-setup.sh --domain can take over at go-live. Only the IP-mode lines change.
set_key() {
  if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else echo "$1=$2" >> "$ENV_FILE"; fi
}
if [ ! -f "$ENV_FILE" ]; then
  (umask 077; cat > "$ENV_FILE" <<EOF
# Written by ip-setup.sh (m1-065). Settings: runbook staging-container.md §2, §9 and §11.
ASSURER_PROXY_MODE=ip
ASSURER_DOMAIN=$PLACEHOLDER
APOS_BASE_URL=https://$PLACEHOLDER
ASSURER_UPSTREAM_PROXY_IP=172.30.56.2
APOS_CLUSTER_PROCESSES=2
ASSURER_MONGO_CACHE_GB=1
EOF
  )
  say "settings written to $ENV_FILE"
fi
chmod 600 "$ENV_FILE"
set_key ASSURER_PROXY_MODE ip
set_key ASSURER_PUBLIC_IP "$ip"
set_key ASSURER_IP_PORT "$port"

# 3. Pull and start the clone's release (deploy.sh). It stops nginx from an
# NPM-mode start by name, so nothing else is removed.
bash docker/staging/deploy.sh --here "${switch[@]}"

# 4. Wait for the site on the published port.
say "waiting for the site (the first start takes a few minutes)"
code=""
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/" || true)
  [ "$code" = "200" ] && break
  sleep 10
done
[ "$code" = "200" ] || die "no 200 from the site after 10 minutes (last: '${code:-none}'); see: ${S[*]} logs app"
say "the site answers (200) on port $port"

cat <<EOF

Done. The site runs at:  http://$ip:$port/   (admin: http://$ip:$port/login)

1. Open the port to the internet (your change, OCI console):
   Networking > Virtual cloud networks > <the VCN> > Security Lists > Default Security List
   > Add Ingress Rules: Source CIDR 0.0.0.0/0, IP Protocol TCP, Destination Port Range $port.
2. First admin password (user "admin"), from the clone (read once, then change it in the admin UI):
     ${S[*]} exec app cat /app/data/admin-initial-password
   This is plain HTTP: the password crosses the internet unencrypted. Change it again after go-live.
3. Go-live, when the content is ready (same database and media; runbook §11):
   Cloudflare record (DNS only), NPM joins assurer-npm, NPM proxy host, then:
     bash docker/staging/npm-setup.sh --domain <your host name>
   and remove the ingress rule for port $port.
EOF
