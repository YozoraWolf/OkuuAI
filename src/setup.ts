import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { createEnvFile, createSettingsFile, defaultAssistantConfig, defaultConfigAI, type Config } from './config';
import { setupDatabase } from './db/user.db';

export type SetupPayload = {
    admin: {
        username: string;
        password: string;
    };
    assistant?: {
        name?: string;
        system_prompt?: string;
        model?: string;
        inference_provider?: string;
        tool_llm?: string;
        template?: string;
        global_memory?: boolean;
        think?: boolean;
    };
    runtime?: Partial<Config>;
    logging?: {
        enabled?: boolean;
        debug?: boolean;
        maxFileSizeMb?: number;
    };
};

export const getSetupState = () => {
    const envExists = fs.existsSync('.env');
    const assistantExists = fs.existsSync('assistant.json');
    const settingsExists = fs.existsSync('settings.json');
    const envJwtSecret = envExists ? fs.readFileSync('.env', 'utf8').match(/^JWT_SECRET=(.+)$/m)?.[1]?.trim() : '';
    const hasJwtSecret = Boolean(process.env.JWT_SECRET || envJwtSecret);

    return {
        setupRequired: !envExists || !assistantExists || !settingsExists || !hasJwtSecret,
        envExists,
        assistantExists,
        settingsExists,
        hasJwtSecret,
        defaults: {
            assistant: defaultAssistantConfig,
            runtime: defaultConfigAI
        }
    };
};

const upsertAdmin = async (username: string, password: string) => {
    const db = await setupDatabase() as sqlite3.Database;
    const hashedPassword = await bcrypt.hash(password, 10);

    return new Promise<void>((resolve, reject) => {
        db.get('SELECT id FROM users WHERE username = ?', [username], (getErr, row: any) => {
            if (getErr) return reject(getErr);

            if (row) {
                db.run(
                    'UPDATE users SET password = ?, role = ?, mustChangePassword = 0 WHERE id = ?',
                    [hashedPassword, 'Admin', row.id],
                    (updateErr) => updateErr ? reject(updateErr) : resolve()
                );
                return;
            }

            db.run(
                'INSERT INTO users (username, password, role, mustChangePassword) VALUES (?, ?, ?, 0)',
                [username, hashedPassword, 'Admin'],
                (insertErr) => insertErr ? reject(insertErr) : resolve()
            );
        });
    });
};

export const completeSetup = async (payload: SetupPayload) => {
    if (!payload.admin?.username?.trim() || !payload.admin?.password) {
        throw new Error('Admin username and password are required');
    }

    if (payload.admin.password.length < 8) {
        throw new Error('Admin password must be at least 8 characters');
    }

    const provider = payload.assistant?.inference_provider || payload.runtime?.llm_provider || 'ollama';
    const selectedModel = provider === 'custom'
        ? payload.runtime?.llm_model || payload.assistant?.model || ''
        : payload.assistant?.model || payload.runtime?.ollama_default_model || defaultConfigAI.ollama_default_model;

    const assistant = {
        ...defaultAssistantConfig,
        ...payload.assistant,
        model: selectedModel,
        inference_provider: provider,
    };

    const runtime: Config = {
        ...defaultConfigAI,
        ...payload.runtime,
        ai_name: assistant.name || payload.runtime?.ai_name || defaultConfigAI.ai_name,
        system: assistant.system_prompt || payload.runtime?.system || defaultConfigAI.system,
        model_name: selectedModel || payload.runtime?.model_name || defaultConfigAI.model_name,
        ollama_default_model: provider === 'ollama' ? selectedModel : payload.runtime?.ollama_default_model || defaultConfigAI.ollama_default_model,
        llm_provider: provider,
        llm_model: selectedModel,
        llm_base_url: payload.runtime?.llm_base_url || defaultConfigAI.llm_base_url,
        llm_api_key: payload.runtime?.llm_api_key || defaultConfigAI.llm_api_key,
        jwt_secret: payload.runtime?.jwt_secret || crypto.randomBytes(32).toString('hex'),
    };

    await createEnvFile(runtime, { overwriteFrontend: true });
    fs.writeFileSync('assistant.json', JSON.stringify(assistant, null, 2), { encoding: 'utf8', flag: 'w' });
    await createSettingsFile({
        logs: {
            log: payload.logging?.enabled ?? true,
            logToFile: payload.logging?.enabled ?? true,
            debug: payload.logging?.debug ?? true,
            maxFileSize: (payload.logging?.maxFileSizeMb || 5) * 1024 * 1024
        }
    });
    await upsertAdmin(payload.admin.username.trim(), payload.admin.password);

    process.env.JWT_SECRET = runtime.jwt_secret;
    process.env.PORT = String(runtime.port || defaultConfigAI.port);

    return getSetupState();
};
