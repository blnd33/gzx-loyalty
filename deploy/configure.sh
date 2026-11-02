#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$#" -lt 1 ]; then
  echo 'Usage: sh deploy/configure.sh loyalty.your-domain.com [owner-email]' >&2
  exit 1
fi
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/workspace" -w /workspace node:24.14.1-bookworm-slim node deploy/configure.mjs "$@"
