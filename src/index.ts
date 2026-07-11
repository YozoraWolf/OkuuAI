import express, { Application, NextFunction, Request, Response } from 'express';
import path from 'path';
import http from 'http';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import dotenv from 'dotenv';
import { init } from './init';
import { Logger } from './logger';
import { initConsole } from './console';
import { initTauri } from './gui';
import memoryRoutes from './routes/memory.route';
import guiRoutes from './routes/gui.route';
import configRoutes from './routes/config.route';
import { requireAuth } from './middleware/auth.middleware';
import { setupSockets } from './sockets';
import mainRoutes, { apiLimiter } from './routes/main.route';
import { Server } from 'socket.io';
import userRoutes from './routes/user.route';
import toolsRoutes from './routes/tools.route';
import setupRoutes from './routes/setup.route';
import { getSetupState } from './setup';
import { setupEvents } from './setup-events';

export let io: Server;
let server: http.Server;
let runtimeStarted = false;
let currentPort = '';

const initializeOptionalServices = async () => {
    if (process.env.DISCORD_TOKEN) {
        try {
            const { discordManager } = await import('./sns/discord');
            await discordManager.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            Logger.ERROR(`Failed to initialize Discord: ${error}`);
        }
    } else {
        Logger.WARN('No DISCORD_TOKEN found, skipping Discord initialization.');
    }
};

const bindServer = (port: string | number, setupMode: boolean) => {
    const nextPort = port.toString();
    const listen = () => {
        server.listen(nextPort, async () => {
            currentPort = nextPort;
            Logger.INFO(`Server is running on port ${nextPort} ${/09$/.test(nextPort) ? '(☢️)' : ''}`);

            if (setupMode) {
                Logger.WARN('Setup mode enabled. Complete setup in the Control Center. OkuuAI will apply the new values automatically.');
                return;
            }

            if (!runtimeStarted) {
                runtimeStarted = true;
                await initConsole();
            }
        });
    };

    if (server.listening) {
        server.close(listen);
    } else {
        listen();
    }
};

const applyCompletedSetup = async () => {
    try {
        Logger.INFO('Applying setup configuration...');
        dotenv.config({ override: true });
        await init();
        if (getSetupState().setupRequired) {
            Logger.WARN('Setup is still incomplete after apply attempt.');
            return;
        }

        await initializeOptionalServices();
        if (currentPort && currentPort !== (process.env.PORT || 3000).toString()) {
            Logger.WARN(`Configured PORT=${process.env.PORT} will be used on next start. Keeping current port ${currentPort} active for this session.`);
        } else {
            bindServer(process.env.PORT || 3000, false);
        }
        Logger.INFO('Setup configuration applied successfully.');
    } catch (error) {
        Logger.ERROR(`Failed to apply setup configuration: ${error}`);
    }
};

(async () => {
    try {
        await init();
        const setupState = getSetupState();

        // Initialize Discord
        if (!setupState.setupRequired) {
            await initializeOptionalServices();
        }

        const app: Application = express();
        const port = process.env.PORT || 3000;
        server = http.createServer(app); // Create HTTP server

        // Websockets
        io = setupSockets(server);

        // Use JWT-based middleware to protect internal routes.
        // For legacy API-key checks there's a /apiKey endpoint in main.route.

        // Trust the reverse proxy
        app.set('trust proxy', 1);

        app.use(cors({
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'ngrok-skip-browser-warning'], // Allow 'x-api-key' header
        }));

        app.use(apiLimiter); // Apply rate limiter

        // File upload middleware
        app.use(fileUpload({
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
            useTempFiles: false,
            debug: false,
        }));

        // REST API routes
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));  // Parse form-urlencoded data
        // Serve simple public assets
        app.use('/public', express.static(path.join(__dirname, 'public')));
        // Frontend (Quasar) lives in `src-site/okuu-control-center`. In dev it runs separately
        // and exposes `/login`. In production, serve the built frontend under `/okuu-control-center`.
        app.use('/', mainRoutes);
        app.use('/setup', setupRoutes);
        app.use('/gui', requireAuth, guiRoutes);
        app.use('/memory', requireAuth, memoryRoutes);
        // Mount user routes without API key so register/login remain public;
        // internal CRUD endpoints are protected by JWT middleware inside the route.
        app.use('/users', userRoutes);
        app.use('/config', requireAuth, configRoutes);
        app.use('/tools', requireAuth, toolsRoutes);

        setupEvents.on('completed', () => {
            void applyCompletedSetup();
        });

        bindServer(port, setupState.setupRequired);
    } catch (error) {
        console.error('Fatal error during initialization:', error);
        process.exit(1);
    }
})();
