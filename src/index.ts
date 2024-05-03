import express from 'express';
import { init } from './init';
import { Logger } from './logger';

(async () => {
    await init();

    const app = express();
    const port = process.env.PORT || 3000;

    app.get('/chat', () => {
        // Handle the '/chat' route here
    });

    app.listen(port, async () => {
        Logger.INFO(`Server is running on port ${port} ${/09$/.test(port.toString()) ? '(☢️)':''}`);
        // Start console
        await import('./console');
    });


})();
