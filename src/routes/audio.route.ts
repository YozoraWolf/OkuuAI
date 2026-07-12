import { Router } from 'express';
import type fileUpload from 'express-fileupload';
import { transcribeAudio } from '../services/whisper.service';
import { Logger } from '../logger';

const router = Router();

router.post('/transcriptions', async (req, res) => {
  const uploaded = req.files?.file;
  if (!uploaded || Array.isArray(uploaded)) return res.status(400).json({ error: 'One audio file is required.' });

  const file = uploaded as fileUpload.UploadedFile;
  if (!file.mimetype.startsWith('audio/')) return res.status(400).json({ error: 'The uploaded file must be audio.' });

  try {
    res.json({ text: await transcribeAudio(file) });
  } catch (error) {
    Logger.ERROR(`Voice transcription failed: ${error}`);
    res.status(502).json({ error: 'Voice transcription service is unavailable.' });
  }
});

export default router;
