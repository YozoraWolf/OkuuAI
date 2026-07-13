import express, { Application, NextFunction, Request, Response } from 'express';
import path from 'path';
import http from 'http';
import cors from 'cors';
import fileUpload from 'express-fileupload';
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
import adminRoutes from './routes/admin.route';
import audioRoutes from './routes/audio.route';
import { createModuleRouter } from './routes/modules.route';
import { EventBus } from './events/event-bus';
import type { ConversationEvents } from './modules/conversation/conversation.events';
import { ConversationRuntime } from './modules/conversation/conversation.runtime';
import { ModuleManager } from './services/module-manager.service';
import { LocalVisionProvider } from './modules/conversation/vision.provider';

export let io: Server;

(async () => {
    try {
        const eventBus = new EventBus<ConversationEvents>();
        const conversationRuntime = new ConversationRuntime(eventBus, new LocalVisionProvider());
        const moduleManager = new ModuleManager(conversationRuntime);
        await init(moduleManager);

        // Initialize Discord
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

        const app: Application = express();
        const port = process.env.PORT || 3000;
        const server = http.createServer(app); // Create HTTP server

        // Websockets
        io = setupSockets(server, conversationRuntime);

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
            limits: { fileSize: 25 * 1024 * 1024 },
            abortOnLimit: true,
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
        app.use('/gui', requireAuth, guiRoutes);
        app.use('/memory', requireAuth, memoryRoutes);
        // Mount user routes without API key so register/login remain public;
        // internal CRUD endpoints are protected by JWT middleware inside the route.
        app.use('/users', userRoutes);
        app.use('/config', requireAuth, configRoutes);
        app.use('/tools', requireAuth, toolsRoutes);
        app.use('/admin', adminRoutes);
        app.use('/audio', requireAuth, audioRoutes);
        app.use('/modules', createModuleRouter(moduleManager));

        server.listen(port, async () => {
            Logger.INFO(`Server is running on port ${port} ${/09$/.test(port.toString()) ? '(☢️)' : ''}`);

            // init gui
            // initTauri();
            // Start console
            await initConsole();
        });
    } catch (error) {
        console.error('Fatal error during initialization:', error);
        process.exit(1);
    }
})();
