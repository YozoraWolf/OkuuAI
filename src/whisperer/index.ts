import { WhisperWorker } from './whisper.worker';
import path from 'path';
import fs from 'fs';
import { ensureWhisperSetup, Language, MODEL_MAP } from './whisper.config';


export class Whisperer {
    private static instance: Whisperer;
    private workers: Record<Language, WhisperWorker> = {} as any;
    private transcriptionCallbacks: Record<Language, Array<(text: string) => void>> = {} as any;

    private pcmBuffer: Buffer = Buffer.alloc(0);

    private constructor() {}

    static async initWhisper() {
        // Ensure whisper.cpp and models are set up
        ensureWhisperSetup();

        // singleton
        if (!this.instance) this.instance = new Whisperer();

        // Map language codes to model files
        for (const [lang, modelPath] of Object.entries(MODEL_MAP)) {
            if (!fs.existsSync(modelPath)) {
                throw new Error(`Model for ${lang} not found at ${modelPath}`);
            }
            const worker = new WhisperWorker(modelPath);
            await worker.start();
            this.instance.workers[lang as Language] = worker;
        }

        return this.instance;
    }

    static getInstance(): Whisperer {
        if (!this.instance) throw new Error("Whisperer not initialized yet");
        return this.instance;
    }


    feedAudio(chunk: Buffer, lang: Language = 'en') {
        // Debug log
        //console.debug(`[Whisperer] feedAudio called for lang=${lang}, chunk size=${chunk.length}`);
        const worker = this.workers[lang];
        if (!worker) throw new Error(`No worker loaded for language: ${lang}`);
        worker.feedAudio(chunk);
    }

    onTranscription(lang: Language, callback: (text: string) => void) {
        // Debug log
        //console.debug(`[Whisperer] onTranscription registered for lang=${lang}`);
        if (!this.transcriptionCallbacks[lang]) {
            this.transcriptionCallbacks[lang] = [];
            // Register a single handler with the worker that fans out to all callbacks
            const worker = this.workers[lang];
            if (!worker) throw new Error(`No worker loaded for language: ${lang}`);
            worker.onTranscription((text: string) => {
                for (const cb of this.transcriptionCallbacks[lang]) {
                    cb(text);
                }
            });
        }
        this.transcriptionCallbacks[lang].push(callback);
    }

    async stop() {
        for (const worker of Object.values(this.workers)) {
            await worker.stop();
        }
    }
}