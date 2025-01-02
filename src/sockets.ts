import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { Core } from "./core";
import { SESSION_ID, startSession } from "./langchain/memory/memory";
import { Logger } from "./logger";
import { handleUserInput } from "./console";

let io: Server;

export const setupSockets = (server: HTTPServer) => {
    io = new Server(server, {
        pingInterval: 10000,
        pingTimeout: 5000,
    }
    );

    io.on('connection', (socket) => {
        Logger.INFO('A client connected: '+socket.id);

        // Handle chat messages
        socket.on('chat', async (data: any) => {
            try {
                if (!data || !data.sessionId || !data.content) {
                    Logger.ERROR('Invalid chat data received: '+data);
                    socket.emit('error', { message: 'Invalid data format' });
                    return;
                }

                Logger.DEBUG(`Received chat message: ${JSON.stringify(data)}`);
                Core.chat_session = await startSession(data.sessionId);
                Logger.DEBUG(`Session started: ${SESSION_ID}`);
                await handleUserInput(data.content, data);

                socket.emit('chat-response', { success: true });
            } catch (err) {
                Logger.ERROR('Error processing chat message: '+err);
                socket.emit('error', { message: 'Internal server error' });
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            Logger.INFO('Client disconnected: '+socket.id);
        });

        // Custom ping-pong mechanism
        setInterval(() => {
            socket.emit('ping', {});
        }, 5000);

        socket.on('pong', () => {
            Logger.DEBUG('Pong received from client: '+socket.id);
        });
    });

    Logger.INFO('Socket server initialized');

    return io;
};
