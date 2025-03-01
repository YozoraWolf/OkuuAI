import { deleteOkuuPfp, getGlobalMemory, getOkuuModel, getOkuuPfp, getSystemPrompt, setGlobalMemory, setOkuuModel, setOkuuPfp, setSystemPrompt } from '@src/controllers/config.controller';
import express from 'express';
import { get } from 'http';
const router = express.Router();

router.post('/okuu/pfp', setOkuuPfp);
router.get('/okuu/pfp', getOkuuPfp);
router.delete('/okuu/pfp', deleteOkuuPfp);

router.get('/okuu/model', getOkuuModel);
router.post('/okuu/model', setOkuuModel);

router.get('/okuu/system-prompt', getSystemPrompt);
router.post('/okuu/system-prompt', setSystemPrompt);

router.get('/okuu/global-memory', getGlobalMemory);
router.post('/okuu/global-memory', setGlobalMemory);


export default router;