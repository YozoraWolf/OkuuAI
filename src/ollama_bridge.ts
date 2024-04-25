import axios from 'axios';
import { Core } from './core';
import { Logger } from './logger';

const server: string = 'http://localhost:11434';

export const checkModelAvailability = () : Promise<void> => {
    return new Promise<void>(async (resolve, reject) => {
        try {
            const url = `${server}/api/show`;
            const data = {
                name: 'okuu'
            };

            const response = await axios.post(url, data);
            Logger.INFO(`Model found!`);
            resolve();
        } catch (error: any) {
            if (error.response.status === 404) {
                try {
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
            const response = await axios.post('http://localhost:11434/api/create', {
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

export const sendChat = async (message: string): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            const url = `${server}/api/chat`;
            const data = {
                model: Core.model_name,
                messages: [
                    {
                        role: "user",
                        content: message
                    }
                ],
                options: {
                    num_predict: 256
                },
                stream: false
            }

            Logger.DEBUG(`${url} -> ${JSON.stringify(data).substring(0, 128)}`);

            const response = await axios.post(url, data);
            resolve(response.data);
        } catch (error: any) {
            reject(error);
            Logger.ERROR(`Error sending chat: ${error.response ? error.response.data : error.message}`);
        }
    });
}