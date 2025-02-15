import readline from 'readline';
import axios from 'axios';
import { Logger } from './logger';

const defaultModels = ['llama3', 'gpt3', 'gpt4', 'bert', 'roberta'];

export const searchModels = async (modelName: string): Promise<string[]> => {
    try {
        const response = await axios.get(`https://ollamadb.dev/api/v1/models?search=${modelName}`);
        if (response.status === 200) {
            const models = response.data.models;
            return models.filter((model: string) => model.includes(modelName));
        } else {
            Logger.WARN(`Failed to fetch models from Ollama, using default models list.`);
            return defaultModels.filter((model: string) => model.includes(modelName));
        }
    } catch (error) {
        Logger.ERROR(`Failed to fetch models from Ollama: ${error}`);
        return defaultModels.filter((model: string) => model.includes(modelName));
    }
};

export const selectModel = async (models: string[]): Promise<string> => {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) process.stdin.setRawMode(true);

        let index = 0;

        const displayModels = () => {
            console.clear();
            models.forEach((model, i) => {
                if (i === index) {
                    console.log(`> ${model}`);
                } else {
                    console.log(`  ${model}`);
                }
            });
        };

        const onKeyPress = (str: string, key: any) => {
            if (key.name === 'up') {
                index = (index > 0) ? index - 1 : models.length - 1;
                displayModels();
            } else if (key.name === 'down') {
                index = (index < models.length - 1) ? index + 1 : 0;
                displayModels();
            } else if (key.name === 'return') {
                process.stdin.removeListener('keypress', onKeyPress);
                rl.close();
                resolve(models[index]);
            }
        };

        process.stdin.on('keypress', onKeyPress);
        displayModels();
    });
};
