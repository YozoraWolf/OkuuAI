import { getLatestMsgsCont } from '@src/controllers/memoryController';
import express from 'express';
const router = express.Router();

// Route for GET /memory with parameter ? msg_limit
router.get('/', getLatestMsgsCont);

export default router;