#!/usr/bin/env bash
set -euo pipefail

export REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
export REDIS_PORT="${REDIS_PORT:-6009}"
export REDIS_PWD="${REDIS_PWD:-admin1234}"
export LLM_PROVIDER="${LLM_PROVIDER:-openai-compatible}"
export LLM_BASE_URL="${LLM_BASE_URL:-http://127.0.0.1:8080/v1}"
export LLM_MODEL="${LLM_MODEL:-local-model}"
export EMBEDDING_PROVIDER="${EMBEDDING_PROVIDER:-none}"

docker compose up -d redis

npm run dev:backend &
backend_pid=$!

npm run dev:frontend &
frontend_pid=$!

cleanup() {
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
}

trap cleanup EXIT INT TERM
wait -n "$backend_pid" "$frontend_pid"
