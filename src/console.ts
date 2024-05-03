import readline from 'readline';
//import { sendChat } from './ollama_bridge.ts.old';
/* import { Logger } from './logger';
import { Core } from './core'; */
import { stdout } from 'process';

const reprompt = () => {
    //Logger.DEBUG('Prompting user...');
    stdout.write('\n');
    rl.setPrompt('> ');
    rl.prompt();
};

/* const clearLine = () => {
    stdout.clearLine(0);
    stdout.cursorTo(0);
} */

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

reprompt();

/* const handleUserInput = async (line: string) => {
    // possibly handle chats
    let msg = '';
    let multiline = false;

    const resp: any = await sendChat(line.trim(), (data: string) => {
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

    //if (!Core.ollama_settings.stream)
        //console.log('\x1b[32mOkuu:\x1b[0m ' + resp.message.content);
} */

/* rl.on('line', async (line: string) => {
    if (line.trim().startsWith('/')) {
        handleCommand(line.trim());
    } else {
        await handleUserInput(line);
    }
    reprompt();
}).on('close', () => {
    Logger.INFO('Bye!');
    process.exit(0);
});

function handleCommand(command: string) {
    // handle commands
    switch (command) {
        case '/help':
            Logger.INFO(`${Core.chat_settings.prefix}: Displaying help...`);
            break;
        case '/exit':
            rl.close();
            break;
        default:
            Logger.INFO(`${Core.chat_settings.prefix}: Command not recognized!`);
            break;
    }
} */

// keep the script running indefinitely
process.stdin.resume();