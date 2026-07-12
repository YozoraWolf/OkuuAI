#!/usr/bin/env python3
"""Standalone OpenAI-compatible Whisper transcription service."""

import cgi
import json
import os
import tempfile
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

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": self.headers["Content-Type"]},
        )
        upload = form["file"] if "file" in form else None
        if upload is None or not getattr(upload, "file", None):
            self.send_json(400, {"error": "audio file is required"})
            return

        suffix = os.path.splitext(getattr(upload, "filename", "audio.webm"))[1] or ".webm"
        temp_path = ""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_file.write(upload.file.read())
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
