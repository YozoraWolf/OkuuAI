import type { UploadedFile } from 'express-fileupload';

const getWhisperUrl = () => `${(process.env.WHISPER_BASE_URL || 'http://127.0.0.1:8096').replace(/\/$/, '')}/v1/audio/transcriptions`;

export async function transcribeAudio(file: UploadedFile): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([file.data], { type: file.mimetype || 'audio/webm' }), file.name || 'voice-note.webm');
  form.append('model', process.env.WHISPER_MODEL || 'whisper-1');
  form.append('response_format', 'json');

  const response = await fetch(getWhisperUrl(), {
    method: 'POST',
    headers: process.env.WHISPER_API_KEY ? { Authorization: `Bearer ${process.env.WHISPER_API_KEY}` } : {},
    body: form,
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Whisper returned ${response.status}: ${await response.text()}`);

  const payload: any = await response.json();
  const text = payload.text || payload.transcription || payload.result?.text;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Whisper returned no transcription text.');
  return text.trim();
}
