import { Worker } from 'worker_threads';
import { Logger } from '@src/logger';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { emitTTSAudio } from '../sockets';

export interface TTSConfig {
    voice: string;
    enabled: boolean;
    model_id: string;
    dtype: "fp32" | "fp16" | "q8" | "q4" | "q4f16";
    device: "cpu";
}

export interface TTSChunk {
    text: string;
    phonemes: string;
    audio: Buffer;
    index: number;
}

interface PendingRequest {
    id: string;
    resolve: (buffer: Buffer | null) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

export class TTSService {
    private static instance: TTSService;
    private worker: Worker | null = null;
    private isInitialized = false;
    private isWorkerReady = false;
    private config: TTSConfig = {
        voice: 'af_sarah', // Will be loaded from assistant.json
        enabled: true,
        model_id: 'onnx-community/Kokoro-82M-v1.0-ONNX',
        dtype: 'q8', // Good balance of quality and performance
        device: 'cpu'
    };
    private pendingRequests = new Map<string, PendingRequest>();
    private asyncRequests = new Map<string, {index: number, sessionId: string, text: string}>();
    private requestTimeout = 30000; // 30 second timeout for TTS requests

    private constructor() {}

    /**
     * Load TTS configuration from assistant.json
     */
    private async loadConfigFromAssistant(): Promise<void> {
        try {
            const assistantPath = path.join(process.cwd(), 'assistant.json');
            if (!fs.existsSync(assistantPath)) {
                Logger.WARN('assistant.json not found, using default TTS config');
                return;
            }

            const assistantData = JSON.parse(await fs.promises.readFile(assistantPath, 'utf-8'));
            
            // Update TTS config from assistant.json
            if (assistantData.tts_enabled !== undefined) {
                this.config.enabled = assistantData.tts_enabled;
            }
            if (assistantData.tts_voice) {
                this.config.voice = assistantData.tts_voice;
            }

            Logger.DEBUG(`TTS config loaded: enabled=${this.config.enabled}, voice=${this.config.voice}`);
        } catch (error) {
            Logger.WARN(`Failed to load assistant.json TTS config: ${error}`);
        }
    }

    public static getInstance(): TTSService {
        if (!TTSService.instance) {
            TTSService.instance = new TTSService();
        }
        return TTSService.instance;
    }

    /**
     * Initialize the TTS service with Worker Thread
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Load configuration from assistant.json
            await this.loadConfigFromAssistant();
            
            Logger.INFO(`Initializing TTS service with Worker Thread (voice: ${this.config.voice})...`);
            
            // Create worker thread for TTS processing
            const workerPath = path.join(__dirname, '../workers/tts.worker.ts');
            this.worker = new Worker(workerPath, {
                execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
            });

            // Set up worker message handling
            this.setupWorkerMessageHandling();

            // Wait for worker to be ready
            await this.waitForWorkerReady();

            // Initialize the worker with our config
            await this.initializeWorker();

            this.isInitialized = true;
            Logger.INFO('TTS service with Worker Thread initialized successfully');
        } catch (error) {
            Logger.ERROR(`Failed to initialize TTS service: ${error}`);
            if (this.worker) {
                this.worker.terminate();
                this.worker = null;
            }
            throw error;
        }
    }

    /**
     * Setup worker message handling
     */
    private setupWorkerMessageHandling(): void {
        if (!this.worker) return;

        this.worker.on('message', (message) => {
            if (message.type === 'ready') {
                this.isWorkerReady = true;
                Logger.DEBUG('TTS Worker is ready');
            } else if (message.type === 'initialized') {
                Logger.DEBUG(`TTS Worker initialized: ${message.success}`);
            } else if (message.type === 'audio') {
                this.handleAudioResponse(message.data);
            } else if (message.type === 'error') {
                Logger.ERROR(`TTS Worker error: ${message.error}`);
            }
        });

        this.worker.on('error', (error) => {
            const errorMessage = error instanceof Error ? error.message : 
                                typeof error === 'string' ? error : 
                                JSON.stringify(error, null, 2);
            Logger.ERROR(`TTS Worker error: ${errorMessage}`);
        });

        this.worker.on('exit', (code) => {
            if (code !== 0) {
                Logger.ERROR(`TTS Worker stopped with exit code ${code}`);
            }
            this.isWorkerReady = false;
        });
    }

    /**
     * Wait for worker to be ready
     */
    private waitForWorkerReady(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isWorkerReady) {
                resolve();
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('TTS Worker did not become ready in time'));
            }, 10000);

            const checkReady = () => {
                if (this.isWorkerReady) {
                    clearTimeout(timeout);
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };

            checkReady();
        });
    }

    /**
     * Initialize the worker with config
     */
    private async initializeWorker(): Promise<void> {
        if (!this.worker) throw new Error('Worker not available');

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Worker initialization timeout'));
            }, 30000);

            const messageHandler = (message: any) => {
                if (message.type === 'initialized') {
                    clearTimeout(timeout);
                    this.worker!.off('message', messageHandler);
                    if (message.success) {
                        resolve();
                    } else {
                        reject(new Error('Worker initialization failed'));
                    }
                }
            };

            this.worker!.on('message', messageHandler);
            this.worker!.postMessage({
                type: 'initialize',
                config: this.config
            });
        });
    }

    /**
     * Handle audio response from worker
     */
    private handleAudioResponse(response: any): void {
        // Check if this is an async request
        const asyncRequest = this.asyncRequests.get(response.id);
        if (asyncRequest) {
            this.asyncRequests.delete(response.id);
            
            if (response.success && response.audioBuffer) {
                const audioBuffer = Buffer.from(response.audioBuffer);
                Logger.INFO(`TTS: ✅ Async generated chunk ${asyncRequest.index} (${audioBuffer.length} bytes)`);
                emitTTSAudio(asyncRequest.sessionId, {
                    text: asyncRequest.text,
                    audio: audioBuffer,
                    index: asyncRequest.index
                });
            } else {
                Logger.WARN(`TTS: ❌ Async generation failed for chunk ${asyncRequest.index}: ${response.error || 'Unknown error'}`);
            }
            return;
        }

        // Handle regular synchronous requests
        const pendingRequest = this.pendingRequests.get(response.id);
        if (!pendingRequest) {
            Logger.WARN(`Received audio response for unknown request: ${response.id}`);
            return;
        }

        clearTimeout(pendingRequest.timeout);
        this.pendingRequests.delete(response.id);

        if (response.success && response.audioBuffer) {
            pendingRequest.resolve(Buffer.from(response.audioBuffer));
        } else {
            pendingRequest.resolve(null);
            if (response.error) {
                Logger.ERROR(`TTS generation failed: ${response.error}`);
            }
        }
    }

    /**
     * Generate TTS audio using Worker Thread - completely non-blocking
     */
    public async generateAudio(text: string): Promise<Buffer | null> {
        if (!this.isInitialized || !this.worker || !this.config.enabled) {
            Logger.DEBUG('TTS not ready: initialized=' + this.isInitialized + ', worker=' + !!this.worker + ', enabled=' + this.config.enabled);
            return null;
        }

        const requestId = randomUUID();
        Logger.DEBUG(`TTS: Sending request ${requestId} to worker`);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                Logger.WARN(`TTS request ${requestId} timed out`);
                resolve(null);
            }, this.requestTimeout);

            this.pendingRequests.set(requestId, {
                id: requestId,
                resolve,
                reject,
                timeout
            });

            this.worker!.postMessage({
                type: 'generate',
                data: {
                    id: requestId,
                    text: text,
                    config: this.config
                }
            });
        });
    }

    /**
     * Fire-and-forget TTS generation - doesn't block the caller
     * Handles audio emission internally when ready
     */
    public generateAudioAsync(text: string, index: number, sessionId: string): void {
        if (!this.isInitialized || !this.worker || !this.config.enabled) {
            Logger.DEBUG('TTS not ready for async generation');
            return;
        }

        const requestId = randomUUID();
        Logger.DEBUG(`TTS: Fire-and-forget request ${requestId} dispatched to worker`);

        // Store async request info for response handling
        this.asyncRequests.set(requestId, {
            index: index,
            sessionId: sessionId,
            text: text
        });

        // Send request to worker - no Promise returned, no blocking
        this.worker.postMessage({
            type: 'generate',
            data: {
                id: requestId,
                text: text,
                config: this.config
            }
        });

        // Clean up async request after timeout to prevent memory leaks
        setTimeout(() => {
            if (this.asyncRequests.has(requestId)) {
                Logger.WARN(`TTS: Async request ${requestId} timed out`);
                this.asyncRequests.delete(requestId);
            }
        }, this.requestTimeout);
    }



    /**
     * Get available voices
     */
    public getAvailableVoices(): string[] {
        // Based on the documentation, these are some of the available voices
        return [
            'af_heart', 'af_alloy', 'af_aoede', 'af_bella', 'af_jessica',
            'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
            'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam',
            'am_michael', 'am_onyx', 'am_puck', 'am_santa',
            'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily',
            'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'
        ];
    }

    /**
     * Update TTS configuration
     */
    public updateConfig(newConfig: Partial<TTSConfig>): void {
        this.config = { ...this.config, ...newConfig };
        Logger.INFO(`TTS configuration updated: ${JSON.stringify(this.config)}`);
    }

    /**
     * Get current configuration
     */
    public getConfig(): TTSConfig {
        return { ...this.config };
    }

    /**
     * Enable/disable TTS
     */
    public setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        Logger.INFO(`TTS ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if TTS is ready
     */
    public isReady(): boolean {
        return this.isInitialized && this.worker !== null && this.isWorkerReady && this.config.enabled;
    }


    /**
     * Save audio buffer to file (for debugging/testing)
     */
    public async saveAudioToFile(audioBuffer: Buffer, filename: string): Promise<void> {
        const filePath = path.join(process.cwd(), 'storage', 'tts', filename);
        
        // Ensure directory exists
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        
        await fs.promises.writeFile(filePath, new Uint8Array(audioBuffer));
        Logger.INFO(`Audio saved to: ${filePath}`);
    }

    /**
     * Reload TTS configuration from assistant.json
     */
    public async reloadConfig(): Promise<void> {
        try {
            await this.loadConfigFromAssistant();
            Logger.INFO('TTS configuration reloaded successfully');
        } catch (error) {
            Logger.ERROR(`Failed to reload TTS configuration: ${error}`);
            throw error;
        }
    }
}

export default TTSService;