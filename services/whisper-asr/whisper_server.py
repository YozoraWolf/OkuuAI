#!/usr/bin/env python3
"""Standalone OpenAI-compatible Whisper transcription service."""

import json
import os
import tempfile
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from faster_whisper import WhisperModel


HOST = os.getenv("WHISPER_HOST", "127.0.0.1")
PORT = int(os.getenv("WHISPER_PORT", "8096"))
MODEL_NAME = os.getenv("WHISPER_MODEL_NAME", "medium")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)


class WhisperHandler(BaseHTTPRequestHandler):
    server_version = "OkuuWhisper/1.0"

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {
                "ok": True,
                "model": MODEL_NAME,
                "device": DEVICE,
                "compute_type": COMPUTE_TYPE,
            })
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/v1/audio/transcriptions":
            self.send_json(404, {"error": "not found"})
            return
        if "multipart/form-data" not in self.headers.get("Content-Type", ""):
            self.send_json(400, {"error": "expected multipart/form-data"})
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        message = BytesParser(policy=default).parsebytes(
            f"Content-Type: {self.headers['Content-Type']}\r\nMIME-Version: 1.0\r\n\r\n".encode()
            + self.rfile.read(content_length)
        )
        upload = next(
            (part for part in message.iter_parts() if part.get_param("name", header="content-disposition") == "file"),
            None,
        )
        if upload is None:
            self.send_json(400, {"error": "audio file is required"})
            return

        suffix = os.path.splitext(upload.get_filename() or "audio.webm")[1] or ".webm"
        temp_path = ""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_file.write(upload.get_payload(decode=True))
                temp_path = temp_file.name

            segments, info = model.transcribe(temp_path, vad_filter=True)
            text = " ".join(segment.text.strip() for segment in segments).strip()
            self.send_json(200, {"text": text, "language": info.language, "duration": info.duration})
        except Exception as error:
            self.send_json(500, {"error": str(error)})
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)

    def log_message(self, message, *args):
        if os.getenv("WHISPER_LOGS", "0") == "1":
            super().log_message(message, *args)


if __name__ == "__main__":
    print(f"Whisper ASR listening on http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), WhisperHandler).serve_forever()
