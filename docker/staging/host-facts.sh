#!/bin/bash
# Read-only facts from a host before the staging stack runs on it (m1-063;
# runbook docs/runbooks/staging-container.md §9.1 B). Changes nothing. Writes
# the output to the screen and to a file outside the repository, so it cannot
# be committed by accident. Usage, from the repository root:
#   bash docker/staging/host-facts.sh [output file]   # default ~/assurer-host-facts.txt
# Only `ss` needs sudo, to show which process holds each port.
set -uo pipefail
out="${1:-$HOME/assurer-host-facts.txt}"

{
  echo "== kernel and OS"; uname -r; uname -m; head -4 /etc/os-release
  echo "== kernel packages"
  dpkg -l 'linux-image-*' 'linux-oracle*' 'linux-generic*' 2>/dev/null | grep ^ii
  echo "== docker"
  docker version --format '{{.Server.Version}}'; docker compose version
  echo "== daemon.json"; cat /etc/docker/daemon.json 2>/dev/null || echo "(no daemon.json)"
  echo "== containers"; docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
  echo "== networks"; docker network ls
  echo "== ports 80/81/443/3042"; sudo ss -tlnp | grep -E ':(80|81|443|3042)\b'
  echo "== ipv6"; ip -6 addr show scope global
  echo "== disk and memory"; df -h /; free -m
} 2>&1 | tee "$out"

echo "Saved to $out"
