import readline from 'readline';
import { Logger } from './logger';
import { Core } from './core';
import { stdout } from 'process';
import { ChatMessage, getMessagesCount, incrementMessagesCount, sendChat } from './chat';
import { handleCommand } from './commands';
import { killTauri } from './gui';
import { sendChatRAG } from './langchain/rag/rag';

let rl: readline.Interface;

export const reprompt = async () => new Promise<string>((resolve) => {
    //Logger.DEBUG('Prompting user...');

    if (rl === undefined) {
        Logger.ERROR('Readline interface is not initialized');
        return;
    };

    rl.on('line', async (line: string) => {
        resolve(line);
    }).on('close', () => {
        exitOkuuAI();
    });

    stdout.write('\n');
    rl.setPrompt('> ');
    rl.prompt();
});

const clearLine = () => {
    stdout.clearLine(0);
    stdout.cursorTo(0);
};



export const handleUserInput = async (line: string, msg?: ChatMessage, ctxFile?: string) => {
    // possibly handle chats
    let multiline = false;

    let id = getMessagesCount();

    if (msg === undefined) {
        id = incrementMessagesCount(); // increment the message count and assign it to the id
        msg = {
            id,
            type: 'user',
            content: line,
            done: false
        };
    } else {
        incrementMessagesCount(); // else just increment the message count
    }

    let reply = '';

    let resp: any;
    if (ctxFile === undefined || ctxFile === '') {
        resp = await sendChat(msg, (data: string) => {
            //Logger.DEBUG(`Received data: ${data}`);
            // process data chunk
            reply += data;

            const terminalWidth = process.stdout.columns;
            const prefixLength = Core.chat_settings.prefix.length;

            // calculate the effective width by subtracting the length of the prefix
            const effectiveWidth = terminalWidth - prefixLength;

            // write buffer, if it exceeds a line (multiline), do not include prefix.
            clearLine();
            stdout.write(`${!multiline ? Core.chat_settings.prefix + " " : ""}${reply.trim()}`);

            // break if the message is too long or contains a newline
            if (reply.includes('\n') || reply.length >= effectiveWidth) {
                stdout.write('\n');
                reply = ''; // clear the message after starting new line
                multiline = true;
            }
        });
    } else {
        resp = await sendChatRAG(msg, ctxFile, (data: string) => {
            //Logger.DEBUG(`Received data: ${data}`);
            // process data chunk
            reply += data;

            const terminalWidth = process.stdout.columns;
            const prefixLength = Core.chat_settings.prefix.length;

            // calculate the effective width by subtracting the length of the prefix
            const effectiveWidth = terminalWidth - prefixLength;

            // write buffer, if it exceeds a line (multiline), do not include prefix.
            clearLine();
            stdout.write(`${!multiline ? Core.chat_settings.prefix + " " : ""}${reply.trim()}`);

            // break if the message is too long or contains a newline
            if (reply.includes('\n') || reply.length >= effectiveWidth) {
                stdout.write('\n');
                reply = ''; // clear the message after starting new line
                multiline = true;
            }
        });
    }
    //Logger.DEBUG(`Response: ${JSON.stringify(resp)}`);

    if (!Core.ollama_settings.stream)
        console.log('\x1b[32mOkuu:\x1b[0m ' + resp);
};



export const initConsole = async () =>
    new Promise<void>(async (resolve) => {

        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        process.on('SIGINT', () => {
            exitOkuuAI();
        });

        Logger.INFO('Console initialized');

        resolve();

        while (true) {
            const line = await reprompt();
            Logger.DEBUG(`Received line: ${line}`);
            if (line.trim().startsWith('/')) {
                Logger.DEBUG(`Command detected: ${line}`);
                await handleCommand(line.trim());
            } else {
                Logger.DEBUG(`Chat detected: ${line}`);
                await handleUserInput(line);
            }
        }

    });

// TODO: find out where that "Terminated is coming from"
export const exitOkuuAI = async () => {
    Logger.INFO('Bye!!');
    await killTauri();
    process.exit(0);
};

process.stdin.resume();