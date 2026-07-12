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

            const protocol = process.env.LOCAL ? 'ws' : window.location.protocol === 'https:' ? 'wss' : 'ws';
            this.socket = io(`${protocol}://${url}`, {
                transports: ['websocket'],
                timeout: 30000,
                reconnectionAttempts: 3,
                reconnectionDelay: 5000,
            });

            this.socket.connect();

            console.log('Socket initialized with URL:', `${protocol}://${url}`);
            this.sessionId = sessionId;

            console.log('Socket initialized:', this.sessionId);
            this.socket.emit("joinChat", sessionId);

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
            console.log('🔵 Socket received message:', {
                memoryKey: message.memoryKey,
                messageLength: message.message?.length || 0,
                isStreaming: message.stream,
                isDone: message.done
            });

            const configStore = useConfigStore();
            message.avatar = configStore.okuuPfp;

            // Only Okuu's reply is streamed. The user's echoed message carries the
            // stream preference too, but must be merged as a regular message.
            if (message.stream && /^okuu/i.test(message.user)) {
                const hasExisting = this.sessionStore.hasMessageInSession(message.memoryKey);
                console.log('🔵 Stream message check:', {
                    hasExisting,
                    memoryKey: message.memoryKey
                });

                // For the first chunk
                if (!hasExisting) {
                    const initialMessage = {
                        ...message,
                        message: message.message || '',
                        done: false
                    };
                    console.log('🔵 Adding first chunk:', {
                        memoryKey: initialMessage.memoryKey,
                        messageLength: initialMessage.message.length,
                        done: initialMessage.done
                    });
                    this.sessionStore.addMessageToSession(initialMessage);
                }

                // Always update with new content
                console.log('🔵 Updating with new chunk:', {
                    memoryKey: message.memoryKey,
                    messageLength: message.message?.length || 0,
                    done: message.done
                });
                this.sessionStore.updateMessageInSession(
                    message.memoryKey,
                    message.message || '',
                    message.done,
                    message.metadata
                );
            } else {
                // Non-streaming messages
                console.log('🔵 Adding non-stream message');
                this.sessionStore.addMessageToSession(message);
            }
        });

        this.socket.on('generationStarted', () => {
            console.log('🔵 AI generation started');
            this.sessionStore.setIsGenerating(true);
        });

        this.socket.on('generationEnded', () => {
            console.log('🔵 AI generation ended');
            this.sessionStore.setIsGenerating(false);
            this.sessionStore.isStreaming = false;
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
}
