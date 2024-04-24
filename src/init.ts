import { checkOllamaService, downloadFile } from './o_utils';
import fs from 'fs';
import { Core, Status } from './core';
import { checkModelAvailability, createModel } from './ollama_bridge';
import { Logger } from './logger';

export const init = async () => {

    // Download model if doesn't exist
    const model_url = "https://huggingface.co/QuantFactory/dolphin-2.9-llama3-8b-GGUF/resolve/main/dolphin-2.9-llama3-8b.Q6_K.gguf?download=true";
    const model_path = `${Core.model_path}${Core.model_org_name}`;

    const downloadModelFile = async (url: string, path: string) => {
        if (!fs.existsSync(path)) {
            if(!fs.existsSync(Core.model_path)) {
                Logger.INFO('Creating model directory...');
                await fs.promises.mkdir(Core.model_path, { recursive: true });
                Logger.INFO('Model directory created successfully!');
            }
            Logger.INFO('Downloading model file...');
            await downloadFile(url, path);
            Logger.INFO('Model file downloaded successfully!');
        } else {
            Logger.INFO('Model file exists. Skipping...');
        }
    }

    await downloadModelFile(model_url, model_path);
  
    // check if the ollama service is on, if not, start it
    await checkOllamaService();

    // check if model is available in ollama
    await checkModelAvailability();

    // set status to active
    Core.status = Status.ACTIVE;

    Logger.INFO('Initialization complete');
};