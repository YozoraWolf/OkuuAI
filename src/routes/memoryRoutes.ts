import { getLatestMsgsCont, getAllSessionsJSON, getSessionMsgs, createSess } from '@src/controllers/memory.controller';
import express from 'express';
const router = express.Router();

// Route for GET /memory with parameter ? msg_limit
router.get('/', getLatestMsgsCont);
router.get('/sessions', getAllSessionsJSON);
router.get('/sessions/:sessionId', getSessionMsgs);
router.post('/sessions', createSess);

export default router;