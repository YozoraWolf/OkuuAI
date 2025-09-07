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
            this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.audioStream);
            this.mediaRecorder.start(250);

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0 && socket) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const arrayBuffer = reader.result as ArrayBuffer;
                        const uint8Array = new Uint8Array(arrayBuffer);
                        // Send mimeType with each chunk
                        socket.emit('mic', { data: uint8Array, mimeType: e.data.type });
                    };
                    reader.readAsArrayBuffer(e.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                if (socket) {
                    socket.emit('mic_end', { manual: false });
                }
                if (this.audioStream) {
                    this.audioStream.getTracks().forEach(track => track.stop());
                    this.audioStream = null;
                }
                onStop?.();
            };

            // Stop after 60 seconds
            setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                    this.mediaRecorder.stop();
                }
            }, 60000);

        } catch (err) {
            onError?.('Error accessing microphone.');
            if (this.audioStream) {
                this.audioStream.getTracks().forEach(track => track.stop());
                this.audioStream = null;
            }
            onStop?.();
        }
    }

    public stopAudioStream(manual = false) {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            if (this.socket) {
                this.socket.emit('mic_end', { manual });
            }
            this.mediaRecorder.stop();
        }
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
    }
}