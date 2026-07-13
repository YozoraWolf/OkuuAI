import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../logger';
import { getModulePreference } from './module-state.service';

const execFileAsync = promisify(execFile);
const SCREEN_NAME = 'okuuwhis';
const LOG_PATH = path.join(process.cwd(), 'logs', 'whisper-asr.log');

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

  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, '');
  const child = spawn('screen', ['-L', '-Logfile', LOG_PATH, '-dmS', SCREEN_NAME, getPython(), script], {
    cwd: path.dirname(script),
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const timeoutMs = Number(process.env.WHISPER_START_TIMEOUT_MS || 300000);
  const attempts = Math.max(1, Math.ceil(timeoutMs / 1000));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (await isHealthy()) {
      Logger.INFO(`Whisper ASR started in screen session '${SCREEN_NAME}'.`);
      return true;
    }
    if (!await screenExists()) {
      const output = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, 'utf8').trim() : '';
      Logger.WARN(`Whisper ASR exited during startup${output ? `: ${output}` : `; inspect ${LOG_PATH}`}`);
      return false;
    }
  }
  Logger.WARN(`Whisper ASR did not become healthy within ${timeoutMs}ms. Inspect ${LOG_PATH}`);
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
