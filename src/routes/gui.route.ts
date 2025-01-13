import express from 'express';
const router = express.Router();
import { guiCloseApp } from '../controllers/gui.controller';

// Route to close app from GUI
router.get('/close', guiCloseApp);

export default router;