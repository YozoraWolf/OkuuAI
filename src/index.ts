import express, { Application } from 'express';
import http from 'http'; // Import http module
import { init } from './init';
import { Logger } from './logger';
import guiRoutes from './routes/guiRoute';
import { handleUserInput, initConsole } from './console';
import { Server } from 'socket.io';
import cors from 'cors';
import { initTauri } from './gui';

export let io: Server;

(async () => {
    await init();

    const app: Application = express();
    const port = process.env.PORT || 3000;
    const server = http.createServer(app); // Create HTTP server
    io = new Server(server); // Create Socket.io server

    app.use('/gui', guiRoutes);
    app.use(cors());

    app.get('/chat', () => {
        // Handle the '/chat' route here
    });

    io.on('connection', (socket) => {
        console.log('A client connected');

        socket.on('chat', async (data: any) => {
            console.log('Received chat message:', data);
            await handleUserInput(data.content);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });
    });

    server.listen(port, async () => {
        Logger.INFO(`Server is running on port ${port} ${/09$/.test(port.toString()) ? '(☢️)' : ''}`);


        // init gui
        initTauri();
        // Start console
        await initConsole();
    });
})();