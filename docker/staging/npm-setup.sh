#!/bin/bash
# Sets up and starts the staging stack in NPM mode on a shared host (m1-063,
# D-DB-17 option B; runbook docs/runbooks/staging-container.md §9.2). Safe to
# run again. It never touches NPM, its stack or any other container: the site
# stays private until the owner joins NPM to the network and adds the proxy
# host (§9.2, "Later"). Usage, as root or a docker user, from anywhere:
#   bash docker/staging/npm-setup.sh                      # first start, placeholder domain
#   bash docker/staging/npm-setup.sh --domain www.example.org   # set or change the domain
set -euo pipefail

cd "$(dirname "$0")/../.."
S=(docker compose -f docker/staging/compose.yaml -f docker/staging/compose.npm.yaml)
ENV_FILE=docker/staging/.env
NET="${ASSURER_NPM_NETWORK:-assurer-npm}"
SUBNET=172.30.56.0/24
NPM_IP=172.30.56.2
PLACEHOLDER=assurer.invalid

say() { echo "[npm-setup] $*"; }
die() { echo "[npm-setup] STOP: $*" >&2; exit 1; }

domain=""
case "${1:-}" in
  "") ;;
  --domain)
    domain="${2:-}"
    printf '%s\n' "$domain" | grep -Eqx '([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}' \
      || die "--domain needs a host name in lower case, such as www.example.org"
    ;;
  *) die "unknown option $1 (see the top of this file)" ;;
esac

# 1. The host (read-only).
kernel=$(uname -r)
case "$kernel" in
  6.8.*) say "kernel $kernel: on the 6.8 line (D-DB-16)" ;;
  *) die "kernel $kernel is not on the 6.8 line; MongoDB 8.0.34 may refuse it (D-DB-16)" ;;
esac
compose=$(docker compose version --short | sed 's/^v//')
major=${compose%%.*}; rest=${compose#*.}; minor=${rest%%.*}
if [ "$major" -lt 2 ] || { [ "$major" -eq 2 ] && [ "$minor" -lt 24 ]; }; then
  die "Compose $compose is older than 2.24 and cannot apply 'ports: !reset'"
fi
say "Compose $compose, $(uname -m)"
if docker ps -a --format '{{.Names}}' | grep -qx 'assurer-staging-certbot-1'; then
  die "a standalone stack is here (certbot container); see runbook §9 before switching"
fi

# 2. The private network NPM and nginx share. Internal: no route out.
if docker network inspect "$NET" > /dev/null 2>&1; then
  info=$(docker network inspect "$NET" --format '{{.Internal}} {{range .IPAM.Config}}{{.Subnet}}{{end}}')
  [ "$info" = "true $SUBNET" ] || die "network $NET exists but is '$info', expected 'true $SUBNET'"
  say "network $NET exists"
else
  docker network create --internal --subnet "$SUBNET" "$NET" > /dev/null
  say "network $NET created ($SUBNET, internal)"
fi

# 3. The settings file (git-ignored, owner only). Never overwritten; only the
# domain lines change, and only with --domain.
set_key() {
  if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else echo "$1=$2" >> "$ENV_FILE"; fi
}
if [ ! -f "$ENV_FILE" ]; then
  (umask 077; cat > "$ENV_FILE" <<EOF
# Written by npm-setup.sh (m1-063). Settings: runbook staging-container.md §2 and §9.
ASSURER_DOMAIN=$PLACEHOLDER
APOS_BASE_URL=https://$PLACEHOLDER
ASSURER_UPSTREAM_PROXY_IP=$NPM_IP
APOS_CLUSTER_PROCESSES=2
ASSURER_MONGO_CACHE_GB=1
EOF
  )
  say "settings written to $ENV_FILE"
fi
chmod 600 "$ENV_FILE"
if [ -n "$domain" ]; then
  set_key ASSURER_DOMAIN "$domain"
  set_key APOS_BASE_URL "https://$domain"
  say "domain set to $domain"
fi
current=$(sed -n 's/^ASSURER_DOMAIN=//p' "$ENV_FILE")
[ -n "$current" ] || die "ASSURER_DOMAIN is empty in $ENV_FILE"
[ "$("${S[@]}" config | grep -c 'published:')" -eq 0 ] \
  || die "the stack would publish host ports; check compose.npm.yaml"

# 4. Build and start. The first build takes a while.
say "building the images"
"${S[@]}" build
say "starting the stack"
"${S[@]}" up -d

# 5. Wait for the site to answer through nginx's internal port.
say "waiting for the site (the first start takes a few minutes)"
code=""
for _ in $(seq 1 60); do
  code=$("${S[@]}" exec -T nginx wget -S -q -O /dev/null --header "Host: $current" \
    http://127.0.0.1:8080/ 2>&1 | awk '/HTTP\//{c=$2} END{print c}') || true
  [ "$code" = "200" ] && break
  sleep 10
done
[ "$code" = "200" ] || die "no 200 from the site after 10 minutes (last: '${code:-none}'); see: ${S[*]} logs site"
"${S[@]}" logs nginx 2>&1 | grep -m1 'NPM mode' || true
say "the site answers (200) for $current on nginx's internal port 8080"

cat <<EOF

Done. The site runs, but nobody outside this server can reach it yet.
- First admin password, from this folder (read once, change it in the admin UI, delete the file):
    ${S[*]} exec site cat /data/secrets/admin-initial-password
- Later (runbook staging-container.md §9.2): Cloudflare record, NPM joins $NET at
  $NPM_IP, NPM proxy host to 172.30.56.10:8080, then:
    bash docker/staging/npm-setup.sh --domain <your host name>
EOF
[ "$current" = "$PLACEHOLDER" ] && echo "- The domain is still the placeholder $PLACEHOLDER."
exit 0
