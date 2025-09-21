import { WhisperWorker } from './whisper.worker';
import fs from "fs";
import { ensureWhisperSetup, MODEL_MAP } from './whisper.config';
import { Logger } from '@src/logger';


export class Whisperer {
    private static instance: Whisperer;
    private worker: WhisperWorker | null = null;
    private transcriptionCallbacks: Array<(text: string) => void> = [];
    private isTranscribing: boolean = false;
    private constructor() {}

    static async initWhisper() {
        // Ensure whisper.cpp and models are set up
        await ensureWhisperSetup();

        if (!this.instance) this.instance = new Whisperer();

        // Use the first model in MODEL_MAP
        const modelPath = Object.values(MODEL_MAP)[0];
        if (!fs.existsSync(modelPath)) {
            Logger.DEBUG(`Model file not found at ${modelPath}`, 'WHISPER');
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

    async start() {
        if (!this.worker) throw new Error("No worker loaded");
        if (this.isTranscribing) {
            Logger.DEBUG("Whisperer is already transcribing, ignoring start request", 'WHISPER');
            return;
        }
        this.isTranscribing = true;
        await this.worker.start();
    }

    // New method to add audio data for processing
    addAudioData(audioData: Buffer) {
        if (!this.worker) throw new Error("No worker loaded");
        if (!this.isTranscribing) {
            Logger.DEBUG("Whisperer not transcribing, ignoring audio data", 'WHISPER');
            return;
        }
        this.worker.addAudioData(audioData);
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

    removeTranscriptionCallback(callback: (text: string) => void) {
        const index = this.transcriptionCallbacks.indexOf(callback);
        if (index > -1) {
            this.transcriptionCallbacks.splice(index, 1);
        }
    }

    async stop() {
        if (this.worker) {
            await this.worker.stop();
            this.isTranscribing = false;
            Logger.DEBUG("Whisperer transcription stopped", 'WHISPER');
        }
    }

    static async cleanup() {
        if (this.instance) {
            await this.instance.stop();
        }
    }

    getTranscribingState(): boolean {
        return this.isTranscribing;
    }
}