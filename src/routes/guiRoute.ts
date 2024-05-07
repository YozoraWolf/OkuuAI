// usersRoutes.ts

import express from 'express';
const router = express.Router();
import { guiCloseApp } from '../controllers/guiController';

// Route for GET /users
router.get('/close', guiCloseApp);

export default router;