import readline from 'readline';
import { sendChat } from './ollama_bridge';
import { Logger } from './logger';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.setPrompt('> ');
rl.prompt();

rl.on('line', async (line: string) => {
    if (line.trim().startsWith('/')) {
        handleCommand(line.trim());
    } else {
        // possibly handle chats
        const resp: any = await sendChat(line.trim());
        console.log('\x1b[32mOkuu:\x1b[0m ' + resp.message.content);
    }
    rl.prompt();
}).on('close', () => {
    Logger.INFO('Have a great day!');
    process.exit(0);
});

function handleCommand(command: string) {
    // handle commands
    switch(command) {
        case '/help':
            Logger.INFO('Bot: Displaying help...');
            break;
        case '/exit':
            rl.close();
            break;
        default:
            Logger.INFO('Bot: Command not recognized!');
            break;
    }
}

// keep the script running indefinitely
process.stdin.resume();