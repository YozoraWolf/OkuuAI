import express from 'express';
import { getSetupStatus, postSetupComplete, postTestEndpoint } from '../controllers/setup.controller';

const router = express.Router();

router.get('/status', getSetupStatus);
router.post('/test-endpoint', postTestEndpoint);
router.post('/complete', postSetupComplete);

export default router;
