import express, { Application, NextFunction, Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import { init } from './init';
import { Logger } from './logger';
import { initConsole } from './console';
import { initTauri } from './gui';
import memoryRoutes from './routes/memoryRoutes';
import guiRoutes from './routes/guiRoutes';
import { setupSockets } from './sockets';
import mainRoutes from './routes/mainRoutes';
import { Server } from 'socket.io';
import userRoutes from './routes/userRoutes';


export let io: Server;

(async () => {



    await init();

    const app: Application = express();
    const port = process.env.PORT || 3000;
    const server = http.createServer(app); // Create HTTP server
    
    // Websockets
    io = setupSockets(server);

    // Middleware to check the API key
    const checkApiKey = (req: Request, res: Response, next: NextFunction) => {
        const apiKey = req.headers['x-api-key'] as string | undefined;

        if (apiKey && apiKey === process.env.API_KEY) {
            next(); // API key is valid, proceed
        } else {
            res.status(401).json({ message: 'Unauthorized' });
        }
    };

    app.use(cors(
        {
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'], // Allow 'x-api-key' header
        }
    ));

    // REST API routes
    app.use(express.json());
    app.use('/', mainRoutes);
    app.use('/gui', checkApiKey, guiRoutes);
    app.use('/memory', checkApiKey, memoryRoutes);
    app.use('/users', checkApiKey, userRoutes);



    server.listen(port, async () => {
        Logger.INFO(`Server is running on port ${port} ${/09$/.test(port.toString()) ? '(☢️)' : ''}`);


        // init gui
        // initTauri();
        // Start console
        await initConsole();
    });
})();