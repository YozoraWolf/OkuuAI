import { Store } from 'pinia';
import { io, Socket } from 'socket.io-client';
import { useConfigStore } from 'src/stores/config.store';
import { Message, useSessionStore } from 'src/stores/session.store';
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
    private lastPing = 0;

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
            this.socket = io(`wss://${url}`, {
                transports: ['websocket'],
                timeout: 30000,
                reconnectionAttempts: 3,
                reconnectionDelay: 1000,
            });
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
            this.lastPing = Date.now();
            this.updateStatus(Status.CONNECTED);
        });

        this.socket.on('chat', async (message: Message) => {
            const configStore = useConfigStore();
            await configStore.fetchOkuuPfp();
            message.avatar = configStore.okuuPfp;
            console.log('Received chat message:', message);
            this.sessionStore.addMessageToSession(message);
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



        this.socket.on('ping', () => {
            //console.log('Ping received');
            this.lastPing = Date.now();
        });

        this.socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
        });

        this.socket.on('disconnect', (reason) => {
            console.warn(`Disconnected: ${reason}`);
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