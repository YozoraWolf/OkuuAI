import { Core } from "./core";
import { SessionData, getAllSessionsTable, switchToSession, getAllSessions } from "./langchain/memory/memory";
import { Logger } from "./logger";

const helpStr = `
/help - Displays this help output with all available commands
/sessions - Lists all available memory sessions
/switch new - Creates a new memory session (if none available it will create one)
/switch <index> - Switches between memory sessions based on their index
/exit - Exit OkuuAI
`;

export const handleCommand = async (command: string) => {
    const [commandName, ...args] = command.trim().substring(1).split(" ");
    //console.log(`Command: ${commandName}, Args: ${args}`);

    switch (commandName) {
        case 'help':
            help();
            break;
        case 'sessions':
            await getSessions();
            break;
        case 'switch':
            await switchSession(args[0]);
            break;
        case 'exit':
            exit();
            break;
        default:
            Logger.ERROR(`Command not found: ${commandName}`);
            break;
    }
};

// TODO: make docs for this with annotations?
const help = () => {
    Logger.INFO(`${Core.chat_settings.prefix}: Displaying help...`);
    console.log(helpStr);
};

const getSessions = async () => {
    Logger.INFO(`Listing sessions...`);
    console.log(await getAllSessionsTable());
};

const switchSession = async (index: string) => {
    if(index === "new") {
        Logger.INFO(`Starting new session...`);
        await switchToSession(null);
        return;
    }


    if(isNaN(Number(index))) {
        Logger.ERROR(`Invalid session index: ${index}`);
        return;
    }

    const id: number = parseInt(index);

    const sessions: Array<SessionData> = await getAllSessions();
    const sessionId = sessions[id].sessionId;
    await switchToSession(sessionId);
};

const exit = () => {
    Logger.INFO('Bye!');
    process.exit(0);
};