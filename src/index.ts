import express from 'express';
import { init } from './init';
import { Logger } from './logger';

(async () => {
    await init();

    const app = express();
    const port = 3000;

    app.get('/chat', (req, res) => {
        // Handle the '/chat' route here
    });

    app.listen(port, async () => {
        Logger.INFO(`Server is running on port ${port}`);
        // Start console
        await import('./console');
    });


})();
