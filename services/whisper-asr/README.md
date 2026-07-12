# Standalone Whisper ASR

This module provides the OpenAI-compatible transcription service used by OkuuAI.

The server starts automatically in a detached `screen` session named `okuuwhis`. The default endpoint is:

```text
http://127.0.0.1:8096/v1/audio/transcriptions
```

Configure the model, port, Python executable, and compute backend with the `WHISPER_*` environment variables documented in `.env.example`.

## Setup

```bash
python3 -m venv services/whisper-asr/.venv
services/whisper-asr/.venv/bin/pip install -r services/whisper-asr/requirements.txt
```

The process manager requires GNU Screen. Set `WHISPER_AUTOSTART=false` to run the service through another process manager.
