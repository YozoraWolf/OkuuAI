import { deleteOkuuPfp, getOkuuPfp, setOkuuPfp } from '@src/controllers/config.controller';
import express from 'express';
const router = express.Router();

router.post('/okuu/pfp', setOkuuPfp);
router.get('/okuu/pfp', getOkuuPfp);
router.delete('/okuu/pfp', deleteOkuuPfp);


export default router;