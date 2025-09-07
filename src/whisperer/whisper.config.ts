import path from "path";
import fs from "fs";
import wav from "wav";
import { execSync } from "child_process";
import { Logger } from "@src/logger";

export const WHISPER_BASE_DIR = path.resolve("./whisper_cpp");
export const MODELS_DIR = path.join(WHISPER_BASE_DIR, "models");
export const TMP_DIR = "/tmp/okuuai";

export type Language = 'en' | 'ja' | 'es';
export const MODEL_MAP: Record<string, string> = {
    en: path.join(MODELS_DIR, "ggml-base.en.bin"),
};

export let WHISPER_BINARY: string;

export function ensureWhisperSetup() {
    try {
        // 1️⃣ Clone whisper.cpp if missing
        if (!fs.existsSync(WHISPER_BASE_DIR)) {
            Logger.INFO("Cloning whisper.cpp...");
            execSync(`git clone https://github.com/ggerganov/whisper.cpp ${WHISPER_BASE_DIR}`, { stdio: "inherit" });
            Logger.INFO("whisper.cpp cloned successfully");
        } else {
            Logger.DEBUG("whisper.cpp already exists, skipping clone");
        }

        // 2️⃣ Detect or build binary
        const mainBinaryCandidates = [
            path.join(WHISPER_BASE_DIR, "main"),          // old
            path.join(WHISPER_BASE_DIR, "build", "main"),
            path.join(WHISPER_BASE_DIR, "build", "Release", "main"),
            path.join(WHISPER_BASE_DIR, "build", "bin"),
            path.join(WHISPER_BASE_DIR, "build", "bin", "whisper-cli") // most likely
        ];

        WHISPER_BINARY = mainBinaryCandidates.find(p => fs.existsSync(p)) || "";
        if (!WHISPER_BINARY) {
            throw new Error("No binary found! Did you build whisper.cpp?");
        }
        Logger.INFO("Whisper binary: " + WHISPER_BINARY);

        if (!fs.existsSync(path.join(WHISPER_BASE_DIR, "build", "bin", "whisper-cli"))) {
            Logger.INFO("Building whisper.cpp...");
            execSync(`cd ${WHISPER_BASE_DIR} && make whisper-cli`, { stdio: "inherit" });
        }

        // 3️⃣ Download models
        if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

        for (const [lang, modelPath] of Object.entries(MODEL_MAP)) {
            if (!fs.existsSync(modelPath)) {
                Logger.INFO(`Downloading model for ${lang}...`);
                execSync(`cd ${WHISPER_BASE_DIR} && ./models/download-ggml-model.sh base.en`, { stdio: "inherit" });

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