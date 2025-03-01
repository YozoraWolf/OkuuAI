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
    private static logFilePath = path.join(__dirname, '..', 'logs', `Log_${new Date().toISOString().replace(/T/, '_').replace(/:/g, '').replace(/\..+/, '')}.txt`);
    private static settings = {
        log: true,
        logToFile: false,
        debug: true,
        initialized: false,
        maxFileSize: 5 * 1024 * 1024 // 5MB default
    };

    static loadSettings() {
        const settingsPath = path.join(__dirname, '..', 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (settings.logs) {
                Logger.settings = { ...Logger.settings, ...settings.logs };
            }
        }
    }

    static removeColorCodes(message: string): string {
        for (const color in ConsoleColor) {
            if (message.includes(ConsoleColor[color])) {
                message = message.replace(ConsoleColor[color], '');
            }
        }
        return message;
    }

    static LogRateAlertToFile(level: string, req: any) {
        const currentDate = new Date();
        const formattedDate = currentDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const logPrefix = `[${formattedDate}] `;
        const message = `${logPrefix} ${level.toUpperCase()} Rate limit exceeded for IP: ${req.ip}`;
        Logger.appendToLogFile(message);
    }
    
    private static initializeLogFile() {
        if (!fs.existsSync(path.dirname(Logger.logFilePath))) {
            Logger.INFO('Creating logs directory...');
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

        if (fs.existsSync(Logger.logFilePath) && fs.statSync(Logger.logFilePath).size >= Logger.settings.maxFileSize) {
            const logDir = path.dirname(Logger.logFilePath);
            const logBaseName = path.basename(Logger.logFilePath, '.txt');
            const logFiles = fs.readdirSync(logDir).filter(file => file.startsWith(logBaseName));
            const logIndex = logFiles.length;
            Logger.logFilePath = path.join(logDir, `${logBaseName}_${logIndex}.txt`);
            Logger.initializeLogFile();
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

Logger.loadSettings();