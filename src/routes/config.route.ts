import { deleteOkuuPfp, getCustomEndpoint, getDownloadedModels, getGlobalMemory, getOkuuModel, getOkuuPfp, getOkuuThink, getSystemPrompt, setCustomEndpoint, setGlobalMemory, setOkuuModel, setOkuuPfp, setOkuuThink, setSystemPrompt, validateCustomEndpoint } from '@src/controllers/config.controller';
import express from 'express';
const router = express.Router();

router.post('/okuu/pfp', setOkuuPfp);
router.get('/okuu/pfp', getOkuuPfp);
router.delete('/okuu/pfp', deleteOkuuPfp);

router.get('/okuu/model', getOkuuModel);
router.get('/okuu/models', getDownloadedModels);
router.post('/okuu/model', setOkuuModel);

router.get('/okuu/system-prompt', getSystemPrompt);
router.post('/okuu/system-prompt', setSystemPrompt);

router.get('/okuu/global-memory', getGlobalMemory);
router.post('/okuu/global-memory', setGlobalMemory);

router.get('/okuu/think' , getOkuuThink);
router.post('/okuu/think', setOkuuThink);

router.get('/okuu/custom-endpoint', getCustomEndpoint);
router.post('/okuu/custom-endpoint', setCustomEndpoint);
router.post('/okuu/custom-endpoint/validate', validateCustomEndpoint);


export default router;