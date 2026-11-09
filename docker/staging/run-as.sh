#!/bin/bash
# Runs a command as another OS user, in place of gosu, which the staging image
# removes (D-SEC-8). setpriv comes with the base image's util-linux. It leaves
# the environment alone, so HOME is set here as gosu did. exec keeps the process
# ID, so the entrypoint's signals and `wait` reach the command itself.
set -euo pipefail
user="$1"
shift
HOME="$(getent passwd "$user" | cut -d: -f6)"
export HOME
exec setpriv --reuid="$user" --regid="$user" --init-groups "$@"
