import { getLatestMsgsCont, getAllSessionsJSON, getSessionMsgs } from '@src/controllers/memoryController';
import express from 'express';
const router = express.Router();

// Route for GET /memory with parameter ? msg_limit
router.get('/', getLatestMsgsCont);
router.get('/sessions', getAllSessionsJSON);
router.get('/sessions/:sessionId', getSessionMsgs);

export default router;