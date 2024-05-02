import axios from 'axios';
import { Core } from './core';
import { Logger } from './logger';
import ollama, { ChatResponse, GenerateResponse } from 'ollama'

export const checkModelAvailability = (): Promise<void> => {
    return new Promise<void>(async (resolve, reject) => {
        try {
            const response = await ollama.show({ model: 'okuu' });
            Logger.INFO(`Model found!`);
            resolve();
        } catch (error: any) {
            Logger.WARN(`${error}`);
            if (error) {
                try {
                    Logger.INFO(`Creating model...`);
                    const created = await createModel();
                    resolve();
                } catch (error: any) {
                    reject(error);
                }
            } else {
                reject(error);
            }
        }
    });
}

export const createModel = async () => {
    return new Promise(async (resolve, reject) => {
        Logger.DEBUG(`Model Path: ${Core.model_path}`);
        Logger.DEBUG(`Modelfile: ${Core.modelfile}`);

        try {
            // send a POST request to create the model
            const response = await axios.post(`${Core.ollama_settings.host}/api/create`, {
                name: Core.model_name,
                modelfile: Core.modelfile,
            });

            Logger.INFO(`Model created: ${response.data}`);
            resolve(response.data);
        } catch (error: any) {
            Logger.ERROR(`Error creating model: ${error.response ? error.response.data : error.message}`);
            reject(error);
        }
    });
}

export const sendChat = async (cnt: string, callback?: (data: string) => void) => {
    try {
        const message = { role: 'user', content: cnt };
        const response: AsyncGenerator<GenerateResponse> = await ollama.generate({ 
            model: 'okuu', 
            prompt: cnt,
            system: Core.model_settings.system,
            stream: Core.ollama_settings.stream,
            options: {
                temperature: Core.model_settings.temperature,
                num_ctx: Core.model_settings.num_ctx,
                top_k: Core.model_settings.top_k,
                top_p: Core.model_settings.top_p,
            }
        });
        if(!Core.ollama_settings.stream) return response; // return the response if not streaming
        // else stream the response to the callback
        for await (const part of response) {
            if (callback) callback(part.response);
        }
    } catch (error: any) {
        Logger.ERROR(`Error sending chat: ${error.response ? error.response.data : error.message}`);
        return null;
    }
}