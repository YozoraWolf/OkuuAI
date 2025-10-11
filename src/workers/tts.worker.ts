import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';

// Use require to avoid TypeScript compilation issues with kokoro-js
let KokoroTTS: any = null;

// Initialize KokoroTTS using require
function initializeKokoro(): any {
    if (!KokoroTTS) {
        try {
            // Use require to avoid TypeScript module resolution issues
            const kokoroModule = (require as any)('kokoro-js');
            KokoroTTS = kokoroModule.KokoroTTS;
            console.log('TTS Worker: kokoro-js loaded successfully');
        } catch (error) {
            console.error('TTS Worker: Failed to load kokoro-js:', error);
            throw error;
        }
    }
    return KokoroTTS;
}

interface TTSConfig {
    voice: string;
    enabled: boolean;
    model_id: string;
    dtype: "fp32" | "fp16" | "q8" | "q4" | "q4f16";
    device: "cpu";
}

interface TTSRequest {
    id: string;
    text: string;
    config: TTSConfig;
}

interface TTSResponse {
    id: string;
    success: boolean;
    audioBuffer?: Buffer;
    error?: string;
}

class TTSWorker {
    private tts: any | null = null;
    private isInitialized = false;
    private currentConfig: TTSConfig | null = null;

    constructor() {
        this.initializeWorker();
    }

    private async initializeWorker() {
        if (!parentPort) {
            console.error('TTS Worker: No parent port available');
            return;
        }

        parentPort.on('message', async (message) => {
            try {
                if (message.type === 'initialize') {
                    await this.initialize(message.config);
                    parentPort!.postMessage({ 
                        type: 'initialized', 
                        success: this.isInitialized 
                    });
                } else if (message.type === 'generate') {
                    const response = await this.generateAudio(message.data);
                    parentPort!.postMessage({ 
                        type: 'audio', 
                        data: response 
                    });
                }
            } catch (error) {
                parentPort!.postMessage({ 
                    type: 'error', 
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });

        parentPort.postMessage({ type: 'ready' });
    }

    private async initialize(config: TTSConfig): Promise<void> {
        if (this.isInitialized && this.currentConfig && 
            JSON.stringify(this.currentConfig) === JSON.stringify(config)) {
            return; // Already initialized with same config
        }

        try {
            console.log(`TTS Worker: Initializing with model ${config.model_id}, voice: ${config.voice}`);
            
            // Initialize kokoro
            const TTS = initializeKokoro();
            
            this.tts = await TTS.from_pretrained(config.model_id, {
                dtype: config.dtype,
                device: config.device,
            });

            this.currentConfig = config;
            this.isInitialized = true;
            console.log('TTS Worker: Initialization complete');
        } catch (error) {
            console.error(`TTS Worker: Failed to initialize: ${error}`);
            this.isInitialized = false;
            throw error;
        }
    }

    private async generateAudio(request: TTSRequest): Promise<TTSResponse> {
        if (!this.isInitialized || !this.tts) {
            return {
                id: request.id,
                success: false,
                error: 'TTS not initialized'
            };
        }

        try {
            // Clean the text for TTS - remove roleplay markers and excessive whitespace
            const cleanText = request.text
                .replace(/\*[^*]*\*/g, '') // Remove text between asterisks (roleplay actions)
                .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                .trim();
            
            if (!cleanText) {
                return {
                    id: request.id,
                    success: false,
                    error: 'No speakable text after cleaning'
                };
            }
            
            console.log(`TTS Worker: Generating audio for: "${cleanText}"`);
            
            const audio = await this.tts.generate(cleanText, {
                voice: request.config.voice,
            });

            // Extract PCM audio data and create a proper WAV file
            let pcmData: Float32Array | null = null;
            let sampleRate = 24000; // Default sample rate for Kokoro

            if (audio.audio) {
                pcmData = audio.audio;
                sampleRate = audio.sampling_rate || 24000;
            } else if (audio.data) {
                pcmData = audio.data;
                sampleRate = audio.sampling_rate || 24000;
            } else {
                return {
                    id: request.id,
                    success: false,
                    error: 'No audio data found in response'
                };
            }

            if (!pcmData || pcmData.length === 0) {
                return {
                    id: request.id,
                    success: false,
                    error: 'Empty audio data'
                };
            }

            // Convert Float32Array PCM to 16-bit PCM and create WAV file
            const audioBuffer = this.createWavFile(pcmData, sampleRate);

            console.log(`TTS Worker: Generated ${audioBuffer.length} bytes of audio`);

            return {
                id: request.id,
                success: true,
                audioBuffer: audioBuffer
            };

        } catch (error) {
            console.error(`TTS Worker: Generation error: ${error}`);
            return {
                id: request.id,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Create a WAV file from Float32Array PCM data
     */
    private createWavFile(pcmData: Float32Array, sampleRate: number): Buffer {
        // Convert Float32Array to 16-bit PCM
        const pcm16 = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            // Clamp to [-1, 1] and convert to 16-bit
            const sample = Math.max(-1, Math.min(1, pcmData[i]));
            pcm16[i] = Math.round(sample * 32767);
        }

        const pcmBuffer = Buffer.from(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
        const wavHeader = this.createWavHeader(pcmBuffer.length, sampleRate);
        
        return Buffer.concat([wavHeader, pcmBuffer]);
    }

    /**
     * Create WAV file header
     */
    private createWavHeader(dataLength: number, sampleRate: number): Buffer {
        const header = Buffer.alloc(44);
        
        // RIFF header
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataLength, 4);
        header.write('WAVE', 8);
        
        // fmt chunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // chunk size
        header.writeUInt16LE(1, 20); // audio format (PCM)
        header.writeUInt16LE(1, 22); // num channels (mono)
        header.writeUInt32LE(sampleRate, 24); // sample rate
        header.writeUInt32LE(sampleRate * 2, 28); // byte rate (sample rate * channels * bytes per sample)
        header.writeUInt16LE(2, 32); // block align (channels * bytes per sample)
        header.writeUInt16LE(16, 34); // bits per sample
        
        // data chunk
        header.write('data', 36);
        header.writeUInt32LE(dataLength, 40);
        
        return header;
    }
}

// Start the worker
new TTSWorker();