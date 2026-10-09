#!/usr/bin/env bash
# Run the browser verification for floating-dots end to end.
#
# The check needs the showcase served over HTTP. Rather than requiring the
# caller to start a server first (which makes the verification impossible
# to re-run as a single command), this script starts a static server,
# waits for it, runs the checks, and cleans up on exit.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
port="${PORT:-4331}"

python3 -m http.server "$port" --directory "$here" >/dev/null 2>&1 &
server_pid=$!
cleanup() { kill "$server_pid" 2>/dev/null || true; }
trap cleanup EXIT

# Wait for the server to accept a connection before handing over.
for _ in $(seq 1 40); do
  if curl -sf -o /dev/null "http://127.0.0.1:${port}/"; then break; fi
  sleep 0.1
done

PORT="$port" BASE_URL="http://127.0.0.1:${port}/" \
  node "$here/tests/browser-check.mjs"
