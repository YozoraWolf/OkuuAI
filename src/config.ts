import readline from 'readline';
import fs from 'fs';
import { Logger } from './logger';
import chalk from 'chalk';
import path from 'path';

// Interfaces & Defaults

// TODO: Set VITE configs too like frontend port, etc.
interface Config {
    model_url?: string;
    model_path?: string;
    port?: number;
    srv_url?: string;
    redis_port?: number;
    redis_pwd?: string;
    gui_port?: number;
    system?: string;
    [key: string]: any;
}

interface ConfigGUI {
    vite_port?: number;
    okuuai_port?: number;
    [key: string]: any;
}

const defaultConfigAI: Config = {
    model_url: "https://huggingface.co/MaziyarPanahi/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q6_K.gguf?download=true",
    model_path: "/usr/share/ollama/.ollama/models/okuu/",
    port: 3009,
    srv_url: "http://localhost",
    redis_port: 6009,
    redis_pwd: "1234",
    gui_port: 8009,
    system: "You're an AI assistant."
};

const defaultConfigFrontend: ConfigGUI = {
    vite_port: 8009,
    okuuai_port: 3009,
    msg_limit: 20
};


// Util
function envToJSON(env: string): Config {
    const envLines = env.split('\n');
    const config: Config = { ...defaultConfigAI };
    for (const line of envLines) {
        if (line.trim() === '') {
            continue;
        }
        const [key, value] = line.split('=');
        if (Object.keys(defaultConfigAI).includes(key.toLowerCase())) {
            config[key.toLowerCase()] = value;
        } else {
            // Handle unknown key (e.g., throw error, log warning)
            Logger.WARN(`Unknown key in .env file: ${key}`);
        }
    }
    return config;
}

// Load OVERRIDE if present in arguments
const arg = process.argv[2];

const envJsonName = 'env.json';


let currentConfig: Config = {
    model_url: "",
    model_path: "",
    port: 0,
    srv_url: "",
    redis_port: 0,
    redis_pwd: "",
    gui_port: 0,
    system: ""
};
const newConfig: Config = {
    model_url: "",
    model_path: "",
    port: 0,
    srv_url: "",
    redis_port: 0,
    redis_pwd: "",
    gui_port: 0,
    system: ""
};

const configName: any = {
    model_url: "Model URL",
    model_path: "Model Path",
    port: "Port",
    srv_url: "OkuuAI URL",
    redis_port: "Redis Port",
    redis_pwd: "Redis Password",
    gui_port: "GUI Port",
    system: "System Prompt"
};

let rl: readline.Interface;

export const initConfig = () => new Promise<void>(() => {

    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });


    if (arg === 'OVERRIDE') {
        loadEnv(); // this will first check if there's an existing .env file, if not, it will start the interactive configuration
    }
});


const question = (prompt: string) => {
    return new Promise<string | null>((resolve, reject) => {
        rl.question(prompt, (answer) => {
            if (typeof answer === 'string') {
                resolve(answer.trim());
            } else {
                reject(null);
            }
        });
    });
};


const exitConfig = (code: number) => {
    if (code === 0) {
        Logger.INFO('Configuration completed successfully');
        if (arg !== 'OVERRIDE') {
            Logger.INFO('Please restart the application to apply the new configuration');
        };
    }
    else if (code === 1) {
        Logger.ERROR('Configuration failed due to an error');
    }
    process.exit(code);
};

const createEnvFile = (config: Config = defaultConfigAI) => {
    let envStr = '';
    Logger.INFO('Creating .env file...');
    Logger.DEBUG(`Config: ${JSON.stringify(config)}`);
    try {
        fs.createWriteStream('.env', { flags: 'w' });
        for (const key in config) {
            envStr += `${key.toUpperCase()}=${config[key]}\n`;
        }
        //Logger.DEBUG(`Env String: ${envStr}`);
        fs.writeFileSync('.env', envStr, { encoding: 'utf8', flag: 'w' });
    } catch (error) {
        Logger.ERROR(`Failed to create .env file\n${error}`);
    }
};

export const loadEnv = () => {
    if (!fs.existsSync('.env')) {
        Logger.WARN('Failed to load .env file');
        interactiveConfig();
        return;
    }
    try {
        const env = envToJSON(fs.readFileSync('.env', 'utf8'));
        for (const key in env) {
            const lowercaseKey = key.toLowerCase();
            currentConfig[lowercaseKey] = env[key]; // Store the key-value pair in the object with lowercase key
        }
        env.system = loadSystemPrompt(); // Load system prompt
        // Check if the user wants to override the existing configuration
        if (arg === 'OVERRIDE') {
            rl.question(`${chalk.white('>> Do you want to override the existing configuration?')} (Y/N): `, async (answer) => {
                if (answer.toLowerCase() === 'y') {
                    interactiveConfig();
                } else {
                    rl.close();
                    exitConfig(0);
                }
            });
        }
    } catch (error) {
        console.log('Failed to load .env file');
    }
};


const MAX_CHARS = 65;
const interactiveConfig = async () => {
    Logger.INFO('Starting interactive configuration...');
    let errorIt = true;
    currentConfig = Object.keys(currentConfig).length === 0 ? defaultConfigAI : currentConfig;
    for (const key in currentConfig) {
        errorIt = true; // reset repeat flag before each iteration
        while (errorIt) {
            try {
                const defaultVal = currentConfig[key];
                const truncatedVal = defaultVal.toString().length > MAX_CHARS ? defaultVal.toString().substring(0, MAX_CHARS) + "..." : defaultVal;
                const answer = await question(`${chalk.hex('#FFA500')('☢')} ${chalk.hex("#FFF")(`Enter ${configName[key]}`)} (${chalk.hex("#FFFF00")(truncatedVal)}): `);
                if (answer === '') {
                    newConfig[key] = currentConfig[key];
                } else if (answer === null) {
                    continue;
                } else {
                    newConfig[key] = answer;
                }
                errorIt = false; // Exit loop if no error occurred
            } catch (error: any) {
                Logger.INFO(`Error occurred during configuration: ${error}`);
                errorIt = true;
            }
        }
    }

    const { system, ...settings } = newConfig;

    try {
        createEnvFile(settings);
        updateFrontEnv();
        updateSystemPromptJSON();
    } catch (error) {
        Logger.ERROR(`Failed to create .env file\n${error}`);
        exitConfig(1);
    }

    rl.close();
    exitConfig(0);
};

// gui frontend configuration related
const guiRootPath = process.cwd();

const createFrontendEnv = (config: Config = defaultConfigFrontend) => {
    Logger.INFO('Creating env.json file for GUI...');
    Logger.DEBUG(`Config: ${JSON.stringify(config)}`);
    try {
        fs.writeFileSync(`${guiRootPath}/${envJsonName}`, JSON.stringify(config, null, 2), { encoding: 'utf-8', flag: 'w' });
    } catch (error) {
        Logger.ERROR(`Failed to create env.json file for GUI\n${error}`);
    }
    return config;
};


const updateFrontEnv = () => {
    let env: ConfigGUI;
    if (!fs.existsSync(`${guiRootPath}/${envJsonName}`)) {
        Logger.WARN(`Failed to load GUI's ${envJsonName} file. Creating new one...`);
        env = {};

    } else {
        Logger.INFO(`Updating frontend ${envJsonName} file...`);
        env = JSON.parse(fs.readFileSync(`${guiRootPath}/${envJsonName}`, 'utf8'));
    }
    env.gui_port = newConfig.gui_port;
    env.okuuai_port = newConfig.port;
    createFrontendEnv(env);
};

// System Prompt Configuration

const systemPromptFile = 'system.json';

const loadSystemPrompt = () => {
    let sys;
    if (!fs.existsSync('system.json')) {
        Logger.WARN(`Failed to load ${systemPromptFile} file. Creating new one...`);
        sys = createSystemPromptJSON();
    } else {
        Logger.INFO(`Loading system prompt from ${systemPromptFile} file...`);
        sys = JSON.parse(fs.readFileSync('system.json', 'utf8'));
    }
    return sys.system;
};

const createSystemPromptJSON = () => {
    Logger.INFO('Creating system.json file...');
    const newSystem = { system: defaultConfigAI.system };
    const sys = JSON.stringify(newSystem, null, 2);
    try {
        fs.writeFileSync('system.json', sys);
    } catch (error) {
        Logger.ERROR(`Failed to create system.json file\n${error}`);
        return null;
    }
    return newSystem;
};

const updateSystemPromptJSON = () => {
    const system = newConfig.system;
    try {
        fs.writeFileSync('system.json', JSON.stringify({ system }, null, 2));
    }
    catch (error) {
        Logger.ERROR(`Failed to update system.json file\n${error}`);
    }
};

if (arg === 'OVERRIDE') {
    initConfig(); // this will first check if there's an existing .env file, if not, it will start the interactive configuration
}