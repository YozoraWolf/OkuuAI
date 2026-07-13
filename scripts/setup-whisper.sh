#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_DIR="$ROOT_DIR/services/whisper-asr"
PYTHON="${WHISPER_SETUP_PYTHON:-python3}"

"$PYTHON" -m venv "$SERVICE_DIR/.venv"
"$SERVICE_DIR/.venv/bin/pip" install -r "$SERVICE_DIR/requirements.txt"

echo "Whisper environment is ready at $SERVICE_DIR/.venv"
