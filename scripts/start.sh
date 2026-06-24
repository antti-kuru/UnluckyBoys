#!/bin/sh
set -eu

API_PORT="${API_PORT:-8000}"
WEB_PORT="${PORT:-4321}"

export API_PORT
export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${API_PORT}/api}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${WEB_PORT}"

node /app/server/dist/index.js &
api_pid="$!"

sleep 1
if ! kill -0 "$api_pid" 2>/dev/null; then
  wait "$api_pid"
  exit 1
fi

cleanup() {
  kill "$api_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

node /app/client/dist/server/entry.mjs
