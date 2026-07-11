import { Request, Response } from 'express';
import fileUpload from 'express-fileupload';
import axios from 'axios';
import { Logger } from '../logger';
import FormData from 'form-data';
import { Worker } from 'worker_threads';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const WHISPER_API = process.env.WHISPER_URL || 'http://127.0.0.1:8081/inference';

export const transcribeAudio = async (req: Request, res: Response) => {
    try {
        if (!req.files || !req.files.audio) {
            return res.status(400).send('No audio file was uploaded.');
        }

        const file = req.files.audio as fileUpload.UploadedFile;
        Logger.DEBUG(`Received audio file for STT: ${file.name} (${file.size} bytes)`);

        // Convert the WebRTC live chunked payload directly to a 16khz canonical WAV using FFmpeg
        const tempId = Date.now().toString();
        const inPath = path.resolve(`/tmp/stt_in_${tempId}.webm`);
        const outPath = path.resolve(`/tmp/stt_out_${tempId}.wav`);

        fs.writeFileSync(inPath, file.data);
        try {
            execSync(`ffmpeg -y -i ${inPath} -ar 16000 -ac 1 -c:a pcm_s16le ${outPath} > /dev/null 2>&1`);
            const wavBuffer = fs.readFileSync(outPath);
            file.data = wavBuffer;
            file.name = 'audio.wav';
            file.mimetype = 'audio/wav';
        } catch (ffmpegErr) {
            Logger.ERROR(`Local FFmpeg STT conversion failed. Check if ffmpeg is installed! ${ffmpegErr}`);
        } finally {
            if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
            if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        }

        const formData = new FormData();
        formData.append('file', file.data, {
            filename: file.name || 'audio.wav',
            contentType: file.mimetype || 'audio/wav'
        });

        // Add additional whisper.cpp server options
        formData.append('response_format', 'json');
        formData.append('temperature', '0.0');

        const headers: any = formData.getHeaders();
        try {
            headers['Content-Length'] = formData.getLengthSync();
        } catch (e) {
            Logger.DEBUG('Could not determine form data sync length.');
        }

        const response = await axios.post(WHISPER_API, formData, {
            headers,
            maxBodyLength: Infinity
        });

        if (response.data && response.data.text) {
            res.json({ text: response.data.text });
        } else {
            Logger.ERROR(`Whisper unexpected response: ${JSON.stringify(response.data)}`);
            res.status(500).json({ error: 'Failed to transcribe audio' });
        }
    } catch (err: any) {
        Logger.ERROR(`Error communicating with Whisper container: ${err.message}`);
        res.status(500).json({ error: 'STT Error' });
    }
};

// Global TTS worker instance
let ttsWorker: Worker | null = null;
let ttsInitializationPromise: Promise<boolean> | null = null;
let requestIdCounter = 0;
const pendingTTSRequests = new Map<number, { resolve: Function, reject: Function }>();

const ensureTTSWorker = (): Promise<boolean> => {
    if (ttsInitializationPromise) {
        return ttsInitializationPromise;
    }

    ttsInitializationPromise = new Promise((resolve, reject) => {
        try {
            // First check if we can safely just use the Node.js thread directly vs worker
            // Since we know dist/workers/tts.worker.js exists from previous runs, we can hook it up
            const workerPath = path.resolve(process.cwd(), 'dist/workers/tts.worker.js');

            if (!fs.existsSync(workerPath)) {
                Logger.ERROR(`TTS Worker not found at ${workerPath}`);
                ttsInitializationPromise = null;
                return reject(new Error('TTS Worker script missing'));
            }

            ttsWorker = new Worker(workerPath);

            ttsWorker.on('message', (msg) => {
                if (msg.type === 'ready') {
                    // Send initialization payload to warm up the model
                    ttsWorker?.postMessage({
                        type: 'initialize',
                        config: { model_id: 'kokoro-v0_19', voice: 'af_sarah' }
                    });
                } else if (msg.type === 'initialized') {
                    Logger.INFO(`TTS Worker successfully initialized Kokoro: ${msg.success}`);
                    resolve(true);
                } else if (msg.type === 'audio' || msg.type === 'error') {
                    const reqHandler = pendingTTSRequests.get(msg.data?.id || msg.id);
                    if (reqHandler) {
                        if (msg.type === 'audio' && msg.data?.success) {
                            reqHandler.resolve(msg.data.audioBuffer);
                        } else {
                            // Can be error response
                            reqHandler.reject(new Error(msg.data?.error || msg.error || 'TTS Generation Failed'));
                        }
                        pendingTTSRequests.delete(msg.data?.id || msg.id);
                    }
                }
            });

            ttsWorker.on('error', (err) => {
                Logger.ERROR(`TTS Worker threw an error: ${err.message}`);
                ttsInitializationPromise = null;
                reject(err);
            });

            ttsWorker.on('exit', (code) => {
                if (code !== 0) Logger.ERROR(`TTS Worker stopped with exit code ${code}`);
                ttsWorker = null;
                ttsInitializationPromise = null;
            });
        } catch (err) {
            Logger.ERROR(`Failed to spawn TTS Worker: ${err}`);
            ttsInitializationPromise = null;
            reject(err);
        }
    });

    return ttsInitializationPromise;
};

export const generateTTS = async (req: Request, res: Response) => {
    try {
        const { text, voice = 'af_sarah' } = req.body;
        if (!text || text.trim() === '') {
            return res.status(400).send('No text provided for TTS.');
        }

        Logger.DEBUG(`TTS Request for voice [${voice}]: ${text.substring(0, 50)}...`);

        // Start worker if not alive
        await ensureTTSWorker();

        if (!ttsWorker) {
            throw new Error('TTS Worker unavailable');
        }

        const reqId = ++requestIdCounter;

        const audioPromise = new Promise<Buffer>((resolve, reject) => {
            pendingTTSRequests.set(reqId, { resolve, reject });

            ttsWorker!.postMessage({
                type: 'generate',
                data: {
                    id: reqId,
                    text: text,
                    config: { voice: voice }
                }
            });
        });

        // Set a 30s timeout so we don't leak memory on bad requests
        const timeoutPromise = new Promise<Buffer>((_, reject) =>
            setTimeout(() => reject(new Error('TTS Generation Timeout')), 30000)
        );

        const audioBuffer = await Promise.race([audioPromise, timeoutPromise]);

        res.set({
            'Content-Type': 'audio/wav',
            'Content-Length': audioBuffer.length
        });

        res.send(audioBuffer);

    } catch (err: any) {
        Logger.ERROR(`TTS Generation Error: ${err.message}`);
        res.status(500).json({ error: 'TTS Generation Error' });
    }
};
