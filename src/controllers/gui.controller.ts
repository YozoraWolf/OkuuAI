import { exitOkuuAI } from '@src/console';
import { Request, Response } from 'express';

export const guiCloseApp = async (req: Request, res: Response) => {
    await exitOkuuAI();
    res.status(200).send('OkuuAI close signal sent');
};
