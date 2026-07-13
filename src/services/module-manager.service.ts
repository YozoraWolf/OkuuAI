import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { getWhisperStatus, startWhisperServer, stopWhisperServer } from './whisper-process.service';
import { getModulePreference, setModulePreference } from './module-state.service';
import { Logger } from '../logger';
import { ConversationRuntime } from '../modules/conversation/conversation.runtime';

const execFileAsync = promisify(execFile);
export type ModuleState = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  available: boolean;
  status: 'online' | 'offline' | 'degraded' | 'unavailable' | 'enabling' | 'disabling';
  detail: string;
  endpoint?: string;
  lastChangedAt?: number;
};

const screenExists = async (name: string) => {
  try {
    const { stdout } = await execFileAsync('screen', ['-ls']);
    return stdout.includes(`.${name}`);
  } catch {
    return false;
  }
};

const commandExists = async (command: string) => {
  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
};

const checkEndpoint = async (url?: string) => {
  if (!url) return undefined;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500), redirect: 'follow' });
    return response.ok;
  } catch {
    return false;
  }
};

export class ModuleManager {
private readonly transitions = new Map<string, 'enabling' | 'disabling'>();
private readonly lastChangedAt = new Map<string, number>();

constructor(private readonly conversationRuntime: ConversationRuntime) {}

private getOkuuClawStatus = async (): Promise<ModuleState> => {
  const command = process.env.OKUUCLAW_COMMAND || 'okuuclaw';
  const session = process.env.OKUUCLAW_SCREEN_NAME || 'okuuclaw';
  const endpoint = process.env.OKUUCLAW_HEALTH_URL || 'http://127.0.0.1:18800/health';
  const [available, processRunning, healthy] = await Promise.all([
    commandExists(command),
    screenExists(session),
    checkEndpoint(endpoint),
  ]);
  const preference = getModulePreference('okuu-claw');
  const transition = this.transitions.get('okuu-claw');
  const status = transition || (!available ? 'unavailable' : processRunning && healthy !== false ? 'online' : processRunning ? 'degraded' : 'offline');
  return {
    id: 'okuu-claw',
    name: 'OkuuClaw',
    description: 'Messaging gateway and assistant integrations.',
    enabled: preference?.enabled ?? processRunning,
    available,
    status,
    detail: !available ? `Command not found: ${command}` : processRunning ? healthy === false ? 'Process is running but health check failed' : 'Gateway is running' : 'Gateway is stopped',
    endpoint,
    lastChangedAt: preference?.updatedAt ?? this.lastChangedAt.get('okuu-claw'),
  };
};

private getOkuuWhisperStatus = async (): Promise<ModuleState> => {
  const whisper = await getWhisperStatus();
  const preference = getModulePreference('okuu-whisper');
  const transition = this.transitions.get('okuu-whisper');
  return {
    id: 'okuu-whisper',
    name: 'OkuuWhisper',
    description: 'Local speech-to-text transcription service.',
    enabled: preference?.enabled ?? whisper.processRunning,
    available: true,
    status: transition || (whisper.healthy ? 'online' : whisper.processRunning ? 'degraded' : 'offline'),
    detail: whisper.healthy ? 'Transcription server is healthy' : whisper.processRunning ? 'Process is running but health check failed' : 'Transcription server is stopped',
    endpoint: whisper.endpoint,
    lastChangedAt: preference?.updatedAt ?? this.lastChangedAt.get('okuu-whisper'),
  };
};

private getConversationStatus = async (): Promise<ModuleState> => {
  const preference = getModulePreference('conversation-mode');
  const transition = this.transitions.get('conversation-mode');
  const active = this.conversationRuntime.isActive();
  return {
    id: 'conversation-mode',
    name: 'Conversation Mode',
    description: 'Live voice and shared-screen collaboration workspace.',
    enabled: preference?.enabled ?? active,
    available: true,
    status: transition || (active ? 'online' : 'offline'),
    detail: active ? 'Conversation runtime is accepting sessions' : 'Conversation runtime is disabled',
    lastChangedAt: preference?.updatedAt ?? this.lastChangedAt.get('conversation-mode'),
  };
};

private get moduleStatus() {
  return {
    'okuu-claw': this.getOkuuClawStatus,
    'okuu-whisper': this.getOkuuWhisperStatus,
    'conversation-mode': this.getConversationStatus,
  };
}

getModules() {
  return Promise.all(Object.values(this.moduleStatus).map(getStatus => getStatus()));
}

async setModuleEnabled(id: string, enabled: boolean) {
  if (!(id in this.moduleStatus)) throw new Error('Unknown module');
  if (this.transitions.has(id)) throw new Error('Module transition already in progress');
  this.transitions.set(id, enabled ? 'enabling' : 'disabling');

  try {
    let success = false;
    if (id === 'conversation-mode') {
      await (enabled ? this.conversationRuntime.start() : this.conversationRuntime.stop());
      success = this.conversationRuntime.isActive() === enabled;
    } else if (id === 'okuu-whisper') {
      success = enabled ? await startWhisperServer() : await stopWhisperServer();
    } else {
      const session = process.env.OKUUCLAW_SCREEN_NAME || 'okuuclaw';
      if (enabled) {
        if (await screenExists(session)) {
          success = true;
        } else {
          const command = process.env.OKUUCLAW_COMMAND || 'okuuclaw';
          const child = spawn('screen', ['-dmS', session, command, '--no-color', 'gateway'], {
            detached: true,
            env: process.env,
            stdio: 'ignore',
          });
          child.unref();
          for (let attempt = 0; attempt < 20; attempt += 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (await screenExists(session)) {
              success = true;
              break;
            }
          }
        }
      } else if (!await screenExists(session)) {
        success = true;
      } else {
        await execFileAsync('screen', ['-S', session, '-X', 'quit']);
        success = !await screenExists(session);
      }
    }

    if (!success) throw new Error(`Failed to ${enabled ? 'enable' : 'disable'} module`);
    this.lastChangedAt.set(id, Date.now());
    setModulePreference(id, enabled);
  } finally {
    this.transitions.delete(id);
  }

  const statuses = this.moduleStatus;
  return statuses[id as keyof typeof statuses]();
}

async reconcileModules() {
  for (const id of Object.keys(this.moduleStatus)) {
    const preference = getModulePreference(id);
    if (!preference) continue;
    const statuses = this.moduleStatus;
    const status = await statuses[id as keyof typeof statuses]();
    const running = status.status === 'online' || status.status === 'degraded';
    if (running !== preference.enabled) {
      try {
        await this.setModuleEnabled(id, preference.enabled);
      } catch (error) {
        Logger.WARN(`Unable to reconcile module ${id}: ${error}`);
      }
    }
  }
}
}
