#!/bin/bash
# Interactive installer for the staging stack on a server (m1-064, D-DB-18;
# design docs/milestones/m1-064-installer-design.md; runbook
# docs/runbooks/staging-container.md §10). Starts the stack (deploy.sh --here,
# images from ghcr.io since m1-068), checks
# it, then guides the owner step by step through the public address, the
# domain, the certificate and the final checks. It changes only this stack: for
# NPM, Portainer, Cloudflare and the OCI console it shows the exact command or
# setting and waits. Safe to run again. As root, from the clone of main:
#   bash docker/staging/install.sh              # all steps
#   bash docker/staging/install.sh --step 6     # start at one step (0 to 9)
#   bash docker/staging/install.sh --check      # the final checks only
# This is still the staging build: step 9 lists what production needs.
set -uo pipefail

cd "$(dirname "$0")/../.."
ENV_FILE=docker/staging/.env
STANDALONE=(docker compose -f docker/staging/compose.yaml)
NPMMODE=(docker compose -f docker/staging/compose.yaml -f docker/staging/compose.npm.yaml)
NET="${ASSURER_NPM_NETWORK:-assurer-npm}"
NPM_IP=172.30.56.2
NPM_NGINX_IP=172.30.56.10
PLACEHOLDER=assurer.invalid
DOMAIN_RE='([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}'
IP_RE='((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])'

start=0
case "${1:-}" in
  "") ;;
  --step) start="${2:-}"; [[ "$start" =~ ^[0-9]$ ]] || { echo "--step needs 0 to 9" >&2; exit 2; } ;;
  --check) start=check ;;
  -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
  *) echo "unknown option $1 (see --help)" >&2; exit 2 ;;
esac

# Everything on screen also goes to a private log outside the clone. The
# admin password is never read, so it never reaches the log.
LOG="$HOME/assurer-install-$(date +%Y%m%d-%H%M%S).log"
(umask 077; : > "$LOG")
exec > >(tee -a "$LOG") 2>&1

TTY=0
if (exec 3< /dev/tty) 2> /dev/null; then TTY=1; fi
if [ "$TTY" -eq 0 ] && [ "$start" != check ]; then
  echo "[install] STOP: no terminal; run it in an SSH session, or use --check" >&2; exit 1
fi

RESULTS=()
MODE=""; DOMAIN=""; PUBLIC_IP=""; S=()

say()  { echo "[install] $*"; }
warn() { echo "[install] WARNING: $*"; }
die()  { echo "[install] STOP: $*"; summary; exit 1; }
hr()   { echo; echo "======== $* ========"; }
show() { echo "  ┌─ $1"; shift; for l in "$@"; do echo "  │ $l"; done; echo "  └─"; }
record() { RESULTS+=("$1|$2|$3"); echo "[install] $2: $1${3:+ — $3}"; }

# choose and ask run in $(...), so to end the run they signal the main shell,
# which exits on USR1. The end of input (Ctrl-D) also ends the run.
trap 'exit 0' USR1
quit_run() {
  echo "[install] $1" >> "$LOG"; echo "[install] $1" > /dev/tty
  summary > /dev/tty; kill -USR1 $$; exit 0
}

# choose "<question>" <letters>: prints the letter chosen. q ends the run.
choose() {
  local a
  if [ "$TTY" -eq 0 ]; then echo s; return; fi
  while :; do
    printf '%s ' "$1" > /dev/tty
    read -r a < /dev/tty || quit_run "input ended"
    a=$(printf '%s' "$a" | tr 'A-Z' 'a-z' | cut -c1)
    if [ -n "$a" ] && [[ "$2" == *"$a"* ]]; then
      echo "> $a" >> "$LOG"
      [ "$a" = q ] && quit_run "stopped by the owner"
      echo "$a"; return
    fi
  done
}

# ask "<question>" "<default>": prints the answer (the default on Enter).
ask() {
  local a
  printf '%s [%s] ' "$1" "$2" > /dev/tty
  read -r a < /dev/tty || quit_run "input ended"
  a="${a:-$2}"
  echo "> $a" >> "$LOG"
  echo "$a"
}

env_get() { [ -f "$ENV_FILE" ] && sed -n "s/^$1=//p" "$ENV_FILE" | tail -1; }
set_key() {
  if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else echo "$1=$2" >> "$ENV_FILE"; fi
}

load_env() {
  MODE=$(env_get ASSURER_PROXY_MODE)
  # Settings written by hand (runbook §3) or by npm-setup.sh name no route.
  if [ -z "$MODE" ] && [ -f "$ENV_FILE" ]; then
    if [ -n "$(env_get ASSURER_UPSTREAM_PROXY_IP)" ]; then MODE=npm; else MODE=standalone; fi
  fi
  DOMAIN=$(env_get ASSURER_DOMAIN)
  if [ "$MODE" = npm ]; then S=("${NPMMODE[@]}"); else S=("${STANDALONE[@]}"); fi
}

# The NPM container on this host, if any (ASSURER_NPM_CONTAINER overrides, for tests).
npm_container() {
  if [ -n "${ASSURER_NPM_CONTAINER:-}" ]; then echo "$ASSURER_NPM_CONTAINER"; return; fi
  docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /nginx-proxy-manager/ {print $1; exit}'
}

# Where the public front door answers on this server, as host:port.
# Standalone: the stack's nginx. NPM mode: NPM on 80 and 443.
front() {
  if [ "$MODE" = npm ]; then
    if [ "$1" = 80 ]; then echo "${ASSURER_FRONT_HTTP:-127.0.0.1:80}"; else echo "${ASSURER_FRONT_HTTPS:-127.0.0.1:443}"; fi
  else
    "${S[@]}" port nginx "$1" 2> /dev/null | head -1 | sed 's/^0\.0\.0\.0:/127.0.0.1:/; s/^\[::\]:/127.0.0.1:/'
  fi
}

# curl to the domain through the front door on this server; -k because the
# certificate is checked separately (cert_info).
dcurl() { local port=$1; shift; curl -sk --max-time 20 --connect-to "$DOMAIN:$port:$(front "$port")" "$@"; }
http_code() { dcurl "$1" -o /dev/null -w '%{http_code}' "$2"; }
cert_info() {
  echo | openssl s_client -connect "$(front 443)" -servername "$DOMAIN" 2> /dev/null \
    | openssl x509 -noout -issuer -enddate 2> /dev/null
}

# Retry a check until it passes, or the owner skips or quits.
# check_loop "<step>" <function>; the function sets MSG.
MSG=""
check_loop() {
  while :; do
    MSG=""
    if "$2"; then record "$1" PASS "$MSG"; return 0; fi
    echo "[install] FAIL: $MSG"
    case $(choose "[t]ry the check again, [s]kip or [q]uit?" tsq) in
      t) continue ;;
      *) record "$1" FAIL "$MSG"; return 1 ;;
    esac
  done
}

ask_public_ip() {
  [ -n "$PUBLIC_IP" ] && return
  local ip
  while :; do
    ip=$(ask "The server's public IPv4 (OCI Console: Compute → Instances → the instance → Public IP address)" "")
    printf '%s\n' "$ip" | grep -Eqx "$IP_RE" && { PUBLIC_IP=$ip; return; }
    echo "  That is not an IPv4 address."
  done
}

summary() {
  hr "Summary"
  local r
  for r in "${RESULTS[@]+"${RESULTS[@]}"}"; do
    IFS='|' read -r s v d <<< "$r"
    printf '  %-8s %-40s %s\n' "$v" "$s" "$d"
  done
  cat <<EOF

Still open before real visitors use this as production (runbook §9.2;
each is its own approved task; this script does none of them):
  - x.509 member authentication (hardening runbook §12 choice 2)
  - backups off the server: PBM S3 (D-DB-12)
  - APOS_ALLOW_INDEXING=1 (search engines; never on staging)
  - HSTS raised: APOS_HSTS_MAX_AGE in $ENV_FILE, then "up -d" (runbook §2)
  - SMTP in docker/staging/site.env
  - a restore drill on a copy (PBM runbook)
  - the per-visitor checks (m1-061 paper §6) passed

Log of this run: $LOG
EOF
}

# ---------------------------------------------------------------- the steps

step0() {
  hr "Step 0: host checks (read-only)"
  local kernel compose major rest minor avail mem branch
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
  say "Docker $(docker version --format '{{.Server.Version}}'), Compose $compose, $(uname -m)"
  avail=$(df -BG --output=avail / | tail -1 | tr -dc 0-9)
  mem=$(awk '/^MemTotal/ {printf "%d", $2/1048576}' /proc/meminfo)
  say "free disk on /: ${avail} GB; memory: ${mem} GB"
  [ "${avail:-0}" -ge 15 ] || warn "less than 15 GB free; the images and MongoDB need room"
  branch=$(git rev-parse --abbrev-ref HEAD)
  [ "$branch" = main ] || warn "the clone is on '$branch', not main"
  [ -z "$(git status --porcelain)" ] || warn "the clone has local changes (git status)"
  if git fetch -q origin main 2> /dev/null; then
    [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] \
      || warn "the clone is not level with origin/main; run: git pull"
  else
    warn "could not reach origin to compare with main"
  fi
  echo "  Ports 80, 81, 443 on this host:"
  if [ "$(id -u)" -eq 0 ]; then ss -tlnpH '( sport = :80 or sport = :81 or sport = :443 )' | sed 's/^/    /'
  else ss -tlnH '( sport = :80 or sport = :81 or sport = :443 )' | sed 's/^/    /'; warn "not root: process names hidden"; fi
  local npm; npm=$(npm_container)
  [ -n "$npm" ] && say "Nginx Proxy Manager runs here: container $npm"
  docker ps -a --format '{{.Names}}\t{{.Status}}' | grep '^assurer' | sed 's/^/    /' || true
  record "0 host checks" PASS "kernel $kernel, Compose $compose"
}

step1() {
  hr "Step 1: choose the route"
  load_env
  if [ -n "$MODE" ]; then
    say "the route is already set in $ENV_FILE: $MODE. Switching a stack with content is not tested (runbook §9)."
    record "1 route" PASS "$MODE (existing)"; return
  fi
  local busy npm rec c
  busy=$(ss -tlnH '( sport = :80 or sport = :443 )' | wc -l)
  npm=$(npm_container)
  cat <<EOF
  A. standalone: the stack's own nginx owns ports 80 and 443; certbot issues the
     certificate (D-DB-17 A, for a server of its own).
  B. behind Nginx Proxy Manager: the stack publishes no port; NPM forwards to it
     and issues the certificate (D-DB-17 B, for a shared host).
EOF
  if [ -n "$npm" ]; then rec=b; say "recommended: B (NPM runs here as $npm)"
  elif [ "$busy" -gt 0 ]; then
    die "something other than NPM owns port 80 or 443; neither route fits. See the ports above"
  else rec=a; say "recommended: A (ports 80 and 443 are free, no NPM found)"; fi
  c=$(choose "Route [a] or [b], or [q]uit?" abq)
  if [ "$c" = a ] && [ "$busy" -gt 0 ]; then die "route A needs ports 80 and 443, and they are in use"; fi
  if [ "$c" = b ] && [ -z "$npm" ]; then warn "no NPM container found; route B needs NPM in front later"; fi
  [ "$c" = a ] && MODE=standalone || MODE=npm
  [ "$c" = "$rec" ] || warn "not the recommended route"
  record "1 route" PASS "$MODE"
}

step2() {
  hr "Step 2: settings ($ENV_FILE)"
  if [ -f "$ENV_FILE" ]; then
    local m; m=$(env_get ASSURER_PROXY_MODE)
    [ -n "$m" ] || set_key ASSURER_PROXY_MODE "$MODE"
    chmod 600 "$ENV_FILE"
    load_env
    say "settings exist; kept as they are (the domain can change in step 6):"
    grep -E '^(ASSURER_PROXY_MODE|ASSURER_DOMAIN|APOS_CLUSTER_PROCESSES|ASSURER_MONGO_CACHE_GB)=' "$ENV_FILE" | sed 's/^/    /'
    record "2 settings" PASS "kept"; return
  fi
  [ -n "$MODE" ] || die "no route chosen; run step 1 first"
  local d w c
  while :; do
    d=$(ask "Host name for the site, lower case (Enter: set it later in step 6)" "$PLACEHOLDER")
    printf '%s\n' "$d" | grep -Eqx "$DOMAIN_RE" && break
    echo "  Use a host name in lower case, such as www.example.org"
  done
  echo "  Memory: $(awk '/^MemTotal/ {printf "%d", $2/1048576}' /proc/meminfo) GB. Each web process needs about 0.3 GB; the MongoDB cache is extra (runbook §2)."
  while :; do w=$(ask "Web processes (1 to 8)" 2); [[ "$w" =~ ^[1-8]$ ]] && break; done
  while :; do c=$(ask "MongoDB cache in GB (1 to 64)" 1); [[ "$c" =~ ^[1-9][0-9]?$ ]] && [ "$c" -le 64 ] && break; done
  (umask 077; {
    echo "# Written by install.sh (m1-064). Settings: runbook staging-container.md §2, §9 and §10."
    echo "ASSURER_PROXY_MODE=$MODE"
    echo "ASSURER_DOMAIN=$d"
    echo "APOS_BASE_URL=https://$d"
    [ "$MODE" = npm ] && echo "ASSURER_UPSTREAM_PROXY_IP=$NPM_IP"
    echo "APOS_CLUSTER_PROCESSES=$w"
    echo "ASSURER_MONGO_CACHE_GB=$c"
  } > "$ENV_FILE")
  chmod 600 "$ENV_FILE"
  load_env
  record "2 settings" PASS "written, mode 0600"
}

wait_ok() {
  local code="" i
  say "waiting for the site (the first start takes a few minutes)"
  for i in $(seq 1 60); do
    if [ "$MODE" = npm ]; then
      code=$("${S[@]}" exec -T nginx wget -S -q -O /dev/null --header "Host: $DOMAIN" \
        http://127.0.0.1:8080/ 2>&1 | awk '/HTTP\//{c=$2} END{print c}') || true
    else
      code=$(http_code 443 "https://$DOMAIN/") || true
    fi
    [ "$code" = 200 ] && return 0
    sleep 10
  done
  MSG="no 200 after 10 minutes (last: '${code:-none}'); see: ${S[*]} logs app"
  return 1
}

step3() {
  hr "Step 3: pull and start"
  load_env
  [ -n "$MODE" ] || die "no settings; run steps 1 and 2 first"
  if [ "$MODE" = npm ]; then
    show "The script runs:" "bash docker/staging/npm-setup.sh"
    [ "$(choose "[r]un, [s]kip or [q]uit?" rsq)" = r ] || { record "3 build and start" SKIPPED ""; return; }
    if bash docker/staging/npm-setup.sh; then record "3 build and start" PASS "npm-setup.sh, no host port"
    else record "3 build and start" FAIL "npm-setup.sh stopped; see above"; fi
    return
  fi
  show "The script runs (pulls this commit's images and starts them):" "bash docker/staging/deploy.sh --here"
  [ "$(choose "[r]un, [s]kip or [q]uit?" rsq)" = r ] || { record "3 build and start" SKIPPED ""; return; }
  bash docker/staging/deploy.sh --here || { record "3 build and start" FAIL "deploy.sh stopped; see above"; return; }
  MSG=""
  if wait_ok; then record "3 build and start" PASS "ports $(front 80), $(front 443)"
  else record "3 build and start" FAIL "$MSG"; fi
}

check_local() {
  local c h
  if [ "$MODE" = npm ]; then
    wait_ok && MSG="200 on nginx's port 8080 for $DOMAIN"; return
  fi
  c=$(http_code 443 "https://$DOMAIN/"); h=$(dcurl 80 -o /dev/null -w '%{http_code} %{redirect_url}' "http://$DOMAIN/")
  MSG="https $c; http $h"
  [ "$c" = 200 ] && [ "$h" = "301 https://$DOMAIN/" ]
}

step4() {
  hr "Step 4: check on the server"
  load_env
  check_loop "4 check on the server" check_local
  show "First admin login (runbook §3). Read the password once, log in as 'admin' at" \
    "https://$DOMAIN/login, change it in the admin UI, then delete the file:" \
    "${S[*]} exec app cat /app/data/admin-initial-password" \
    "${S[*]} exec app rm /app/data/admin-initial-password" \
    "Never paste the password into a chat, ticket or document."
}

step5() {
  hr "Step 5: check on the public address"
  load_env
  if [ "$MODE" = npm ]; then say "route B publishes nothing; this step does not apply"; record "5 public address" SKIPPED "route B"; return; fi
  [ "$(choose "Check the public address now? [y]es, [s]kip or [q]uit" ysq)" = y ] || { record "5 public address" SKIPPED ""; return; }
  ask_public_ip
  while :; do
    show "From your PC (PowerShell). Expect 200 (the certificate may still be self-signed), then 301:" \
      "curl.exe -skI --resolve $DOMAIN:443:$PUBLIC_IP https://$DOMAIN/" \
      "curl.exe -sI --resolve $DOMAIN:80:$PUBLIC_IP http://$DOMAIN/"
    case $(choose "Did you see [y] 200 and 301, or [n] not? ([s]kip, [q]uit)" ynsq) in
      y) record "5 public address" PASS "owner-reported from the PC"; return ;;
      s) record "5 public address" SKIPPED ""; return ;;
    esac
    show "Ports 80 and 443 are probably closed in OCI's security list. In the OCI Console:" \
      "Networking → Virtual cloud networks → the VCN → Security → the security list (or the" \
      "network security group of the instance) → Add Ingress Rules: source 0.0.0.0/0," \
      "TCP, destination port 80; and again for 443." \
      "Docker's published ports do not pass the host's INPUT rules. Docker's own filter chain:"
    iptables -S DOCKER-USER 2> /dev/null | sed 's/^/    /' || echo "    (iptables not readable; run as root)"
  done
}

check_dns() {
  local got
  got=$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u | tr '\n' ' ' | sed 's/ $//')
  MSG="$DOMAIN → '${got:-no answer}', expected $PUBLIC_IP"
  [ "$got" = "$PUBLIC_IP" ] && return 0
  case "$got" in 104.1[6-9].*|104.2[0-3].*|172.6[4-9].*|172.7[01].*)
    MSG="$MSG. That is a Cloudflare address: set the record to DNS only (grey cloud)" ;; esac
  return 1
}

step6() {
  hr "Step 6: domain and Cloudflare"
  load_env
  local d="$DOMAIN"
  if [ "$d" = "$PLACEHOLDER" ] || [ "$(choose "The domain is $d. [k]eep or [c]hange? ([q]uit)" kcq)" = c ]; then
    while :; do
      d=$(ask "Host name for the site, lower case (s to skip this step)" "")
      [ "$d" = s ] && { record "6 domain and DNS" SKIPPED ""; return; }
      printf '%s\n' "$d" | grep -Eqx "$DOMAIN_RE" && [ "$d" != "$PLACEHOLDER" ] && break
      echo "  Use a host name in lower case, such as www.example.org"
    done
  fi
  if [ "$d" != "$DOMAIN" ]; then
    if [ "$MODE" = npm ]; then show "The script runs (recreates app and nginx):" "bash docker/staging/npm-setup.sh --domain $d"
    else show "The script sets ASSURER_DOMAIN and APOS_BASE_URL in $ENV_FILE, then runs (recreates app and nginx):" "${S[*]} up -d"; fi
    [ "$(choose "[r]un, [s]kip or [q]uit?" rsq)" = r ] || { record "6 domain and DNS" SKIPPED "domain not changed"; return; }
    if [ "$MODE" = npm ]; then
      bash docker/staging/npm-setup.sh --domain "$d" || { record "6 domain and DNS" FAIL "npm-setup.sh --domain stopped"; return; }
    else
      set_key ASSURER_DOMAIN "$d"; set_key APOS_BASE_URL "https://$d"
      "${S[@]}" up -d || { record "6 domain and DNS" FAIL "up failed"; return; }
    fi
    load_env
    [ "$MODE" = npm ] || { wait_ok || warn "$MSG"; }
  fi
  ask_public_ip
  show "In Cloudflare (runbook §9.1 A): dash.cloudflare.com → the domain → DNS → Records." \
    "Check that no record has this name yet. Then + Add record:" \
    "  Type A · Name: the part of $DOMAIN before the zone · IPv4 address $PUBLIC_IP" \
    "  Proxy status: DNS only (grey cloud) · TTL Auto. Save." \
    "No AAAA record unless the server has a public IPv6 address." \
    "Never use a name that the WordPress site, email or another service uses."
  [ "$(choose "[d]one, [s]kip or [q]uit?" dsq)" = d ] || { record "6 domain and DNS" SKIPPED "no record"; return; }
  check_loop "6 domain and DNS" check_dns
}

cert_is() {
  local i; i=$(cert_info)
  MSG=$(echo "$i" | tr '\n' ' ')
  case "$1" in
    staging) echo "$i" | grep -q 'STAGING' ;;
    real) echo "$i" | grep -q "Let's Encrypt" && ! echo "$i" | grep -q 'STAGING' ;;
  esac
}
cert_staging() { cert_is staging; }
cert_real() { cert_is real; }

step7a() {
  hr "Step 7: certificate (standalone, certbot)"
  load_env
  [ "$DOMAIN" != "$PLACEHOLDER" ] || { say "no domain yet; run step 6 first"; record "7 certificate" SKIPPED "no domain"; return; }
  cert_real && { say "a real certificate is already in place: $MSG"; record "7 certificate" PASS "$MSG"; return; }
  local email base
  while :; do email=$(ask "E-mail address for Let's Encrypt notices" ""); [[ "$email" == ?*@?*.?* ]] && break; done
  base="${S[*]} run --rm --entrypoint certbot certbot certonly --non-interactive --webroot -w /var/www/acme -d $DOMAIN --email $email --agree-tos --no-eff-email --deploy-hook assurer-deploy-hook"
  show "First a test certificate from Let's Encrypt's staging service (higher rate limits):" \
    "$base --test-cert" "${S[*]} exec nginx nginx -s reload"
  if [ "$(choose "[r]un, [s]kip to the real certificate, or [q]uit?" rsq)" = r ]; then
    "${S[@]}" run --rm -T --entrypoint certbot certbot certonly --non-interactive --webroot -w /var/www/acme \
      -d "$DOMAIN" --email "$email" --agree-tos --no-eff-email --deploy-hook assurer-deploy-hook --test-cert \
      && "${S[@]}" exec -T nginx nginx -s reload
    check_loop "7 test certificate" cert_staging || return
  fi
  show "Then the real certificate (it replaces the test one):" \
    "$base --force-renewal" "${S[*]} exec nginx nginx -s reload"
  [ "$(choose "[r]un, [s]kip or [q]uit?" rsq)" = r ] || { record "7 certificate" SKIPPED "no real certificate"; return; }
  "${S[@]}" run --rm -T --entrypoint certbot certbot certonly --non-interactive --webroot -w /var/www/acme \
    -d "$DOMAIN" --email "$email" --agree-tos --no-eff-email --deploy-hook assurer-deploy-hook --force-renewal \
    && "${S[@]}" exec -T nginx nginx -s reload
  check_loop "7 certificate" cert_real
}

check_npm_joined() {
  local npm ip envv p81 others
  npm=$(npm_container)
  [ -n "$npm" ] || { MSG="no NPM container found"; return 1; }
  ip=$(docker inspect -f "{{with index .NetworkSettings.Networks \"$NET\"}}{{.IPAddress}}{{end}}" "$npm")
  envv=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$npm" | sed -n 's/^IP_RANGES_FETCH_ENABLED=//p')
  p81=$(docker port "$npm" 81 2> /dev/null | grep -v '^127\.0\.0\.1:' | tr '\n' ' ')
  others=$(docker network inspect "$NET" -f '{{range .Containers}}{{.IPv4Address}} {{end}}' \
    | tr ' ' '\n' | sed 's|/.*||' | grep -v -e "^$NPM_IP$" -e "^$NPM_NGINX_IP$" -e '^$' | tr '\n' ' ')
  MSG="$npm on $NET: '${ip:-none}'; IP_RANGES_FETCH_ENABLED='${envv:-unset}'; port 81 off loopback: '${p81:-none}'; others on $NET: '${others:-none}'"
  [ "$ip" = "$NPM_IP" ] && [ "$envv" = false ] && [ -z "$p81" ] && [ -z "$others" ]
}

check_npm_host() {
  local c h
  c=$(http_code 443 "https://$DOMAIN/"); h=$(dcurl 80 -o /dev/null -w '%{http_code} %{redirect_url}' "http://$DOMAIN/")
  cert_info > /dev/null
  MSG="https $c; http $h; $(cert_info | tr '\n' ' ')"
  [ "$c" = 200 ] && [[ "$h" == 30[18]\ https://$DOMAIN/* ]] && cert_info | grep -q "Let's Encrypt"
}

BACKUP=""
check_backup() {
  MSG="$BACKUP, mode '$(stat -c %a "$BACKUP" 2> /dev/null || echo missing)'"
  [ "$(stat -c %a "$BACKUP" 2> /dev/null)" = 600 ]
}

step7b() {
  hr "Step 7: NPM changes and proxy host (the owner's changes; the script only checks)"
  load_env
  [ "$DOMAIN" != "$PLACEHOLDER" ] || { say "no domain yet; run step 6 first"; record "7 NPM" SKIPPED "no domain"; return; }
  local npm svc nets day
  npm=$(npm_container)
  [ -n "$npm" ] || { say "no NPM container found on this host"; record "7 NPM" SKIPPED "no NPM"; return; }
  if check_npm_joined; then say "NPM is already joined: $MSG"; record "7b(b) NPM joined" PASS "$MSG"
  else
    svc=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$npm")
    nets=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$npm")
    day=$(date +%F)
    echo "  NPM's mounts now (the backup follows them):"
    docker inspect -f '{{range .Mounts}}    {{.Source}} -> {{.Destination}}{{println}}{{end}}' "$npm"
    show "(a) Back up NPM first (as root). Also copy the stack text in Portainer (Stacks → the" \
      "stack → Editor) into a file kept off the server. The archive holds private keys." \
      "mkdir -m 700 /root/npm-backup-$day" \
      "docker cp $npm:/data /root/npm-backup-$day/data" \
      "docker cp $npm:/etc/letsencrypt /root/npm-backup-$day/letsencrypt" \
      "tar -C /root -czf /root/npm-backup-$day.tar.gz npm-backup-$day && chmod 600 /root/npm-backup-$day.tar.gz"
    [ "$(choose "[d]one, [s]kip or [q]uit?" dsq)" = d ] || { record "7b(a) NPM backup" SKIPPED ""; return; }
    BACKUP="/root/npm-backup-$day.tar.gz"
    check_loop "7b(a) NPM backup" check_backup || return
    show "(b) In Portainer: Stacks → the NPM stack → Editor. In service '${svc:-<NPM service>}', change" \
      "ports, environment and networks as below, keep everything else, and keep every network" \
      "it is on now: ${nets:-?}(a 'networks:' list replaces the implicit 'default')." \
      "    ports:" \
      "      - '80:80'" \
      "      - '127.0.0.1:81:81'" \
      "      - '443:443'" \
      "    environment:" \
      "      IP_RANGES_FETCH_ENABLED: 'false'" \
      "    networks:" \
      "      <each network listed above>: {}" \
      "      $NET:" \
      "        ipv4_address: $NPM_IP" \
      "and at the end of the file:" \
      "networks:" \
      "  <each network listed above>: (as it is now)" \
      "  $NET:" \
      "    external: true" \
      "Then Update the stack. This recreates NPM: every site behind it is down for a moment." \
      "Port 81 is then reachable only through an SSH tunnel: ssh -L 8181:127.0.0.1:81 <user>@<server>"
    [ "$(choose "[d]one, [s]kip or [q]uit?" dsq)" = d ] || { record "7b(b) NPM joined" SKIPPED ""; return; }
    check_loop "7b(b) NPM joined" check_npm_joined || return
  fi
  show "(c) NPM admin UI (through the tunnel: http://127.0.0.1:8181) → Hosts → Proxy Hosts → Add:" \
    "Details: Domain Names $DOMAIN · Scheme http · Forward Hostname/IP $NPM_NGINX_IP · Port 8080" \
    "         Cache Assets off · Block Common Exploits off · Websockets Support off" \
    "SSL:     Request a new certificate (Let's Encrypt) · Force SSL on · HTTP/2 on · HSTS off" \
    "         (the site sends HSTS itself; twice is wrong). Save." \
    "This is the real certificate: NPM has no staging option per host (its LE_STAGING" \
    "setting is for the whole container, so every site behind NPM). Check the DNS record" \
    "first (step 6); Let's Encrypt allows only 5 failed validations per host name per hour."
  [ "$(choose "[d]one, [s]kip or [q]uit?" dsq)" = d ] || { record "7b(c) NPM proxy host" SKIPPED ""; return; }
  check_loop "7b(c) NPM proxy host" check_npm_host
}

step8() {
  hr "Step 8: final checks (runbook §5, m1-061 paper §6)"
  load_env
  [ -n "$MODE" ] || die "no settings found in $ENV_FILE"
  local h c hdrs hsts srv ck m1 m2 a1 a2
  h=$(dcurl 80 -o /dev/null -w '%{http_code} %{redirect_url}' "http://$DOMAIN/")
  [[ "$h" == 30[18]\ https://$DOMAIN/* ]] && record "8 http → https" PASS "$h" || record "8 http → https" FAIL "$h"
  hdrs=$(dcurl 443 -D - -o /dev/null "https://$DOMAIN/" | tr -d '\r')
  c=$(echo "$hdrs" | awk 'NR==1 {print $2}')
  [ "$c" = 200 ] && record "8 https" PASS "200" || record "8 https" FAIL "${c:-no answer}"
  m1=$(cert_info | tr '\n' ' ')
  echo "$m1" | grep -q "Let's Encrypt" && ! echo "$m1" | grep -q STAGING \
    && record "8 certificate" PASS "$m1" || record "8 certificate" FAIL "${m1:-none}"
  hsts=$(echo "$hdrs" | grep -ci '^strict-transport-security:')
  [ "$hsts" = 1 ] && record "8 HSTS once" PASS "" || record "8 HSTS once" FAIL "$hsts headers"
  srv=$(echo "$hdrs" | grep -i '^server:' | tr '\n' ' ')
  echo "$srv" | grep -q '/[0-9]' && record "8 no server version" FAIL "$srv" || record "8 no server version" PASS "${srv:-no Server header}"
  ck=$(dcurl 443 -D - -o /dev/null "https://$DOMAIN/login" | tr -d '\r' | grep -i '^set-cookie:')
  if [ -z "$ck" ]; then record "8 Secure cookie" "NOT SEEN" "no cookie on /login"
  elif echo "$ck" | grep -viq '; *secure'; then record "8 Secure cookie" FAIL "a cookie without Secure"
  else record "8 Secure cookie" PASS ""; fi
  c=$(head -c 35651584 /dev/zero | dcurl 443 -o /dev/null -w '%{http_code}' -X POST \
    -H 'Expect:' -H 'Content-Type: application/octet-stream' --data-binary @- "https://$DOMAIN/")
  [ "$c" = 413 ] && record "8 34 MB refused" PASS "413" || record "8 34 MB refused" FAIL "$c"
  if "${S[@]}" exec -T pbm pbmc status > /tmp/assurer-pbm.$$ 2>&1; then
    grep -iE 'pitr|agent' /tmp/assurer-pbm.$$ | head -5 | sed 's/^/    /'; record "8 PBM status" PASS ""
  else record "8 PBM status" FAIL "pbmc status failed"; fi
  rm -f /tmp/assurer-pbm.$$

  if [ "$TTY" -eq 0 ]; then
    record "8 visitor address (PC)" "NOT TESTED" "no terminal"; return
  fi
  m1="check-$(openssl rand -hex 4)"; m2="check-$(openssl rand -hex 4)"
  show "From your PC (PowerShell), one after the other:" \
    "curl.exe -s -o NUL -w \"%{http_code}\`n\" \"https://$DOMAIN/?$m1\"" \
    "curl.exe -s -o NUL -w \"%{http_code}\`n\" -H \"X-Real-IP: 203.0.113.9\" -H \"X-Forwarded-For: 203.0.113.9\" \"https://$DOMAIN/?$m2\""
  if [ "$(choose "[d]one, [s]kip or [q]uit?" dsq)" = d ]; then
    sleep 2
    a1=$("${S[@]}" logs --no-log-prefix --since 30m nginx 2>&1 | grep -m1 "$m1" | awk '{print $1}')
    a2=$("${S[@]}" logs --no-log-prefix --since 30m nginx 2>&1 | grep -m1 "$m2" | awk '{print $1}')
    echo "  nginx logged: first request from '${a1:-not found}', forged request from '${a2:-not found}'"
    if [ -z "$a1" ]; then record "8 visitor address" FAIL "request not found in nginx's log"
    elif [[ "$a1" == 172.* || "$a1" == 127.* || "$a1" == 10.* ]]; then
      record "8 visitor address" FAIL "$a1 is a private address: Docker's proxy is in the path (runbook §9)"
    elif [ "$(choose "Is $a1 your PC's public address? [y]es or [n]o" yn)" = y ]; then
      record "8 visitor address" PASS "$a1"
    else record "8 visitor address" FAIL "$a1 is not the owner's address"; fi
    if [ -n "$a2" ] && [ "$a2" = "$a1" ]; then record "8 forged X-Real-IP ignored" PASS ""
    else record "8 forged X-Real-IP ignored" FAIL "logged '${a2:-not found}'"; fi
  else
    record "8 visitor address" SKIPPED ""
  fi
  if [ "$MODE" = npm ]; then
    ask_public_ip
    show "From your PC (PowerShell); expect TcpTestSucceeded : False:" "Test-NetConnection $PUBLIC_IP -Port 81"
    case $(choose "Was it [f]alse, [t]rue, or [s]kip?" fts) in
      f) record "8 port 81 closed" PASS "owner-reported" ;;
      t) record "8 port 81 closed" FAIL "NPM's admin port is open to the internet" ;;
      *) record "8 port 81 closed" SKIPPED "" ;;
    esac
  fi
  record "8 per-visitor 429" MANUAL "needs two outside addresses (paper §6 check 5)"
}

# ---------------------------------------------------------------- run

say "log: $LOG"
load_env
if [ "$start" = check ]; then
  step8; summary; exit 0
fi
[ "$start" -le 0 ] && step0
[ "$start" -le 1 ] && step1
[ "$start" -le 2 ] && step2
load_env
[ -n "$MODE" ] || die "no route set; start at step 1"
[ "$start" -le 3 ] && step3
[ "$start" -le 4 ] && step4
[ "$start" -le 5 ] && step5
[ "$start" -le 6 ] && step6
if [ "$start" -le 7 ]; then if [ "$MODE" = npm ]; then step7b; else step7a; fi; fi
[ "$start" -le 8 ] && step8
summary
