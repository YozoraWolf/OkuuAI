import express from 'express';
import { transcribeAudio, generateTTS } from '../controllers/audio.controller';

const router = express.Router();

// Routes for local STT (Whisper) and TTS (Kokoro)
router.post('/transcribe', transcribeAudio);
router.post('/tts', generateTTS);

export default router;
