import { checkOllamaService, downloadFile } from './o_utils';
import fs from 'fs';
import { Core, Status } from './core';
import { centeredLogoTxt } from './intro';
import { initTray } from './tray';
import { ConsoleColor, Logger } from './logger';
//import { initDockerChromaDB } from './langchain/chromadb'; // Perhaps to be deleted.
import dotenv from 'dotenv';
import { initRedis } from './langchain/redis';
import { SESSION_SETTINGS, startSession } from './langchain/memory/memory';
import { initTauri } from './gui';
dotenv.config();

export const init = async () => {

    console.log(centeredLogoTxt);
    // Check if all required environment k-v are set.
    checkEnvs();
    Logger.DEBUG(`model_org_name: ${Core.model_org_name}`);
    Logger.DEBUG(`MODEL_NAME: ${process.env.MODEL_URL}`);

    // Download model if doesn't exist
    const model_url = process.env.MODEL_URL || '';
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
            Logger.INFO(`${ConsoleColor.FgGreen}Model file downloaded successfully!`);
        } else {
            Logger.INFO('Model file exists. Skipping...');
        }
    };

    await downloadModelFile(model_url, model_path);
  
    // check if the ollama service is on, if not, start it
    await checkOllamaService();

    // check if model is available in ollama
    //await checkModelAvailability();

    // initialize tray icon
    await initTray();

    // initialize chromadb
    //await initDockerChromaDB();

    // initialize redis
    await initRedis();

    // get latest history
    const sessionId = SESSION_SETTINGS.sessionId;

    Logger.DEBUG(`Session Settings: ${JSON.stringify(SESSION_SETTINGS)}`);

    // initialize chat session
    Core.chat_session = await startSession(sessionId);

    // init gui
    initTauri();

    //Logger.DEBUG(`Latest history: ${await getLatestHistory()}`);
    // set status to active
    Core.status = Status.ACTIVE;

    Logger.INFO(`${ConsoleColor.FgGreen}Initialization complete`);
};

const checkEnvs = () : void => {
    // If there are new environment variables, add them to the envs array
    const envs = [
        'MODEL_URL',
        'MODEL_PATH',
        'CHROMA_USER',
        'CHROMA_PWD',
        'REDIS_PWD',
    ];

    envs.forEach(env => {
        if (!process.env[env]) {
            Logger.ERROR(`Environment variable ${env} is not set`);
            process.exit(1);
        }
    });

    // If all required envs are present, then continue execution.
    Logger.INFO('All environment variables are set');
};