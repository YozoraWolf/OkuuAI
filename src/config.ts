import readline from 'readline';
import fs from 'fs';
import { Logger } from './logger';
import chalk from 'chalk';

// Load OVERRIDE if present in arguments
const arg = process.argv[2];

// TODO: Set VITE configs too like frontend port, etc.
interface Config {
    [key: string]: string | number;
}

const defaultConfigAI: Config = {
    model_url: "https://huggingface.co/MaziyarPanahi/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q6_K.gguf?download=true",
    model_path: "/usr/share/ollama/.ollama/models/okuu/",
    port: 3009,
    URL: "http://localhost",
    redis_port: 6009,
    redis_pwd: "1234",
    front_port: 8009
};

let currentConfig: Config = {};
const newConfig: Config = {};

const configName: Config = {
    model_url: "Model URL",
    model_path: "Model Path",
    port: "Port",
    URL: "OkuuAI URL",
    redis_port: "Redis Port",
    redis_pwd: "Redis Password",
    front_port: "Frontend Port",
};

let rl: readline.Interface;

export const initConfig = () => new Promise<void>((resolve) => {

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
        const env = fs.readFileSync('.env', 'utf8');
        const envLines = env.split('\n');
        for (const line of envLines) {
            if (line.trim() === '') {
                continue;
            }
            const [key, ...values] = line.split('=');
            const value = values.join('=');
            const lowercaseKey = key.toLowerCase();
            currentConfig[lowercaseKey] = value; // Store the key-value pair in the object with lowercase key
            process.env[lowercaseKey] = value;
        }
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

    try {
        createEnvFile(newConfig);
    } catch (error) {
        Logger.ERROR(`Failed to create .env file\n${error}`);
        exitConfig(1);
    }

    rl.close();
    exitConfig(0);
};


