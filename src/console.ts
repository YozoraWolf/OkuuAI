import readline from 'readline';
import { Logger } from './logger';
import { Core } from './core';
import { stdout } from 'process';
import { sendChat } from './chat';
import { handleCommand } from './commands';

const reprompt = () => {
    //Logger.DEBUG('Prompting user...');
    stdout.write('\n');
    rl.setPrompt('> ');
    rl.prompt();
};


const history: string | any[] = [];
let historyIndex = -1;

const clearLine = () => {
    stdout.clearLine(0);
    stdout.cursorTo(0);
};

readline.emitKeypressEvents(process.stdin);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

reprompt();

const handleUserInput = async (line: string) => {
    // possibly handle chats
    let msg = '';
    let multiline = false;

    const resp: any = await sendChat(line.trim(), (data: string) => {
        //Logger.DEBUG(`Received data: ${data}`);
        // process data chunk
        msg += data;

        const terminalWidth = process.stdout.columns;
        const prefixLength = Core.chat_settings.prefix.length;

        // calculate the effective width by subtracting the length of the prefix
        const effectiveWidth = terminalWidth - prefixLength;

        // write buffer, if it exceeds a line (multiline), do not include prefix.
        clearLine();
        stdout.write(`${!multiline ? Core.chat_settings.prefix + " " : ""}${msg.trim()}`);

        // break if the message is too long or contains a newline
        if (msg.includes('\n') || msg.length >= effectiveWidth) {
            stdout.write('\n');
            msg = ''; // clear the message after starting new line
            multiline = true;
        }
    });

    if (!Core.ollama_settings.stream)
        console.log('\x1b[32mOkuu:\x1b[0m ' + resp);
};

rl.on('line', async (line: string) => {
    if (line.trim().startsWith('/')) {
        await handleCommand(line.trim());
    } else {
        await handleUserInput(line);
    }

    // Push latest input
    history.push(line);
    historyIndex = history.length - 1;
    reprompt();
}).on('close', () => {
    Logger.INFO('Bye!');
    process.exit(0);
});

// TODO: Work on history navigation
process.stdin.on('keypress', (char, key) => {
    if (key.name === 'up' && historyIndex > 0) {
        historyIndex--;
        rl.write(history[historyIndex]);
    } else if (key.name === 'down' && historyIndex < history.length - 1) {
        historyIndex++;
        rl.write(history[historyIndex]);
    } else if (key.name === 'q') {
        Logger.INFO('Bye!');
        process.exit(0);
    }
});

// keep the script running indefinitely
//process.stdin.setRawMode(true);
process.stdin.resume();