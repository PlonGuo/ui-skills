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

server_log="$(mktemp /tmp/floating-dots-server.XXXXXX)"
node "$here/server.mjs" --port "$port" >"$server_log" 2>&1 &
server_pid=$!
cleanup() { kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true; rm -f "$server_log"; }
trap cleanup EXIT

# Wait for the server to accept a connection before handing over.
ready=0
for _ in $(seq 1 40); do
  if ! kill -0 "$server_pid" 2>/dev/null; then cat "$server_log" >&2; exit 1; fi
  if curl -sf -o /dev/null "http://127.0.0.1:${port}/"; then ready=1; break; fi
  sleep 0.1
done
if [ "$ready" -ne 1 ]; then cat "$server_log" >&2; echo "Preview did not become ready" >&2; exit 1; fi

PORT="$port" BASE_URL="http://127.0.0.1:${port}/" \
  node "$here/tests/browser-check.mjs"
