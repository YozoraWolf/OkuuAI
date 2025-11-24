import readline from 'readline';
import { Logger } from './logger';
import { Core } from './core';
import { stdout } from 'process';
import { ChatMessage, getMessagesCount, incrementMessagesCount, sendChat } from './chat';
import { handleCommand } from './commands';
import { killTauri } from './gui';
import { get } from 'http';
import { SESSION_ID } from './langchain/memory/memory';

let rl: readline.Interface;

const reprompt = () => {
    //Logger.DEBUG('Prompting user...');
    stdout.write('\n');
    rl.setPrompt('> ');
    rl.prompt();
};

const clearLine = () => {
    stdout.clearLine(0);
    stdout.cursorTo(0);
};



export const handleUserInput = async (line: string, msg: ChatMessage) => {
    // possibly handle chats
    let multiline = false;

    /*     let id = getMessagesCount();
    
        if(msg === undefined) {
            id = incrementMessagesCount(); // increment the message count and assign it to the id
            msg = {
                id,
                type: 'user',
                content: line,
                done: false
            };
        } else {
            incrementMessagesCount(); // else just increment the message count
        } */

    let reply = '';

    const resp: any = await sendChat(msg, (data: string) => {
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

    if (!Core.ollama_settings.stream && resp)
        console.log('\x1b[32mOkuu:\x1b[0m ' + resp.message);
};

export const initConsole = async () =>
    new Promise<void>((resolve) => {

        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });


        rl.on('line', async (line: string) => {
            if (line.trim().startsWith('/')) {
                await handleCommand(line.trim());
            } else {
                const msg: ChatMessage = {
                    id: getMessagesCount(),
                    user: Core.ai_name || 'ai',
                    message: line,
                    done: false,
                    sessionId: SESSION_ID,
                    timestamp: Date.now(),
                    stream: Core.ollama_settings.stream || false,
                };
                await handleUserInput(line, msg);
                reprompt();
            }

        }).on('close', () => {
            exitOkuuAI();
        });

        process.on('SIGINT', () => {
            exitOkuuAI();
        });

        Logger.INFO('Console initialized');

        clearLine();
        reprompt();

        resolve();
    });

// TODO: find out where that "Terminated is coming from"
export const exitOkuuAI = async () => {
    Logger.INFO('Bye!!');
    await killTauri();
    process.exit(0);
};

process.stdin.resume();