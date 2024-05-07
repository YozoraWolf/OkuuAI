import { ChildProcess, SpawnOptions, exec, spawn } from "child_process";
import { Logger } from "./logger";
import { promisify } from "util";

let tauriProc: ChildProcess;

const debug = false;

const defaultConfig: SpawnOptions = debug ? { stdio: 'inherit' } : { stdio: 'ignore', detached: true };

export const initTauri = () => {
    tauriProc = spawn('tauri', ['dev'], defaultConfig);

    tauriProc.on('exit', () => {
        //process.exit(code);
        killTauri();
    });

    Logger.INFO('GUI started successfully!');

    return tauriProc;
};

export const killTauri = async () => {
    const execAsync = promisify(exec);
    try {
        // Get the PIDs of processes that contain 'okuuai' and 'tauri' in their command
        const { stdout } = await execAsync('ps aux | grep -E "okuuai.*tauri|tauri.*okuuai|okuuai.*vite|vite.*okuuai" | grep -v grep | awk \'{print $2}\'');

        // Split the output by newlines and remove any empty lines
        const pids = stdout.split('\n').filter(pid => pid.trim() !== '');

        // Terminate each related process
        for (const pid of pids) {
            await execAsync(`kill -9 ${pid}`);
        }

        Logger.DEBUG('GUI killed successfully!');
    } catch (error) {
        Logger.ERROR(`Failed to kill GUI: ${error}`);
    }
};