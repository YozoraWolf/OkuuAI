import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';
import { getAdminOverview } from '../services/system-metrics.service';
import { Logger } from '../logger';

const router = Router();

router.get('/overview', requireAuth, requireAdmin, async (_req, res) => {
  try {
    res.json(await getAdminOverview());
  } catch (error) {
    Logger.ERROR(`Failed to load admin overview: ${error}`);
    res.status(500).json({ error: 'Failed to load system overview' });
  }
});

export default router;
