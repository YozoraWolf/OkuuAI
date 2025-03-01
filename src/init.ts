import { downloadFile, loadAssistantConfig, updateAssistantConfigJSON } from './o_utils';
import fs from 'fs';
import { Core, Status } from './core';
import { centeredLogoTxt } from './intro';
//import { initTray } from './tray';
import { ConsoleColor, Logger } from './logger';
//import { initDockerChromaDB } from './langchain/chromadb'; // Perhaps to be deleted.
import dotenv from 'dotenv';
import { SESSION_SETTINGS, startSession } from './langchain/memory/memory';
import { initConfig, loadEnv, interactiveConfig, createEnvFile, defaultAssistantConfig } from './config';
import { initUsersDB } from './services/user.service';
import { runModel, startAndMonitorContainers } from './compose/containers';
import { initRedis } from './langchain/redis';
import { select } from '@inquirer/prompts';

dotenv.config();

/* const downloadModelFile = async (url: string, path: string) => {
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
 */
const promptForConfig = async () => {
    const answer = await select({
        message: 'Configuration files not found. Do you want to start the interactive configuration or use default settings?',
        choices: ['Interactive Configuration', 'Use Default Settings'],
        default: 'Interactive Configuration'
    });

    if (answer === 'Interactive Configuration') {
        await interactiveConfig();
    } else {
        await createEnvFile();
        updateAssistantConfigJSON(defaultAssistantConfig);
    }
};

export const init = async () => 
    new Promise<void>(async (resolve) => {

    console.log(centeredLogoTxt);

    Logger.INFO("Checking envs...");
    if (!fs.existsSync('.env') || !fs.existsSync('assistant.json')) {
        await promptForConfig();
        loadEnv();
        Logger.INFO("Env files created successfully!");
        Logger.INFO("Restart the application to apply the changes.");
        return;
    }

    // Load assistant configuration
    const assistantConfig = loadAssistantConfig();
    Core.ai_name = assistantConfig.name ? assistantConfig.name : Core.ai_name;
    Core.model_name = assistantConfig.model ? assistantConfig.model : Core.model_name;
    Core.model_settings.system = assistantConfig.system_prompt ? assistantConfig.system_prompt : Core.model_settings.system;
    Core.template = assistantConfig.template ? assistantConfig.template : Core.template;
    Core.global_memory = assistantConfig.global_memory ? assistantConfig.global_memory : Core.global_memory;

    Logger.DEBUG(`Assistant: ${Core.ai_name}`);
    Logger.DEBUG(`Model: ${Core.model_name}`);
    Logger.DEBUG(`System Prompt: ${Core.model_settings.system}`);
  
    // check if the ollama service is on, if not, start it
    //await checkOllamaService();
    await startAndMonitorContainers();
    
    // run model
    await runModel(Core.model_name);
    await runModel("nomic-embed-text");

    await initRedis();

    // check if model is available in ollama
    //await checkModelAvailability();

    // initialize tray icon
    //await initTray();

    // initialize chromadb
    //await initDockerChromaDB();

    // initialize sqlite3
    await initUsersDB();

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