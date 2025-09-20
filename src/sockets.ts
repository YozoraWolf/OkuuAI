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

        socket.on('joinChat', (sessionId: string) => {
            Logger.DEBUG('Joining chat: '+sessionId);
            socket.join(sessionId);
        });

                // Handle chat messages
        socket.on('chat', async (data: any) => {
            try {
                if (!data || !data.sessionId || !data.message) {
                    Logger.ERROR('Invalid chat data received: '+data);
                    socket.emit('error', { message: 'Invalid data format' });
                    return;
                }

                Logger.DEBUG(`Received chat message: ${JSON.stringify(data)}`);
                Core.chat_session = await startSession(data.sessionId);
                Logger.DEBUG(`Session started: ${SESSION_ID}`);
                await handleUserInput(data.message, data);

                //socket.emit('chat', { success: true });
            } catch (err) {
                Logger.ERROR('Error processing chat message: '+err);
                socket.emit('error', { message: 'Internal server error' });
            }
        });

        // Handle stop generation signal
        socket.on('stopGeneration', (data: { sessionId: string }) => {
            try {
                if (!data || !data.sessionId) {
                    Logger.ERROR('Invalid stop generation data received');
                    return;
                }
                Logger.DEBUG(`Received stop generation signal for session: ${data.sessionId}`);
                
                // Set flag to prevent generation from starting if it hasn't started yet
                Core.shouldStopGeneration = true;
                
                // Use Ollama's built-in abort method to stop all streaming generations
                Core.ollama_instance.abort();
                Logger.INFO('Generation aborted successfully');
            } catch (err) {
                Logger.ERROR('Error processing stop generation signal: '+err);
            }
        });

        // Handle stop generation signal
        socket.on('stopGeneration', (data: { sessionId: string }) => {
            try {
                if (!data || !data.sessionId) {
                    Logger.ERROR('Invalid stop generation data received');
                    return;
                }
                Logger.DEBUG(`Received stop generation signal for session: ${data.sessionId}`);
                //socket.emit('chat', { success: true });
            } catch (err) {
                Logger.ERROR('Error processing chat message: '+err);
                socket.emit('error', { message: 'Internal server error' });
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            Logger.INFO('Client disconnected: '+socket.id);
        });
    });

    Logger.INFO('Socket server initialized');

    return io;
};
