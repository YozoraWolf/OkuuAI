import { input, select } from "@inquirer/prompts";
import axios from "axios";
import cliProgress from "cli-progress";
import path from "path";
import fs from "fs";
import os from "os";
import { Logger } from "@src/logger";

export const WHISPER_BASE_DIR = path.join(__dirname, "..", "bin/whisper");
export const MODELS_DIR = path.join(WHISPER_BASE_DIR, "models");
export let WHISPER_BINARY: string;
export const MODEL_MAP: Record<string, string> = {
    en: path.join(MODELS_DIR, "ggml-base.en.bin"),
};

/**
 * Interactively download a Whisper model using direct HTTP download.
 * Prompts the user for a model name and downloads it to the models directory.
 */
export async function downloadModelInteractive(modelName?: string) {
    const availableModels = [
        "tiny", "tiny.en", "tiny-q5_1", "tiny.en-q5_1", "tiny-q8_0",
        "base", "base.en", "base-q5_1", "base.en-q5_1", "base-q8_0",
        "small", "small.en", "small.en-tdrz", "small-q5_1", "small.en-q5_1", "small-q8_0",
        "medium", "medium.en", "medium-q5_0", "medium.en-q5_0", "medium-q8_0",
        "large-v1", "large-v2", "large-v2-q5_0", "large-v2-q8_0",
        "large-v3", "large-v3-q5_0", "large-v3-turbo", "large-v3-turbo-q5_0", "large-v3-turbo-q8_0"
    ];

    let model = modelName;
    if (!model) {
        model = await select({
            message: "Select a Whisper model to download:",
            choices: availableModels.map(m => ({ name: m, value: m })),
            default: "base.en"
        });
    }

    Logger.INFO(`Downloading model '${model}' to ${MODELS_DIR}...`);
    try {
        // Ensure models directory exists
        if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

        // Determine source URL (handle tdrz special case)
        let src = "https://huggingface.co/ggerganov/whisper.cpp";
        let pfx = "resolve/main/ggml";
        if (model.includes("tdrz")) {
            src = "https://huggingface.co/akashmjn/tinydiarize-whisper.cpp";
        }
        const url = `${src}/${pfx}-${model}.bin`;
        const modelPath = path.join(MODELS_DIR, `ggml-${model}.bin`);

        if (fs.existsSync(modelPath)) {
            Logger.INFO(`Model '${model}' already exists at ${modelPath}. Skipping download.`);
            return;
        }

        // Download the file using axios and show progress bar
        const writer = fs.createWriteStream(modelPath);
        const response = await axios.get(url, { responseType: 'stream' });
        const totalLength = Number(response.headers['content-length']);
        const progressBar = new cliProgress.SingleBar({
            format: 'Downloading [{bar}] {percentage}% | {value}/{total} bytes',
        }, cliProgress.Presets.shades_classic);
        let downloaded = 0;
        progressBar.start(totalLength, 0);
        response.data.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            progressBar.update(downloaded);
        });
        await new Promise((resolve, reject) => {
            response.data.pipe(writer);
            let error: any = null;
            writer.on('error', err => {
                error = err;
                writer.close();
                progressBar.stop();
                reject(err);
            });
            writer.on('close', () => {
                progressBar.stop();
                if (!error) resolve(null);
            });
        });

        if (fs.existsSync(modelPath)) {
            Logger.INFO(`Model '${model}' downloaded successfully: ${modelPath}`);
        } else {
            Logger.ERROR(`Model download failed or file not found: ${modelPath}`);
        }
    } catch (err: any) {
        Logger.ERROR(`Failed to download model '${model}': ${err.message}`);
    }
}

// Returns the system's temporary directory
export function getSystemTmpDir(): string {
    return os.tmpdir();
}

export async function ensureWhisperSetup() {
    try {
        if (!fs.existsSync(WHISPER_BASE_DIR)) fs.mkdirSync(WHISPER_BASE_DIR, { recursive: true });

        // Pick the right binary path for the platform (prebuilt, no build step)
        const platform = os.platform();
        let binaryPath = "";
        if (platform === "win32") {
            binaryPath = path.join(WHISPER_BASE_DIR, "whisper-stream.exe");
        } else if (platform === "linux") {
            binaryPath = path.join(WHISPER_BASE_DIR, "whisper-stream");
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }


        // Check if the binary exists
        if (!fs.existsSync(binaryPath)) {
            Logger.ERROR(`Whisper binary not found for platform '${platform}'. Please pull the latest release or ensure the binary exists at: ${binaryPath}`);
            throw new Error("Whisper binary missing");
        }

        WHISPER_BINARY = binaryPath;
        Logger.INFO("Whisper binary: " + WHISPER_BINARY);

        // Models logic remains unchanged
        if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

        for (const [lang, modelPath] of Object.entries(MODEL_MAP)) {
            if (!fs.existsSync(modelPath)) {
                Logger.INFO(`Model for ${lang} not found. Initiating download...`);
                await downloadModelInteractive(lang === 'en' ? 'base.en' : lang);
                if (!fs.existsSync(modelPath)) throw new Error(`Model download failed for ${lang}`);
                Logger.INFO(`Model for ${lang} downloaded successfully`);
            } else {
                Logger.DEBUG(`Model for ${lang} already exists, skipping download`);
            }
        }

        Logger.INFO("Whisper setup completed successfully");

    } catch (err: any) {
        Logger.ERROR("Error setting up Whisper: " + err.message);
        Logger.ERROR(err.stack);
        throw err;
    }
}