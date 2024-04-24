import fs from 'fs';
import path from 'path';

export class Logger {
    private static logFilePath = path.join(__dirname, '..', 'logs', 'log.txt');
    private static settings = {
        log: true,
        logToFile: false,
        debug: true,
        initialized: false
    };

    private static initializeLogFile() {
        if (!fs.existsSync(path.dirname(Logger.logFilePath))) {
            console.log('Creating logs directory...');
            fs.mkdirSync(path.dirname(Logger.logFilePath), { recursive: true });
        }


        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const initialLog = `----------------- ${formattedDate} -----------------`;
        fs.appendFileSync(Logger.logFilePath, initialLog + '\n');
    }
    private static appendToLogFile(message: string) {
        if (!Logger.settings.logToFile) return;

        if (!Logger.settings.initialized) {
            Logger.initializeLogFile();
            Logger.settings.initialized = true;
        }

        fs.appendFileSync(Logger.logFilePath, message + '\n');
    }

    static DEBUG(message: string) {
        if (!Logger.settings.log) return;
        if (!Logger.settings.debug) return;
        Logger.appendToLogFile('[DEBUG] ' + message);
        console.log('\x1b[32m[DEBUG]\x1b[0m ' + message);
    }

    static INFO(message: string) {
        if (!Logger.settings.log) return;
        Logger.appendToLogFile('[INFO] ' + message);
        console.log('\x1b[34m[INFO]\x1b[0m ' + message);
    }

    static WARN(message: string) {
        if (!Logger.settings.log) return;
        Logger.appendToLogFile('[WARN] ' + message);
        console.warn('\x1b[33m[WARN]\x1b[0m ' + message);
    }

    static ERROR(message: string) {
        if (!Logger.settings.log) return;
        Logger.appendToLogFile('[ERROR] ' + message);
        console.error('\x1b[31m[ERROR]\x1b[0m ' + message);
    }
}