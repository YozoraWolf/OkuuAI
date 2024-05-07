    import express, { Application } from 'express';
    import { init } from './init';
    import { Logger } from './logger';
    import guiRoutes from './routes/guiRoute';

    (async () => {
        await init();
        
        const app: Application = express();
        const port = process.env.PORT || 3000;

        app.use('/gui', guiRoutes);


        app.get('/chat', () => {
            // Handle the '/chat' route here
        });

        app.listen(port, async () => {
            Logger.INFO(`Server is running on port ${port} ${/09$/.test(port.toString()) ? '(☢️)':''}`);
            // Start console
            //await initConsole();
        });


    })();