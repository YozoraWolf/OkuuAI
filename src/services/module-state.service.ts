import fs from 'fs';
import path from 'path';

type StoredModuleState = Record<string, { enabled: boolean; updatedAt: number }>;
const statePath = path.join(process.cwd(), 'storage', 'modules.json');

const readState = (): StoredModuleState => {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return {};
  }
};

export const getModulePreference = (id: string) => readState()[id];

export const setModulePreference = (id: string, enabled: boolean) => {
  const state = readState();
  state[id] = { enabled, updatedAt: Date.now() };
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(state, null, 2));
  fs.renameSync(temporaryPath, statePath);
  return state[id];
};
