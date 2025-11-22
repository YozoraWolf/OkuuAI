import { Core } from '@src/core';
import { Logger } from '@src/logger';
import { doesModelExistInOllama, getOllamaDownloadedModels, updateAssistantConfigJSON } from '@src/o_utils';
import { Request, Response } from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';

const assetsFolder = path.join(__dirname, '..', 'assets');
const okuuPfpPath = path.join(assetsFolder, 'okuu_pfp');

export const setOkuuPfp = (req: Request, res: Response) => {
    if (!req.files || !req.files.file) {
        return res.status(400).send('No file uploaded.');
    }

    const file = req.files.file as fileUpload.UploadedFile;
    const filePath = path.join(assetsFolder, `okuu_pfp${path.extname(file.name)}`);
    file.mv(filePath, (err) => {
        if (err) {
            return res.status(500).send('Error saving file.');
        }
        res.status(200).send('File uploaded successfully.');
    });
};

export const getOkuuPfp = (req: Request, res: Response) => {
    fs.readdir(assetsFolder, (err, files) => {
        if (err) {
            return res.status(500).send('Error reading directory.');
        }

        const okuuPfpFile = files.find(file => file.startsWith('okuu_pfp'));
        if (!okuuPfpFile) {
            return res.status(404).send('File not found.');
        }

        const filePath = path.join(assetsFolder, okuuPfpFile);
        res.setHeader('Content-Type', 'image/jpeg'); // Set the correct content type
        res.sendFile(filePath);
    });
};

export const deleteOkuuPfp = (req: Request, res: Response) => {
    fs.readdir(assetsFolder, (err, files) => {
        if (err) {
            return res.status(500).send('Error reading directory.');
        }

        const okuuPfpFile = files.find(file => file.startsWith('okuu_pfp'));
        if (!okuuPfpFile) {
            return res.status(404).send('File not found.');
        }

        const filePath = path.join(assetsFolder, okuuPfpFile);
        fs.unlink(filePath, (err) => {
            if (err) {
                return res.status(500).send('Error deleting file.');
            }
            res.status(200).send('File deleted successfully.');
        });
    });
};

// Model Related

export const getOkuuModel = (req: Request, res: Response) => {
    res.status(200).send({ model: Core.model_name });
};

export const setOkuuModel = async (req: Request, res: Response) => {
    const { model } = req.body;
    if(model === undefined) {
        return res.status(400).send('Model name not provided.');
    }
    // Need to think about this implementation better since theres no
    // nice way to check if the model exists in Ollama without pulling it first
    /*} else if(await doesModelExistInOllama(model) === false) {
        return res.status(400).send('Model does not exist in Ollama.');
    }*/
    updateAssistantConfigJSON({ model });
    Core.model_name = model;
    Logger.INFO(`✅ (API) Model set to: ${model}`);
    res.status(200).send({ model: Core.model_name });
};

export const getDownloadedModels = async (req: Request, res: Response) => {
    const models = await getOllamaDownloadedModels();
    res.status(200).send({ models });
};


// System Prompt Related

export const getSystemPrompt = (req: Request, res: Response) => {
    res.status(200).send({ system_prompt: Core.model_settings.system });
};

export const setSystemPrompt = (req: Request, res: Response) => {
    const { system_prompt } = req.body;
    if(system_prompt === undefined) {
        return res.status(400).send('System prompt not provided.');
    }
    updateAssistantConfigJSON({ system_prompt });
    Core.model_settings.system = system_prompt;
    Logger.INFO(`✅ (API) System Prompt set to: ${system_prompt}`);
    res.status(200).send({ system_prompt: Core.model_settings.system });
};

// Global Memory Related

export const getGlobalMemory = (req: Request, res: Response) => {
    res.status(200).send({ global_memory: Core.global_memory });
};

export const setGlobalMemory = (req: Request, res: Response) => {
    const { global_memory } = req.body;
    if(global_memory === undefined) {
        return res.status(400).send('Global memory not provided.');
    }
    updateAssistantConfigJSON({ global_memory });
    Core.global_memory = global_memory;
    Logger.INFO(`✅ (API) Global Memory set to: ${global_memory}`);
    res.status(200).send({ global_memory: Core.global_memory });
};

export const getOkuuThink = (req: Request, res: Response) => {
    res.status(200).send({ think: Core.model_settings.think });
};

export const setOkuuThink = (req: Request, res: Response) => {
    const { think } = req.body;
    if(think === undefined) {
        return res.status(400).send('Think setting not provided.');
    }
    updateAssistantConfigJSON({ think });
    Core.model_settings.think = think;
    Logger.INFO(`✅ (API) Think setting set to: ${think}`);
    res.status(200).send({ think: Core.model_settings.think });
};

// Custom Endpoint Related

export const getCustomEndpoint = (req: Request, res: Response) => {
    res.status(200).send({ 
        use_custom_endpoint: Core.use_custom_endpoint,
        custom_endpoint_url: Core.custom_endpoint_url,
        custom_endpoint_api_key: Core.custom_endpoint_api_key ? '***' : '' // Hide API key
    });
};

export const setCustomEndpoint = (req: Request, res: Response) => {
    const { use_custom_endpoint, custom_endpoint_url, custom_endpoint_api_key } = req.body;
    
    if(use_custom_endpoint !== undefined) {
        Core.use_custom_endpoint = use_custom_endpoint;
        updateAssistantConfigJSON({ use_custom_endpoint });
    }
    
    if(custom_endpoint_url !== undefined) {
        Core.custom_endpoint_url = custom_endpoint_url;
        updateAssistantConfigJSON({ custom_endpoint_url });
    }
    
    if(custom_endpoint_api_key !== undefined) {
        Core.custom_endpoint_api_key = custom_endpoint_api_key;
        updateAssistantConfigJSON({ custom_endpoint_api_key });
    }
    
    Logger.INFO(`✅ (API) Custom Endpoint: ${use_custom_endpoint ? 'Enabled' : 'Disabled'}`);
    Logger.INFO(`✅ (API) Custom Endpoint URL: ${custom_endpoint_url || 'Not set'}`);
    
    res.status(200).send({ 
        use_custom_endpoint: Core.use_custom_endpoint,
        custom_endpoint_url: Core.custom_endpoint_url,
        custom_endpoint_api_key: Core.custom_endpoint_api_key ? '***' : ''
    });
};

export const validateCustomEndpoint = async (req: Request, res: Response) => {
    const { endpoint_url, api_key } = req.body;
    
    if(!endpoint_url) {
        return res.status(400).send({ valid: false, message: 'Endpoint URL is required.' });
    }
    
    try {
        // Test the endpoint with a simple request
        const testUrl = `${endpoint_url}/v1/models`;
        const headers: any = {
            'Content-Type': 'application/json',
        };
        
        if(api_key) {
            headers['Authorization'] = `Bearer ${api_key}`;
        }
        
        const response = await fetch(testUrl, {
            method: 'GET',
            headers,
        });
        
        if(response.ok) {
            const data = await response.json();
            Logger.INFO(`✅ Custom Endpoint validated successfully`);
            res.status(200).send({ 
                valid: true, 
                message: 'Endpoint validated successfully',
                models: data.data || data.models || []
            });
        } else {
            Logger.WARN(`Custom Endpoint validation failed: ${response.status} ${response.statusText}`);
            res.status(200).send({ 
                valid: false, 
                message: `Endpoint returned ${response.status}: ${response.statusText}`
            });
        }
    } catch (error: any) {
        Logger.ERROR(`Error validating custom endpoint: ${error.message}`);
        res.status(200).send({ 
            valid: false, 
            message: `Connection failed: ${error.message}`
        });
    }
};