import { Request, Response } from 'express';
import { Logger } from '@src/logger';
import { enhancedToolSystem } from '@src/tools/enhancedToolSystem';
import { updateAssistantConfigJSON } from '@src/o_utils';

export const getToolsConfig = async (req: Request, res: Response) => {
    try {
        const config = enhancedToolSystem.getConfig();
        res.json({
            success: true,
            config
        });
    } catch (error) {
        Logger.ERROR(`Error getting tools config: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to get tools configuration'
        });
    }
};

export const updateToolsConfig = async (req: Request, res: Response) => {
    try {
        const newConfig = req.body;
        
        // Validate the configuration
        const validKeys = ['enabled', 'auto_detect', 'web_search', 'calculations', 'file_access', 'memory_search', 'mcp_servers'];
        const filteredConfig = Object.keys(newConfig)
            .filter(key => validKeys.includes(key))
            .reduce((obj: any, key) => {
                obj[key] = newConfig[key];
                return obj;
            }, {});
        
        // Update the tool system
        enhancedToolSystem.updateConfig(filteredConfig);
        
        // Update assistant.json
        updateAssistantConfigJSON({ tools: filteredConfig });
        
        Logger.INFO(`Tools configuration updated: ${JSON.stringify(filteredConfig)}`);
        
        res.json({
            success: true,
            message: 'Tool configuration updated successfully',
            config: enhancedToolSystem.getConfig()
        });
    } catch (error) {
        Logger.ERROR(`Error updating tools config: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to update tools configuration'
        });
    }
};

export const listAvailableTools = async (req: Request, res: Response) => {
    try {
        const tools = enhancedToolSystem.listAvailableTools();
        res.json({
            success: true,
            tools
        });
    } catch (error) {
        Logger.ERROR(`Error listing available tools: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to list available tools'
        });
    }
};