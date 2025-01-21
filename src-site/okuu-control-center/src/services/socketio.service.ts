import { io, Socket } from 'socket.io-client';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';
import { Message } from 'src/stores/session.store';

export class SocketioService {
    private socket: Socket | any;
    private sessionId: string = '';

    constructor(sessionId: string = '') {
        this.socket = null;
        this.initializeSocket(sessionId);
    }

    private async initializeSocket(sessionId: string = ''): Promise<void> {
        const url = await resolveHostRedirect();
        this.socket = io(`https://${url}`);
        this.sessionId = sessionId;
    }

    public onConnect(callback: () => void): void {
        this.socket.on('connect', () => {
            callback();
        });
    }

    public onMessage(callback: (message: Message) => void): void {
        this.socket.on('chat', (message: any) => {
            callback(message);
        });
    }

    public sendMessage(message: Message): void {
        this.socket.emit('chat', message);
    }

    public disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}