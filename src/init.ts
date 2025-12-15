import { downloadFile, getOllamaDownloadedModels, loadAssistantConfig, updateAssistantConfigJSON } from './o_utils';
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
import { setupDatabase } from './db/user.db';
import bcrypt from 'bcrypt';
import { runModel, startAndMonitorContainers } from './compose/containers';
import { initRedis } from './langchain/redis';
import { select } from '@inquirer/prompts';
import { initOllamaInstance } from './chat';

dotenv.config();

// Enforce presence of JWT_SECRET early to avoid running with a weak fallback
if (!process.env.JWT_SECRET) {
    Logger.ERROR('Missing JWT_SECRET environment variable. Set JWT_SECRET in .env or environment.');
    process.exit(1);
}

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
        Object.assign(Core, {
            ai_name: assistantConfig.name ?? Core.ai_name,
            model_name: assistantConfig.model ?? Core.model_name,
            tool_model_name: assistantConfig.tool_llm ?? Core.tool_model_name,
            template: assistantConfig.template ?? Core.template,
            global_memory: assistantConfig.global_memory ?? Core.global_memory,
        });
        Object.assign(Core.model_settings, {
            system: assistantConfig.system_prompt ?? Core.model_settings.system,
            think: assistantConfig.think ?? Core.model_settings.think,
        });

        Logger.DEBUG(`Assistant: ${Core.ai_name}`);
        Logger.DEBUG(`Model: ${Core.model_name}`);
        Logger.DEBUG(`Tool Model: ${Core.tool_model_name}`);
        Logger.DEBUG(`System Prompt: ${Core.model_settings.system}`);

        // check if the ollama service is on, if not, start it
        //await checkOllamaService();
        await startAndMonitorContainers();

        // start ollama instance
        await initOllamaInstance();

        // run model
        await runModel(Core.model_name);
        await runModel("nomic-embed-text");
        await runModel(Core.tool_model_name);

        await initRedis();

        // check if model is available in ollama
        //await checkModelAvailability();

        // initialize tray icon
        //await initTray();

        // initialize chromadb
        //await initDockerChromaDB();

        // initialize sqlite3 (future implementation prep)
        await initUsersDB();

        // Ensure auth users DB is initialized and an admin user exists
        try {
            const db = await setupDatabase() as any;
            db.get("SELECT * FROM users WHERE username = ?", ['admin'], async (err: any, row: any) => {
                if (err) {
                    Logger.ERROR(`Error checking admin user: ${err}`);
                    return;
                }
                if (!row) {
                    const hashed = await bcrypt.hash('admin', 10);
                    db.run("INSERT INTO users (username, password, role, mustChangePassword) VALUES (?, ?, ?, ?)", ['admin', hashed, 'Admin', 1], (insertErr: any) => {
                        if (insertErr) {
                            Logger.ERROR(`Failed to create admin user: ${insertErr}`);
                        } else {
                            Logger.INFO('Default admin user created (username: admin, password: admin) - PASSWORD CHANGE REQUIRED ON FIRST LOGIN');
                        }
                    });
                } else {
                    Logger.DEBUG('Admin user already exists');
                }
            });
        } catch (err) {
            Logger.ERROR(`Failed to setup auth DB: ${err}`);
        }

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