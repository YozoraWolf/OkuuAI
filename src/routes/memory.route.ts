import { checkMemoryStatus, createMemoryRecord, createSess, deleteChatMessage, deleteSession, getAllSessionsJSON, getSessionMsgs } from '@src/controllers/memory.controller';
import express from 'express';
const router = express.Router();

// Route for GET /memory with parameter ? msg_limit
router.get('/', checkMemoryStatus);
router.get('/sessions', getAllSessionsJSON);
router.get('/sessions/:sessionId', getSessionMsgs);
router.post('/sessions', createSess);
router.delete('/sessions/:sessionId', deleteSession);
router.post('/sessions/delete', deleteChatMessage)
router.post('/record', createMemoryRecord);

export default router;