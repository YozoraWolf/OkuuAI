import { ChildProcess, SpawnOptions, exec, spawn } from "child_process";
import { Logger } from "./logger";

let tauriProc: ChildProcess;

const debug = false;

const defaultConfig: SpawnOptions = debug ? { stdio: 'inherit' } : { stdio: 'ignore', detached: true };

export const initTauri = () => {
    tauriProc = spawn('tauri', ['dev'], defaultConfig);

    tauriProc.on('exit', (code: number) => {
        //process.exit(code);
        killTauri();
    });

    Logger.INFO('GUI started successfully!');

    return tauriProc;
};

export const killTauri = () => {
    const res = exec('pkill -f "(?=.*okuuai)(?=.*tauri)"');
    if (res) {
        Logger.DEBUG('GUI killed successfully!');
    } else  {
        Logger.ERROR(`Failed to kill GUI!\nError: ${res}`);
    }
};