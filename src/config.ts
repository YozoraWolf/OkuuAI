import fs from 'fs';
import path from 'path';
import { Logger } from './logger';
import { loadAssistantConfig, updateAssistantConfigJSON } from './o_utils';
import { input, select, search } from '@inquirer/prompts';
import { Core } from './core';

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
    ai_name?: string;
    template?: string;
    model_name?: string;
    api_key?: string;
    ollama_port?: number;
    ollama_default_model?: string;
    web_url?: string;
    proxy_url?: string;
    proxy_email?: string;
    proxy_pwd?: string;
    proxy_fwd?: string;
    modelfile?: string;
    [key: string]: any;
}

interface ConfigGUI {
    vite_port?: number;
    okuuai_port?: number;
    [key: string]: any;
}

export const defaultConfigAI: Config = {
    model_url: "https://example.com/model-url",
    model_path: "/path/to/model",
    port: 3009,
    srv_url: "http://localhost",
    redis_port: 6379,
    redis_pwd: "password",
    gui_port: 8080,
    system: "You're a helpful AI assistant.",
    ai_name: "AI",
    template: "",
    model_name: "llama3",
    api_key: "adminkey1234",
    ollama_port: 7009,
    ollama_default_model: "llama3",
    web_url: "",
    proxy_url: "",
    proxy_email: "",
    proxy_pwd: "",
    proxy_fwd: ""
};

export const defaultAssistantConfig = {
    name: defaultConfigAI.ai_name,
    system_prompt: defaultConfigAI.system,
    model: defaultConfigAI.model_name,
    tool_llm: "qwen2.5:3b",
    template: ""
};



const defaultFront = {
    VITE_API_URL: "",
    VITE_LOCAL_API_URL: "http://localhost:3009",
    VUE_ROUTER_MODE: "history",
    LOCAL: "true"
};

const ask_input = ['ai_name', 'model_name', 'system', 'port'];

const defaultSettings = {
    logs: {
        log: true,
        logToFile: true,
        debug: true,
        maxFileSize: 5 * 1024 * 1024 // 5MB default
    }
};

// Util
function envToJSON(env: string): Config {
    const envLines = env.split('\n');
    const config: Config = { ...defaultConfigAI };
    for (const line of envLines) {
        if (line.trim() === '' || line.trim().startsWith('#')) {
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

let currentConfig: Config = { ...defaultConfigAI };
const newConfig: Config = { ...defaultConfigAI };

const configName: any = {
    model_url: "Model URL",
    model_path: "Model Path",
    port: "Port",
    srv_url: "OkuuAI URL",
    redis_port: "Redis Port",
    redis_pwd: "Redis Password",
    gui_port: "GUI Port",
    system: "System Prompt",
    ai_name: "AI Name",
    template: "Template",
    model_name: "Model Name",
    api_key: "API Key",
    ollama_port: "Ollama Port",
    ollama_default_model: "Ollama Default Model",
    web_url: "Web URL",
    proxy_url: "Proxy URL",
    proxy_email: "Proxy Email",
    proxy_pwd: "Proxy Password",
    proxy_fwd: "Proxy Forward"
};

const defaultValues = { ...defaultConfigAI };

export const createSettingsFile = async (settings = defaultSettings) => {
    const settingsPath = path.join(__dirname, '..', 'settings.json');
    Logger.INFO('Creating settings.json file...');
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), { encoding: 'utf8', flag: 'w' });
    } catch (error) {
        Logger.ERROR(`Failed to create settings.json file\n${error}`);
    }
};

export const initConfig = async () => {
    if (arg === 'OVERRIDE') {
        loadEnv(); // this will first check if there's an existing .env file, if not, it will start the interactive configuration
    }
    await createSettingsFile();
};

export const createEnvFile = async (config: Config = defaultConfigAI) => {
    let envStr = '';
    Logger.INFO('Creating .env file...');
    Logger.DEBUG(`Config: ${JSON.stringify(config)}`);
    try {
        envStr += '# Legacy\n';
        envStr += `#MODEL_URL=${config.model_url}\n`;
        envStr += `#MODEL_PATH=${config.model_path}\n\n`;

        envStr += '# Main Settings\n';
        envStr += `PORT=${config.port}\n`;
        envStr += `#SRV_URL=${config.srv_url}\n`;
        envStr += `API_KEY=${config.api_key}\n\n`;

        envStr += '# Redis Settings\n';
        envStr += `REDIS_PORT=${config.redis_port}\n`;
        envStr += `REDIS_PWD=${config.redis_pwd}\n\n`;

        envStr += '# Ollama\n';
        envStr += `OLLAMA_PORT=${config.ollama_port}\n`;
        envStr += `OLLAMA_DEFAULT_MODEL=${config.ollama_default_model}\n\n`;

        envStr += '# Proxy (Using Nginx Proxy Manager)\n';
        envStr += `WEB_URL=${config.web_url}\n`;
        envStr += `PROXY_EMAIL=${config.proxy_email}\n`;
        envStr += `PROXY_PWD=${config.proxy_pwd}\n`;
        envStr += `PROXY_FWD=${config.proxy_fwd}\n`;

        fs.writeFileSync('.env', envStr, { encoding: 'utf8', flag: 'w' });

        // Create frontend .env file
        await createFrontendEnv({
            VITE_API_URL: config.proxy_fwd,
            VITE_LOCAL_API_URL: `http://localhost:${config.port}`,
            VUE_ROUTER_MODE: "history",
            LOCAL: "true"
        });
    } catch (error) {
        Logger.ERROR(`Failed to create .env file\n${error}`);
    }
};

const createFrontendEnv = async (config: any = defaultFront) => {
    const frontendEnvPath = path.resolve(__dirname, "../src-site/okuu-control-center/.env");
    if (fs.existsSync(frontendEnvPath)) {
        const answer = await select({
            message: 'A frontend .env file already exists. Do you want to overwrite it?',
            choices: ['Yes', 'No'],
            default: 'No'
        });
        if (answer === 'No') {
            Logger.INFO('Operation cancelled by the user.');
            return;
        }
    }
    let envStr = '';
    Logger.INFO('Creating frontend .env file...');
    Logger.DEBUG(`Config: ${JSON.stringify(config)}`);
    try {
        envStr += `VITE_API_URL=${config.VITE_API_URL}\n`;
        envStr += `VITE_LOCAL_API_URL=${config.VITE_LOCAL_API_URL}\n`;
        envStr += `VUE_ROUTER_MODE=${config.VUE_ROUTER_MODE}\n`;
        envStr += `LOCAL=${config.LOCAL}\n`;

        fs.writeFileSync(frontendEnvPath, envStr, { encoding: 'utf8', flag: 'w' });
    } catch (error) {
        Logger.ERROR(`Failed to create frontend .env file\n${error}`);
    }
};

export const loadEnv = async () => {
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
        env.system = loadAssistantConfig().system_prompt; // Load system prompt from assistant.json
        // Check if the user wants to override the existing configuration
        if (arg === 'OVERRIDE') {
            const answer = await select({
                message: 'Do you want to override the existing configuration?',
                choices: ['Yes', 'No'],
                default: 'No'
            });
            if (answer === 'Yes') {
                await interactiveConfig();
            } else {
                process.exit(0);
            }
        }
    } catch (error) {
        console.log('Failed to load .env file');
    }
};


const MAX_CHARS = 65;

export const interactiveConfig = async () => {
    Logger.INFO('Starting interactive configuration...');
    currentConfig = Object.keys(currentConfig).length === 0 ? defaultConfigAI : currentConfig;

    let selectedModel: string | undefined;
    for (const key of ask_input) {
        const defaultVal = defaultValues[key];
        const truncatedVal = defaultVal.toString().length > MAX_CHARS ? defaultVal.toString().substring(0, MAX_CHARS) + "..." : defaultVal;

        if (key === 'model_name') {
            selectedModel = await search({
                message: `Select a model (${truncatedVal}):`,
                source: async (input, { signal }) => {
                    if (!input) {
                        return [];
                    }

                    const response = await fetch(
                        `https://ollamadb.dev/api/v1/models?search=${encodeURIComponent(input)}`,
                        { signal },
                    );
                    const data = await response.json();

                    return [
                        ...data.models.map((model: any) => ({
                            name: model.model_name,
                            value: model.model_name,
                        })),
                        { name: 'Add Modelfile', value: 'add_modelfile' }
                    ];
                },
            });

            if (selectedModel === 'add_modelfile') {
                const modelPath = await input({
                    message: 'Please enter the path to the model file:',
                    default: defaultConfigAI.model_path
                });
                newConfig.model_name = "";
                newConfig.modelfile = modelPath;
            } else {
                newConfig[key] = selectedModel;
            }
        } else {
            const answer = await input({
                message: `Enter ${configName[key]} (${truncatedVal}):`,
                default: defaultVal
            });
            newConfig[key] = answer;
        }
    }

    const enableLogs = await select({
        message: 'Enable logging?',
        choices: ['Yes', 'No'],
        default: 'Yes'
    });

    const maxLogFileSize = await input({
        message: 'Enter max log file size (in MB):',
        default: '5'
    });

    newConfig.model_name = selectedModel !== 'add_modelfile' ? selectedModel : "";

    const { system, ...settings } = newConfig;

    try {
        await createEnvFile(settings);
        //updateFrontEnv();
        updateAssistantConfigJSON({
            name: newConfig.ai_name,
            system_prompt: newConfig.system,
            model: newConfig.model_name,
            modelfile: newConfig.modelfile,
            template: newConfig.template
        });
        await createSettingsFile({
            logs: {
                log: enableLogs === 'Yes',
                logToFile: enableLogs === 'Yes',
                debug: true,
                maxFileSize: parseInt(maxLogFileSize) * 1024 * 1024
            }
        });
    } catch (error) {
        Logger.ERROR(`Failed to create .env file\n${error}`);
        process.exit(1);
    }

    process.exit(0);
};

// gui frontend configuration related
// const guiRootPath = path.resolve(__dirname, "../src-gui");

const updateFrontEnv = () => {
    //let env: ConfigGUI;
    // if (!fs.existsSync(`${guiRootPath}/${envJsonName}`)) {
    //     Logger.WARN(`Failed to load GUI's ${envJsonName} file. Creating new one...`);
    //     env = {};

    // } else {
    //     Logger.INFO(`Updating frontend ${envJsonName} file...`);
    //     env = JSON.parse(fs.readFileSync(`${guiRootPath}/${envJsonName}`, 'utf8'));
    // }
    //env.gui_port = newConfig.gui_port;
    //env.okuuai_port = newConfig.port;
    //createFrontendEnv(env);
};

// Update assistant.json's model field
const switchModel = async () => {
    const currentModel = loadAssistantConfig().model;

    const selectedModel: string = await search({
        message: `Select a model (${currentModel ? currentModel : "none"}):`,
        source: async (input, { signal }) => {
            if (!input) {
                return [];
            }

            const response = await fetch(
                `https://ollamadb.dev/api/v1/models?search=${encodeURIComponent(input)}`,
                { signal },
            );
            const data = await response.json();

            return data.models.map((model: any) => ({
                name: model.model_name,
                value: model.model_name,
            }));
        },
    });

    updateAssistantConfigJSON({ model: selectedModel });

    Core.model_name = selectedModel;

    Logger.INFO(`✅ Model updated to ${selectedModel}`);
}


// Assistant Configuration
if (require.main === module) {
    if (arg === undefined) {
        Logger.INFO(`Usage: npm run config [OVERRIDE | MODEL_OR]`);
        process.exit(0);
    }
}

if (arg === 'OVERRIDE') {
    initConfig(); // this will first check if there's an existing .env file, if not, it will start the interactive configuration
}

if (arg === 'MODEL_OR') {
    switchModel();
}