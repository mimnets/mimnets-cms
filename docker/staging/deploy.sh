#!/bin/bash
# Starts a release of the stack on a server (m1-068, D-DB-21; runbook
# docs/runbooks/staging-container.md §12). The images come from ghcr.io, built
# and checked by CI for each commit on main; the server never builds. Safe to
# run again. As root, in the clone:
#   bash docker/staging/deploy.sh                # the newest commit on origin/main
#   bash docker/staging/deploy.sh <commit>       # a given commit on main
#   bash docker/staging/deploy.sh <older commit> --rollback
#   bash docker/staging/deploy.sh --here         # the clone's commit, as it is (setup scripts)
# Once only, from the one-container stack of m1-055 to m1-067 (runbook §12.3):
#   add --switch-from-one-container
#
# It moves the clone to the commit (detached), so the Compose files match the
# images; pulls them; takes a PBM base backup if the stack runs; then starts
# what changed. An app release does not restart MongoDB. Needs
# `docker login ghcr.io` once (runbook §12.1) and ASSURER_PROXY_MODE in
# docker/staging/.env, which ip-setup.sh, npm-setup.sh and install.sh write.
set -euo pipefail

# Everything is in main(), so that bash has read the whole file before
# `git checkout` replaces it.
main() {
  cd "$(dirname "$0")/../.."
  local env_file=docker/staging/.env old_project=assurer-staging
  local target="" here=0 rollback=0 switch=0 arg
  for arg in "$@"; do
    case "$arg" in
      --here) here=1 ;;
      --rollback) rollback=1 ;;
      --switch-from-one-container) switch=1 ;;
      -h|--help) sed -n '2,18p' "$0"; return 0 ;;
      -*) die "unknown option $arg (see --help)" ;;
      *) [ -z "$target" ] || die "give one commit only"; target="$arg" ;;
    esac
  done
  [ "$here" = 0 ] || [ -z "$target" ] || die "--here and a commit cannot go together"

  # 1. The host and the settings (read-only).
  local kernel mode
  kernel=$(uname -r)
  case "$kernel" in
    6.8.*) say "kernel $kernel: on the 6.8 line (D-DB-16)" ;;
    *) die "kernel $kernel is not on the 6.8 line; MongoDB 8.0.34 may refuse it (D-DB-16)" ;;
  esac
  [ -f "$env_file" ] || die "no $env_file; start with ip-setup.sh, npm-setup.sh or install.sh (runbook §10, §11)"
  mode=$(env_get "$env_file" ASSURER_PROXY_MODE)
  local -a S=(docker compose -f docker/staging/compose.yaml)
  case "$mode" in
    standalone) ;;
    npm) S+=(-f docker/staging/compose.npm.yaml) ;;
    ip) S+=(-f docker/staging/compose.ip.yaml) ;;
    *) die "ASSURER_PROXY_MODE in $env_file is '${mode}', not ip, npm or standalone. Run the setup script of your route again (runbook §12.3)" ;;
  esac
  say "route: $mode"

  # 2. The commit. Images exist only for commits on main that passed CI.
  [ -z "$(git status --porcelain --untracked-files=no)" ] \
    || die "the clone has local changes (git status); the files must match the release"
  local start start_ref sha current
  start=$(git rev-parse HEAD)
  start_ref=$(git symbolic-ref -q --short HEAD || echo "$start")
  if [ "$here" = 1 ]; then
    sha=$start
  else
    git fetch -q origin main || die "cannot reach origin to fetch main"
    sha=$(git rev-parse --verify --quiet "${target:-origin/main}^{commit}") \
      || die "unknown commit '${target}'"
    git merge-base --is-ancestor "$sha" origin/main || die "commit $sha is not on main; only main has images"
  fi
  current=$(env_get "$env_file" ASSURER_IMAGE_TAG)
  if [ -n "$current" ] && [ "$current" != "$sha" ] && git merge-base --is-ancestor "$sha" "$current" 2> /dev/null; then
    [ "$rollback" = 1 ] || die "$sha is older than the running release $current. Add --rollback to go back; read runbook §12.2 first"
    warn "rolling back. Apostrophe migrations only go forward: if a release after $sha added one,"
    warn "the older code meets data it did not write. Then restore to the backup taken before that release (PBM runbook §4)."
  fi
  say "release: $sha ($(git log -1 --format='%cs %s' "$sha" | cut -c1-70))"

  # 3. The one-container stack, if it is still here (once only).
  local old
  old=$(docker ps -q --filter "label=com.docker.compose.project=$old_project")
  if [ -n "$old" ]; then
    [ "$switch" = 1 ] || die "the one-container stack ($old_project) is running. Read runbook §12.3, then add --switch-from-one-container"
  fi

  # 4. Move the clone, then pull. If the pull fails, nothing has changed.
  if [ "$sha" != "$start" ]; then
    git -c advice.detachedHead=false checkout -q --detach "$sha"
  fi
  say "pulling the images"
  if ! ASSURER_IMAGE_TAG=$sha "${S[@]}" pull --quiet; then
    [ "$sha" = "$start" ] || git checkout -q "$start_ref"
    die "no images for $sha yet: CI on main may still be running or may have failed. Nothing was changed. Is 'docker login ghcr.io' done (runbook §12.1)?"
  fi

  # 5. A base backup of the running site, the point to return to (D-DB-4).
  if [ -n "$old" ]; then
    say "base backup in the one-container stack, then stopping it (its volumes stay)"
    docker exec "${old_project}-site-1" pbmc backup --wait > /dev/null || die "the backup in ${old_project}-site-1 failed; nothing was stopped"
    # shellcheck disable=SC2086
    docker stop $old > /dev/null
  elif [ -n "$("${S[@]}" ps -q --status running pbm 2> /dev/null)" ]; then
    say "base backup before the release"
    "${S[@]}" exec -T pbm pbmc backup --wait > /dev/null || die "the base backup failed; nothing was changed (see: ${S[*]} exec pbm pbmc logs)"
    say "backup finished at $(date -u +%Y-%m-%dT%H:%M:%SZ): a PITR point before this release"
  fi

  # 6. Start what changed. The settings file keeps the previous release.
  [ -z "$current" ] || [ "$current" = "$sha" ] || set_key "$env_file" ASSURER_PREVIOUS_TAG "$current"
  set_key "$env_file" ASSURER_IMAGE_TAG "$sha"
  say "starting"
  "${S[@]}" up -d
  if [ "$mode" = ip ]; then
    # nginx from an earlier NPM or standalone start; stopped by name, so
    # nothing else is removed.
    "${S[@]}" stop nginx certbot > /dev/null 2>&1 || true
  fi

  # 7. A new MongoDB certificate (setup.sh) needs MongoDB and its clients restarted.
  if ! "${S[@]}" exec -T mongo cmp -s /secrets/tls/serial /tmp/assurer-tls-serial; then
    say "new MongoDB certificate: restarting MongoDB, then the app and PBM"
    "${S[@]}" restart mongo
    "${S[@]}" restart app pbm backup
  fi

  # 8. Checks.
  local status="" app_id
  say "waiting for the app (a first start takes a few minutes)"
  app_id=$("${S[@]}" ps -q app)
  for _ in $(seq 1 60); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$app_id" 2> /dev/null || true)
    [ "$status" = healthy ] && break
    sleep 10
  done
  [ "$status" = healthy ] || die "the app is '${status:-not running}' after 10 minutes; see: ${S[*]} logs app"
  say "the app is healthy"
  local pbm_ok=0
  for _ in $(seq 1 12); do
    if "${S[@]}" exec -T pbm pbmc status 2> /dev/null | grep -q 'pbm-agent \[v[0-9.]*\] OK'; then pbm_ok=1; break; fi
    sleep 5
  done
  [ "$pbm_ok" = 1 ] && say "pbm-agent OK" || warn "pbm-agent is not OK yet; check: ${S[*]} exec pbm pbmc status"

  echo
  say "images:"
  local svc
  for svc in app mongo nginx certbot; do
    docker image inspect -f "  $svc {{index .RepoDigests 0}}" \
      "${ASSURER_REGISTRY:-ghcr.io/mimnets}/assurer-$svc:$sha" 2> /dev/null || true
  done
  cat <<EOF

Done: release $sha runs ($mode route).
- Commands from here: S="${S[*]}"   (runbook §4)
EOF
  local previous
  previous=$(env_get "$env_file" ASSURER_PREVIOUS_TAG)
  [ -z "$previous" ] || echo "- Back to the previous release: bash docker/staging/deploy.sh $previous --rollback   (runbook §12.2)"
  [ -z "$old" ] || echo "- The one-container stack is stopped; its volumes stay until you remove them (runbook §12.3)."
}

say()  { echo "[deploy] $*"; }
warn() { echo "[deploy] WARNING: $*"; }
die()  { echo "[deploy] STOP: $*" >&2; exit 1; }
env_get() { sed -n "s/^$2=//p" "$1" | tail -1; }
set_key() {
  if grep -q "^$2=" "$1"; then sed -i "s|^$2=.*|$2=$3|" "$1"
  else echo "$2=$3" >> "$1"; fi
}

main "$@"; exit $?
