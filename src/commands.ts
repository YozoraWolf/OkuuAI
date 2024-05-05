import { start } from "repl";
import { Core } from "./core";
import { SessionData, getAllSessionsTable, switchToSession, getAllSessions, startSession } from "./langchain/memory/memory";
import { Logger } from "./logger";

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

const help = () => {
    Logger.INFO(`${Core.chat_settings.prefix}: Displaying help...`);
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

    let id: number = parseInt(index);

    const sessions: Array<SessionData> = await getAllSessions();
    const sessionId = sessions[id].date;
    await switchToSession(sessionId);
};

const exit = () => {
    Logger.INFO('Bye!');
    process.exit(0);
};