import { io, Socket } from 'socket.io-client';
import { useConfigStore } from 'src/stores/config.store';
import { Message } from 'src/stores/session.store';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';

export enum Status {
    CONNECTED,
    DISCONNECTED,
    PINGING,
    TIMEOUT
}

export class SocketioService {
    private socket: Socket | null = null;
    private sessionId: string = '';
    private status: Status = Status.DISCONNECTED;
    private sessionStore: any;
    private mediaRecorder: MediaRecorder | null = null;
    private audioStream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    private processor: ScriptProcessorNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private isStreaming: boolean = false;

    constructor() {
        this.sessionStore = null;
    }

    public async initializeSocket(sessionId: string, sessionStore: any): Promise<Socket> {
        this.sessionStore = sessionStore;
        if (this.socket) {
            console.warn('Socket is already initialized.');
            return this.socket;
        }

        try {
            let url = await resolveHostRedirect();
            if (!url) throw new Error('Invalid URL');
            // Remove protocol from URL
            url = url.replace(/^https?:\/\//, '');

            this.socket = io(`${process.env.LOCAL ? 'ws' : 'wss' }://${url}`, {
                transports: ['websocket'],
                timeout: 30000,
                reconnectionAttempts: 3,
                reconnectionDelay: 5000,
            });

            this.socket.connect();

            console.log('Socket initialized with URL:', `${process.env.LOCAL ? 'ws' : 'wss' }://${url}`);
            this.sessionId = sessionId;
            
            console.log('Socket initialized:', this.sessionId);
            this.socket.emit("joinChat", sessionId );

            this.setupEventHandlers();

            return this.socket;
        } catch (error) {
            console.error('Socket initialization failed:', error);
            throw error;
        }
    }

    private setupEventHandlers() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('Connected to socket');
            this.updateStatus(Status.CONNECTED);
        });

        this.socket.on('chat', async (message: Message) => {
            const configStore = useConfigStore();
            await configStore.fetchOkuuPfp();
            message.avatar = configStore.okuuPfp;
            console.log('Received chat message:', message);
            if (message.stream) {
                if (!this.sessionStore.hasMessageInSession(message.memoryKey)) {
                    this.sessionStore.addMessageToSession(message);
                } else {
                    this.sessionStore.updateMessageInSession(message.memoryKey, message.message, message.done);
                }
            } else {
                this.sessionStore.addMessageToSession(message);
            }
        });

        this.socket.on('disconnect', (reason) => {
            if (reason === 'ping timeout') {
                console.warn('Disconnected due to ping timeout');
                this.status = Status.TIMEOUT;
            } else {
                console.warn(`Disconnected: ${reason}`);
            }
            this.updateStatus(Status.DISCONNECTED);
        });

        this.socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
        });
    }

    private updateStatus(status: Status) {
        this.status = status;
        //console.log('Socket status:', this.status);
    }

    public getStatus(): Status {
        return this.status;
    }

    public getSocket(): Socket {
        if (!this.socket) {
            throw new Error('Socket has not been initialized. Call initializeSocket() first.');
        }
        return this.socket;
    }

    public disconnectSocket(): void {
        if (this.socket) {
            this.socket.disconnect();
            console.log('Socket disconnected');
        }
    }

    public retryConnection(): void {
        if (this.socket) {
            this.socket.connect();
        }
    }

    public async startAudioStream(socket: Socket, onError?: (msg: string) => void, onStop?: () => void) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            onError?.('Your browser does not support audio input.');
            onStop?.();
            return;
        }
        
        try {
            // Signal the backend to start whisper processing
            socket.emit('mic');
            console.log('Signaled backend to start whisper transcription');
            
            // Get microphone access with explicit constraints
            this.audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,   // Mono audio
                    echoCancellation: false, // Disable for better raw audio
                    noiseSuppression: false, // Disable for better raw audio
                    autoGainControl: false   // Disable for consistent levels
                } 
            });
            
            // Check if we got audio tracks
            const audioTracks = this.audioStream.getAudioTracks();
            console.log('Audio tracks:', audioTracks.length);
            if (audioTracks.length > 0) {
                const track = audioTracks[0];
                if (track) {
                    console.log('Audio track settings:', track.getSettings());
                    console.log('Audio track constraints:', track.getConstraints());
                }
            }
            
            // Set up audio processing
            await this.setupAudioProcessing(socket);
            this.isStreaming = true;
            
            console.log('Audio streaming started - data will be sent in real-time');
            
            // Continuous streaming - no auto-timeout, let user control when to stop

        } catch (err) {
            console.error('Error starting audio stream:', err);
            onError?.('Error accessing microphone. Please check permissions.');
            onStop?.();
        }
    }

    private async setupAudioProcessing(socket: Socket) {
        if (!this.audioStream) return;

        // Create audio context with default sample rate (let browser decide)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
        
        console.log('AudioContext sample rate:', this.audioContext.sampleRate);
        
        // Create source from microphone stream
        this.source = this.audioContext.createMediaStreamSource(this.audioStream);
        
        // Create processor for audio data
        const bufferSize = 4096; // Process in chunks
        this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        let chunkCounter = 0;
        
        this.processor.onaudioprocess = (event) => {
            if (!this.isStreaming) return;
            
            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0); // Mono channel
            
            // Check if we're actually getting audio data
            const hasAudio = inputData.some(sample => Math.abs(sample) > 0.001);
            
            // Log less frequently to reduce console spam
            if (chunkCounter % 200 === 0) { // Log every 200 chunks (~8 seconds at 4096 buffer)
                console.log('Audio chunk:', chunkCounter, 'Has audio:', hasAudio, 'Max amplitude:', Math.max(...Array.from(inputData).map(Math.abs)));
            }
            chunkCounter++;
            
            // Only send audio data if there's actual sound to reduce backend load
            if (hasAudio) {
                // Downsample from browser's native rate to 16kHz if needed
                const downsampledData = this.downsampleTo16kHz(inputData, this.audioContext!.sampleRate);
                
                // Convert Float32Array to Int16Array for better compression
                const pcmData = this.float32ToInt16(downsampledData);
                
                // Send audio data to backend in real-time
                socket.emit('audio_data', {
                    data: Array.from(pcmData), // Convert to regular array for JSON serialization
                    sampleRate: 16000 // Tell backend the target sample rate
                });
            }
        };
        
        // Connect the audio processing chain
        this.source.connect(this.processor);
        // Don't connect to destination - we don't want to hear ourselves
        // this.processor.connect(this.audioContext.destination);
    }

    private downsampleTo16kHz(inputData: Float32Array, sourceSampleRate: number): Float32Array {
        if (sourceSampleRate === 16000) {
            return inputData; // No downsampling needed
        }
        
        const ratio = sourceSampleRate / 16000;
        const outputLength = Math.floor(inputData.length / ratio);
        const outputData = new Float32Array(outputLength);
        
        for (let i = 0; i < outputLength; i++) {
            const sourceIndex = Math.floor(i * ratio);
            outputData[i] = inputData[sourceIndex] || 0;
        }
        
        return outputData;
    }

    private float32ToInt16(float32Array: Float32Array): Int16Array {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            // Clamp to [-1, 1] and convert to 16-bit signed integer
            const sample = Math.max(-1, Math.min(1, float32Array[i] || 0));
            int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        return int16Array;
    }

    public stopAudioStream(manual = false) {
        this.isStreaming = false;
        
        // Signal backend to stop
        if (this.socket) {
            this.socket.emit('mic_end', { manual });
        }
        
        // Cleanup audio processing chain
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close().catch(console.error);
            this.audioContext = null;
        }
        
        // Stop microphone stream
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        console.log('Stopped audio stream and signaled backend');
    }
}