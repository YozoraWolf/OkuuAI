import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';
import { ModuleManager } from '../services/module-manager.service';
import { Logger } from '../logger';

export const createModuleRouter = (moduleManager: ModuleManager) => {
const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/', async (_req, res) => {
  try {
    res.json({ modules: await moduleManager.getModules(), timestamp: Date.now() });
  } catch (error) {
    Logger.ERROR(`Failed to load modules: ${error}`);
    res.status(500).json({ error: 'Failed to load modules' });
  }
});

router.post('/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  if (action !== 'enable' && action !== 'disable') {
    return res.status(400).json({ error: 'Action must be enable or disable' });
  }
  try {
    res.json({ module: await moduleManager.setModuleEnabled(id, action === 'enable') });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Module action failed';
    Logger.ERROR(`Failed to ${action} module ${id}: ${message}`);
    res.status(message === 'Unknown module' ? 404 : message.includes('in progress') ? 409 : 500).json({ error: message });
  }
});

return router;
};
