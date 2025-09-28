import { Router } from "express";
import TTSService from "../services/tts.service";
import { Logger } from "../logger";

const router = Router();

// Test endpoint to check if TTS is working
router.post('/test', async (req, res) => {
    try {
        Logger.INFO('TTS Test endpoint called');
        const { text } = req.body;
        
        if (!text) {
            Logger.WARN('TTS Test: No text provided');
            return res.status(400).json({ error: 'Text is required' });
        }

        Logger.INFO(`TTS Test: Generating audio for text: "${text}"`);
        
        const ttsService = TTSService.getInstance();
        
        if (!ttsService.isReady()) {
            Logger.WARN('TTS Test: TTS service is not ready');
            return res.status(503).json({ error: 'TTS service is not ready' });
        }

        const audioBuffer = await ttsService.generateAudio(text);
        
        if (!audioBuffer) {
            Logger.ERROR('TTS Test: No audio buffer generated');
            return res.status(500).json({ error: 'Failed to generate audio' });
        }

        Logger.INFO(`TTS Test: Generated audio buffer of size: ${audioBuffer.length} bytes`);
        Logger.INFO(`TTS Test: First 20 bytes: ${Array.from(audioBuffer.slice(0, 20)).join(', ')}`);
        Logger.INFO(`TTS Test: Buffer type: ${audioBuffer.constructor.name}`);
        
        // Return the audio as base64 for testing
        const base64Audio = audioBuffer.toString('base64');
        
        res.json({
            success: true,
            audioLength: audioBuffer.length,
            base64Audio: base64Audio.substring(0, 100) + '...',  // Just first 100 chars for debugging
            firstBytes: Array.from(audioBuffer.slice(0, 20)),
            bufferType: audioBuffer.constructor.name
        });
        
    } catch (error) {
        Logger.ERROR(`TTS Test error: ${error}`);
        res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
    }
});

// Get TTS service status
router.get('/status', (req, res) => {
    try {
        const ttsService = TTSService.getInstance();
        const isReady = ttsService.isReady();
        const config = ttsService.getConfig();
        
        Logger.INFO(`TTS Status check: Ready = ${isReady}`);
        
        res.json({
            ready: isReady,
            service: 'kokoro-js',
            config: {
                voice: config.voice,
                enabled: config.enabled,
                model: config.model_id,
                dtype: config.dtype
            }
        });
    } catch (error) {
        Logger.ERROR(`TTS Status error: ${error}`);
        res.status(500).json({ error: 'Failed to get TTS status', details: error instanceof Error ? error.message : String(error) });
    }
});

// Reload TTS configuration from assistant.json
router.post('/reload-config', (req, res) => {
    try {
        const ttsService = TTSService.getInstance();
        ttsService.reloadConfig();
        const config = ttsService.getConfig();
        
        Logger.INFO('TTS configuration reloaded via API');
        
        res.json({
            success: true,
            message: 'TTS configuration reloaded',
            config: {
                voice: config.voice,
                enabled: config.enabled,
                model: config.model_id,
                dtype: config.dtype
            }
        });
    } catch (error) {
        Logger.ERROR(`TTS config reload error: ${error}`);
        res.status(500).json({ error: 'Failed to reload TTS config', details: error instanceof Error ? error.message : String(error) });
    }
});

// Test endpoint with no voice parameter (use defaults)
router.post('/test-no-voice', async (req, res) => {
    try {
        Logger.INFO('TTS Test (no voice) endpoint called');
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const ttsService = TTSService.getInstance();
        
        if (!ttsService.isReady()) {
            return res.status(503).json({ error: 'TTS service is not ready' });
        }

        // Generate audio with no voice parameter (let kokoro use default)
        const audioBuffer = await ttsService.generateAudioNoVoice(text);
        
        if (!audioBuffer) {
            return res.status(500).json({ error: 'Failed to generate audio' });
        }

        Logger.INFO(`TTS Test (no voice): Generated audio buffer of size: ${audioBuffer.length} bytes`);
        
        const base64Audio = audioBuffer.toString('base64');
        
        res.json({
            success: true,
            audioLength: audioBuffer.length,
            base64Audio: base64Audio.substring(0, 100) + '...',
            firstBytes: Array.from(audioBuffer.slice(0, 20))
        });
        
    } catch (error) {
        Logger.ERROR(`TTS Test (no voice) error: ${error}`);
        res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
    }
});

export default router;