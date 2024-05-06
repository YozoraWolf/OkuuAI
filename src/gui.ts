import { ChildProcess, exec, spawn } from "child_process";
import { Logger } from "./logger";

let tauriProc: ChildProcess;

export const initTauri = () => {
    tauriProc = spawn('tauri', ['dev'], {
        detached: true,
        stdio: 'ignore'
    });

    tauriProc.on('exit', (code: number) => {
        //process.exit(code);
    });

    Logger.INFO('GUI started successfully!');

    return tauriProc;
};