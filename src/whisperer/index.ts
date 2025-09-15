import { WhisperWorker } from './whisper.worker';
import fs from "fs";
import { ensureWhisperSetup, MODEL_MAP } from './whisper.config';
import { Logger } from '@src/logger';


export class Whisperer {
    private static instance: Whisperer;
    private worker: WhisperWorker | null = null;
    private transcriptionCallbacks: Array<(text: string) => void> = [];
    private pcmBuffer: Buffer = Buffer.alloc(0);
    private constructor() {}

    static async initWhisper() {
        // Ensure whisper.cpp and models are set up
        await ensureWhisperSetup();

        if (!this.instance) this.instance = new Whisperer();

        // Use the first model in MODEL_MAP
        const modelPath = Object.values(MODEL_MAP)[0];
        if (!fs.existsSync(modelPath)) {
            Logger.ERROR(`Model file not found at ${modelPath}`);
            throw new Error(`Model not found at ${modelPath}`);
        }
        const worker = new WhisperWorker(modelPath);
        this.instance.worker = worker;
        return this.instance;
    }

    static getInstance(): Whisperer {
        if (!this.instance) throw new Error("Whisperer not initialized yet");
        return this.instance;
    }

    feedAudio(chunk: Buffer) {
        if (!this.worker) throw new Error("No worker loaded");
        this.worker.feedAudio(chunk);
    }

    onTranscription(callback: (text: string) => void) {
        if (!this.worker) throw new Error("No worker loaded");
        if (this.transcriptionCallbacks.length === 0) {
            this.worker.onTranscription((text: string) => {
                for (const cb of this.transcriptionCallbacks) {
                    cb(text);
                }
            });
        }
        this.transcriptionCallbacks.push(callback);
    }

    async stop() {
        if (this.worker) {
            await this.worker.stop();
        }
    }
}