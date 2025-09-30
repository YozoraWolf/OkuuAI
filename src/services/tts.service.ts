// @ts-ignore - kokoro-js types may not be fully compatible
import { KokoroTTS, TextSplitterStream } from 'kokoro-js';
import { Logger } from '@src/logger';
import fs from 'fs';
import path from 'path';

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

export class TTSService {
    private static instance: TTSService;
    private tts: KokoroTTS | null = null;
    private isInitialized = false;
    private config: TTSConfig = {
        voice: 'af_sarah', // Will be loaded from assistant.json
        enabled: true,
        model_id: 'onnx-community/Kokoro-82M-v1.0-ONNX',
        dtype: 'q8', // Good balance of quality and performance
        device: 'cpu'
    };
    private concurrentGenerations = 0;
    private maxConcurrentGenerations = 3; // Limit to prevent overwhelming the system

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
     * Initialize the TTS service with the Kokoro model
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Load configuration from assistant.json
            await this.loadConfigFromAssistant();
            
            Logger.INFO(`Initializing TTS service with Kokoro model (voice: ${this.config.voice})...`);
            
            this.tts = await KokoroTTS.from_pretrained(this.config.model_id, {
                dtype: this.config.dtype,
                device: this.config.device,
            });

            this.isInitialized = true;
            Logger.INFO('TTS service initialized successfully');
        } catch (error) {
            Logger.ERROR(`Failed to initialize TTS service: ${error}`);
            throw error;
        }
    }

    /**
     * Generate TTS audio for a given text
     */
    public async generateAudio(text: string): Promise<Buffer | null> {
        if (!this.isInitialized || !this.tts || !this.config.enabled) {
            Logger.DEBUG('TTS not ready: initialized=' + this.isInitialized + ', tts=' + !!this.tts + ', enabled=' + this.config.enabled);
            return null;
        }
        
        // Check concurrency limit
        if (this.concurrentGenerations >= this.maxConcurrentGenerations) {
            Logger.DEBUG(`TTS: Skipping generation, too many concurrent requests (${this.concurrentGenerations}/${this.maxConcurrentGenerations})`);
            return null;
        }

        // Track concurrent generation
        this.concurrentGenerations++;
        Logger.DEBUG(`TTS: Starting generation (${this.concurrentGenerations}/${this.maxConcurrentGenerations} active)`);
        
        try {
            // Clean the text for TTS - remove roleplay markers and excessive whitespace
            const cleanText = text
                .replace(/\*[^*]*\*/g, '') // Remove text between asterisks (roleplay actions)
                .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                .trim();
            
            if (!cleanText) {
                Logger.DEBUG('TTS: No speakable text after cleaning');
                this.concurrentGenerations--;
                return null;
            }
            
            Logger.DEBUG(`TTS: Original text: "${text}"`);
            Logger.DEBUG(`TTS: Cleaned text: "${cleanText}"`);
            
            const audio = await this.tts.generate(cleanText, {
                voice: this.config.voice,
            });

            Logger.DEBUG(`TTS: Generated audio (${typeof audio})`);

            // Extract PCM audio data and create a proper WAV file
            let pcmData: Float32Array | null = null;
            let sampleRate = 24000; // Default sample rate for Kokoro

            if (audio.audio) {
                pcmData = audio.audio;
                sampleRate = audio.sampling_rate || 24000;
                Logger.DEBUG(`TTS: Using audio.audio, ${pcmData ? pcmData.length : 0} samples @ ${sampleRate}Hz`);
            } else if (audio.data) {
                pcmData = audio.data;
                sampleRate = audio.sampling_rate || 24000;
                Logger.DEBUG(`TTS: Using audio.data, ${pcmData ? pcmData.length : 0} samples @ ${sampleRate}Hz`);
            } else {
                Logger.WARN(`TTS: No audio data found in response`);
                return null;
            }

            if (!pcmData || pcmData.length === 0) {
                Logger.WARN(`TTS: Empty audio data`);
                return null;
            }

            // Convert Float32Array PCM to 16-bit PCM and create WAV file
            const audioBuffer = this.createWavFile(pcmData, sampleRate);


            return audioBuffer;
        } catch (error) {
            Logger.ERROR(`Failed to generate TTS audio: ${error}`);
            return null;
        } finally {
            this.concurrentGenerations--;
            Logger.DEBUG(`TTS: Finished generation (${this.concurrentGenerations}/${this.maxConcurrentGenerations} active)`);
        }
    }

    /**
     * Generate TTS audio with no voice parameter (use kokoro default)
     */
    public async generateAudioNoVoice(text: string): Promise<Buffer | null> {
        if (!this.isInitialized || !this.tts || !this.config.enabled) {
            Logger.DEBUG('TTS not ready: initialized=' + this.isInitialized + ', tts=' + !!this.tts + ', enabled=' + this.config.enabled);
            return null;
        }

        try {
            const cleanText = text
                .replace(/\*[^*]*\*/g, '') // Remove text between asterisks (roleplay actions)
                .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                .trim();
            
            if (!cleanText) {
                Logger.DEBUG('TTS: No speakable text after cleaning');
                return null;
            }
            
            Logger.DEBUG(`TTS (no voice): Original text: "${text}"`);
            Logger.DEBUG(`TTS (no voice): Cleaned text: "${cleanText}"`);
            
            // Generate audio without voice parameter
            const audio = await this.tts.generate(cleanText);

            Logger.DEBUG(`TTS (no voice): Generated audio object type: ${typeof audio}`);
            Logger.DEBUG(`TTS (no voice): Audio properties: ${JSON.stringify(Object.keys(audio))}`);

            let audioBuffer: Buffer | null = null;

            if (audio.data) {
                audioBuffer = Buffer.from(audio.data);
                Logger.DEBUG(`TTS (no voice): Using audio.data, buffer size: ${audioBuffer.length}`);
            } else if (audio.audio) {
                audioBuffer = Buffer.from(audio.audio);
                Logger.DEBUG(`TTS (no voice): Using audio.audio, buffer size: ${audioBuffer.length}`);
            } else {
                Logger.WARN(`TTS (no voice): Unknown audio format`);
                return null;
            }

            return audioBuffer;
        } catch (error) {
            Logger.ERROR(`Failed to generate TTS audio (no voice): ${error}`);
            return null;
        }
    }

    /**
     * Stream TTS audio generation for real-time text processing
     */
    public async* streamAudio(textStream: AsyncIterable<string>): AsyncGenerator<TTSChunk> {
        if (!this.isInitialized || !this.tts || !this.config.enabled) {
            return;
        }

        try {
            const splitter = new TextSplitterStream();
            const stream = this.tts.stream(splitter);
            
            let chunkIndex = 0;

            // Feed text to the splitter in a separate promise
            const textProcessor = (async () => {
                for await (const textChunk of textStream) {
                    // Split text into words for better streaming
                    const tokens = textChunk.match(/\s*\S+/g) || [];
                    for (const token of tokens) {
                        splitter.push(token);
                        // Small delay to allow for better streaming experience
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                }
                splitter.close();
            })();

            // Start text processing
            textProcessor.catch(error => {
                Logger.ERROR(`Error in text processing: ${error}`);
            });

            // Yield audio chunks as they become available
            for await (const { text, phonemes, audio } of stream) {
                yield {
                    text,
                    phonemes,
                    audio: audio.data,
                    index: chunkIndex++
                };
            }

        } catch (error) {
            Logger.ERROR(`Failed to stream TTS audio: ${error}`);
        }
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
        return this.isInitialized && this.tts !== null && this.config.enabled;
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