import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../logger';
import { getModulePreference } from './module-state.service';

const execFileAsync = promisify(execFile);
const SCREEN_NAME = 'okuuwhis';

const getServerScript = () => process.env.WHISPER_SERVER_SCRIPT || path.join(process.cwd(), 'services', 'whisper-asr', 'whisper_server.py');

const getPython = () => {
  if (process.env.WHISPER_PYTHON) return process.env.WHISPER_PYTHON;
  const localVenv = path.join(process.cwd(), 'services', 'whisper-asr', '.venv', 'bin', 'python');
  return fs.existsSync(localVenv) ? localVenv : 'python3';
};

const isHealthy = async () => {
  const baseUrl = (process.env.WHISPER_BASE_URL || 'http://127.0.0.1:8096').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
};

const screenExists = async () => {
  try {
    const { stdout } = await execFileAsync('screen', ['-ls']);
    return stdout.includes(`.${SCREEN_NAME}`);
  } catch {
    return false;
  }
};

export const getWhisperStatus = async () => ({
  healthy: await isHealthy(),
  processRunning: await screenExists(),
  endpoint: (process.env.WHISPER_BASE_URL || 'http://127.0.0.1:8096').replace(/\/$/, ''),
});

export async function startWhisperServer() {
  if (await isHealthy()) {
    Logger.DEBUG('Whisper ASR is already healthy.');
    return true;
  }

  const script = getServerScript();
  if (!fs.existsSync(script)) {
    Logger.WARN(`Whisper server script not found: ${script}`);
    return false;
  }

  if (await screenExists()) {
    try { await execFileAsync('screen', ['-S', SCREEN_NAME, '-X', 'quit']); } catch { /* stale session */ }
  }

  const child = spawn('screen', ['-dmS', SCREEN_NAME, getPython(), script], {
    cwd: path.dirname(script),
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (await isHealthy()) {
      Logger.INFO(`Whisper ASR started in screen session '${SCREEN_NAME}'.`);
      return true;
    }
  }
  Logger.WARN(`Whisper ASR did not become healthy. Inspect with: screen -r ${SCREEN_NAME}`);
  return false;
}

export async function stopWhisperServer() {
  if (await screenExists()) {
    await execFileAsync('screen', ['-S', SCREEN_NAME, '-X', 'quit']);
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (!await isHealthy()) return true;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return !await isHealthy();
}

export async function ensureWhisperServer() {
  if (getModulePreference('okuu-whisper')?.enabled === false) return;
  if ((process.env.WHISPER_AUTOSTART || 'true').toLowerCase() === 'false') return;
  await startWhisperServer();
}
