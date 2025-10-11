import express from 'express';
import { getToolsConfig, updateToolsConfig, listAvailableTools } from '@src/controllers/tools.controller';

const router = express.Router();

// Get current tool configuration
router.get('/config', getToolsConfig);

// Update tool configuration
router.put('/config', updateToolsConfig);

// List available tools
router.get('/available', listAvailableTools);

export default router;