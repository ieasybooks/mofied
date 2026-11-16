#!/usr/bin/env bash
# Checks that mofied.com serves the build in apps/web/dist: its index.html
# loads the same fingerprinted assets, and the pages and app-link files the
# stores and apps rely on answer. The release workflow runs it after
# deploying; run it after a manual `bun run deploy:web` too.
#
#   scripts/release/check-live-web.sh [https://mofied.com]
set -euo pipefail

site=${1:-https://mofied.com}
assets() { grep -oE '(src|href)="/assets/[^"]+"' | sort; }

expected=$(assets < apps/web/dist/index.html)
if [ -z "$expected" ]; then
  echo "apps/web/dist/index.html loads no /assets/ files; build the web first." >&2
  exit 1
fi

# A new deployment can take a few seconds to reach every location.
for attempt in $(seq 1 12); do
  live=$(curl -fsS "$site/?release-check=$(date +%s)" | assets || true)
  [ "$live" = "$expected" ] && break
  if [ "$attempt" = 12 ]; then
    echo "$site still serves another build after two minutes. Expected:" >&2
    echo "$expected" >&2
    echo "Served:" >&2
    echo "${live:-nothing}" >&2
    exit 1
  fi
  sleep 10
done

for path in /privacy/ /support/ /.well-known/apple-app-site-association /.well-known/assetlinks.json; do
  if ! curl -fsS -o /dev/null "$site$path"; then
    echo "$site$path doesn't answer." >&2
    exit 1
  fi
done
echo "$site serves this build."
