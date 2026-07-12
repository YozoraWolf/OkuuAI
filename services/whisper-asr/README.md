# Standalone Whisper ASR

This module provides the shared OpenAI-compatible transcription service used by OkuuAI and OkuuClaw.

OkuuAI starts it automatically in a detached `screen` session named `okuuwhis`. The default endpoint is:

```text
http://127.0.0.1:8096/v1/audio/transcriptions
```

Configure the model, port, Python executable, and compute backend with the `WHISPER_*` environment variables documented in `.env.example`.
