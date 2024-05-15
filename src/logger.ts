import fs from 'fs';
import path from 'path';

interface ConsoleColorMap {
    [key: string]: string;
}

export const ConsoleColor: ConsoleColorMap = {
    FgBlack: '\x1b[30m',
    FgRed: '\x1b[31m',
    FgGreen: '\x1b[32m',
    FgYellow: '\x1b[33m',
    FgBlue: '\x1b[34m',
    FgMagenta: '\x1b[35m',
    FgCyan: '\x1b[36m',
    FgWhite: '\x1b[37m',
    BgBlack: '\x1b[40m',
    BgRed: '\x1b[41m',
    BgGreen: '\x1b[42m',
    BgYellow: '\x1b[43m',
    BgBlue: '\x1b[44m',
    BgMagenta: '\x1b[45m',
    BgCyan: '\x1b[46m',
    BgWhite: '\x1b[47m',
    Reset: '\x1b[0m',
    Bright: '\x1b[1m',
    Dim: '\x1b[2m',
    Underscore: '\x1b[4m',
    Blink: '\x1b[5m',
    Reverse: '\x1b[7m',
    Hidden: '\x1b[8m'
};

export class Logger {
    private static logFilePath = path.join(process.cwd(), '..', 'logs', 'log.txt');
    private static settings = {
        log: true,
        logToFile: false,
        debug: true,
        initialized: false
    };

    static removeColorCodes(message: string): string {
        for (const color in ConsoleColor) {
            if (message.includes(ConsoleColor[color])) {
                message = message.replace(ConsoleColor[color], '');
            }
        }
        return message;
    }
    
    private static initializeLogFile() {
        if (!fs.existsSync(path.dirname(Logger.logFilePath))) {
            console.log('Creating logs directory...');
            fs.mkdirSync(path.dirname(Logger.logFilePath), { recursive: true });
        }


        const currentDate = new Date();
        const formattedDate = currentDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const initialLog = `----------------- ${formattedDate} -----------------`;
        fs.appendFileSync(Logger.logFilePath, initialLog + '\n');
    }
    private static appendToLogFile(message: string) {
        if (!Logger.settings.logToFile) return;

        if (!Logger.settings.initialized) {
            Logger.initializeLogFile();
            Logger.settings.initialized = true;
        }

        const currentDate = new Date();
        const formattedDate = currentDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const logPrefix = `[${formattedDate}] `;
        message = this.removeColorCodes(message);
        message = `${logPrefix} ${message}`;



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