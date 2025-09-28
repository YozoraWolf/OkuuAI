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
            const url = await resolveHostRedirect();
            if (!url) throw new Error('Invalid URL');

            this.socket = io(url, {
                transports: ['websocket'],
                timeout: 30000,
                reconnectionAttempts: 3,
                reconnectionDelay: 5000,
            });

            this.socket.connect();

            console.log('🔍 Socket initialized with URL:', url);
            this.sessionId = sessionId;
            
            console.log('🔍 Socket initialized for session:', this.sessionId);
            
            // Wait for connection before joining chat
            this.socket.on('connect', () => {
                console.log('🔍 Emitting joinChat for session:', sessionId);
                this.socket?.emit("joinChat", sessionId);
            });
            
            // If already connected, emit immediately
            if (this.socket.connected) {
                console.log('🔍 Socket already connected, emitting joinChat immediately');
                this.socket.emit("joinChat", sessionId);
            }

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
            console.log('✅ Socket connected successfully - ID:', this.socket?.id, 'Transport:', this.socket?.io.engine.transport.name);
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
            
            // For streaming messages
            if (message.stream) {
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
                    message.done
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
            console.error('❌ Socket connection error:', err);
        });

        this.socket.on('disconnect', (reason) => {
            console.warn('🔌 Socket disconnected:', reason);
        });

        // TTS event handlers - forward to sessionStore for component handling
        this.socket.on('ttsAudio', (audioData: any) => {
            console.log('🔊 SocketioService received TTS audio chunk:', {
                index: audioData.index,
                audioLength: audioData.audio?.length || 0,
                socketConnected: this.socket?.connected,
                socketId: this.socket?.id
            });
            // Emit a custom event that components can listen to
            if (this.sessionStore && typeof this.sessionStore.handleTTSAudio === 'function') {
                this.sessionStore.handleTTSAudio(audioData);
            }
            // Also emit on window for components to catch
            window.dispatchEvent(new CustomEvent('ttsAudio', { detail: audioData }));
        });

        this.socket.on('ttsSettings', (settings: any) => {
            console.log('🔊 TTS settings received:', settings);
            window.dispatchEvent(new CustomEvent('ttsSettings', { detail: settings }));
        });

        this.socket.on('ttsSettingsUpdated', (settings: any) => {
            console.log('🔊 TTS settings updated:', settings);
            window.dispatchEvent(new CustomEvent('ttsSettingsUpdated', { detail: settings }));
        });

        this.socket.on('joinedChat', (data: any) => {
            console.log('🔊 Successfully joined chat room:', data);
            console.log('🔍 Frontend thinks it\'s in session:', this.sessionId);
            console.log('🔍 Backend confirmed session:', data.sessionId);
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