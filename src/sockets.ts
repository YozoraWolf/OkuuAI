import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { Core } from "./core";
import { SESSION_ID, startSession } from "./langchain/memory/memory";
import { Logger } from "./logger";
import { handleUserInput } from "./console";

let io: Server;


export const setupSockets = (server: HTTPServer) => {
    io = new Server(server);

    io.on('connection', (socket) => {
        console.log('A client connected');
    
        socket.on('chat', async (data: any) => {
            console.log('Received chat message:', data);
            Core.chat_session = await startSession(data.sessionId);
            //Logger.DEBUG(`Session ID: ${SESSION_ID}`);
            Logger.DEBUG(`Data: ${JSON.stringify(data)}`);
            Logger.DEBUG(`New session started: ${SESSION_ID}`);
            await handleUserInput(data.content, data);
        });
    
        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });

        socket.on('pong', () => {
            //console.log('Pong received');
            socket.emit('ping', {});
        });

        console.log('A client connected');
        setInterval(() => {
            socket.emit('ping', {});
        }, 5000);

    });
    Logger.INFO('Socket server initialized');

    return io;
};