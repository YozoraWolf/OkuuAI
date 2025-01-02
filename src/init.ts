import { checkOllamaService, downloadFile } from './o_utils';
import fs from 'fs';
import { Core, Status } from './core';
import { centeredLogoTxt } from './intro';
import { initTray } from './tray';
import { ConsoleColor, Logger } from './logger';
//import { initDockerChromaDB } from './langchain/chromadb'; // Perhaps to be deleted.
import dotenv from 'dotenv';
import { initRedis } from './containers/redis.container';
import { SESSION_SETTINGS, startSession } from './langchain/memory/memory';
import { initConfig, loadEnv } from './config';
import { initUsersDB } from './services/user.service';
import { OllamaContainer } from './containers/ollama.container';

dotenv.config();

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

export const init = async () => 
    new Promise<void>(async (resolve) => {

    console.log(centeredLogoTxt);

    Logger.INFO("Checking envs...");
    if (!fs.existsSync('.env')) {
        await initConfig();
        loadEnv();
        return;
    }

    Logger.DEBUG(`model_org_name: ${Core.model_org_name}`);
    Logger.DEBUG(`MODEL_NAME: ${process.env.MODEL_URL}`);

    // Download model if doesn't exist
    const model_url = process.env.MODEL_URL || '';
    const model_path = `${Core.model_path}${Core.model_org_name}`;

    await downloadModelFile(model_url, model_path);
  
    // check if the ollama service is on, if not, start it
    //await checkOllamaService();
    const ollamaContainer = new OllamaContainer('ollama/ollama', 'okuuai_ollama', 7009);
    await ollamaContainer.init();

    // check if model is available in ollama
    //await checkModelAvailability();

    // initialize tray icon
    await initTray();

    // initialize chromadb
    //await initDockerChromaDB();

    // initialize sqlite3
    await initUsersDB();

    // initialize redis
    await initRedis();

    // get latest history
    const sessionId = SESSION_SETTINGS.sessionId;

    Logger.DEBUG(`Session Settings: ${JSON.stringify(SESSION_SETTINGS)}`);

    // initialize chat session
    Core.chat_session = await startSession(sessionId);


    //Logger.DEBUG(`Latest history: ${await getLatestHistory()}`);
    // set status to active
    Core.status = Status.ACTIVE;

    Logger.INFO(`${ConsoleColor.FgGreen}Initialization complete`);

    resolve();
});