import { deleteOkuuPfp, getDownloadedModels, getGlobalMemory, getOkuuModel, getOkuuPfp, getOkuuThink, getSystemPrompt, setGlobalMemory, setOkuuModel, setOkuuPfp, setOkuuThink, setSystemPrompt } from '@src/controllers/config.controller';
import express from 'express';
import { requireAdmin } from '@src/middleware/auth.middleware';
const router = express.Router();

router.post('/okuu/pfp', requireAdmin, setOkuuPfp);
router.get('/okuu/pfp', getOkuuPfp);
router.delete('/okuu/pfp', requireAdmin, deleteOkuuPfp);

router.get('/okuu/model', getOkuuModel);
router.get('/okuu/models', getDownloadedModels);
router.post('/okuu/model', setOkuuModel);

router.get('/okuu/system-prompt', requireAdmin, getSystemPrompt);
router.post('/okuu/system-prompt', requireAdmin, setSystemPrompt);

router.get('/okuu/global-memory', getGlobalMemory);
router.post('/okuu/global-memory', setGlobalMemory);

router.get('/okuu/think' , getOkuuThink);
router.post('/okuu/think', setOkuuThink);


export default router;
