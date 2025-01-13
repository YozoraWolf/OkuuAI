import { getAllSessions, getLatestMsgsFromSession, doesSessionExist, createSession } from "@src/langchain/memory/memory";
import { Logger } from "@src/logger";
import { spawn } from "child_process";
import { promisify } from "util";

export const checkMemoryStatus = async (req: any, res: any) => {
    try {
        const dockerInspect = spawn('docker', ['inspect', 'okuuai_redis']);
        let output = '';

        dockerInspect.stdout.on('data', (data) => {
            output += data.toString();
        });

        dockerInspect.on('close', () => {
            try {
                const parsedOutput = JSON.parse(output);
                const status = parsedOutput[0]?.State?.Status;

                if (status === 'running') {
                    res.json({ status: 'OK' });
                } else {
                    res.json({ status: 'DOWN' });
                }
            } catch (err) {
                Logger.ERROR(`Error parsing Docker inspect output: ${err}`);
                res.status(500).json({ status: 'ERROR', error: 'Failed to parse Docker inspect output.' });
            }
        });

        dockerInspect.stderr.on('data', (error) => {
            Logger.ERROR(`Error from Docker inspect: ${error}`);
            res.status(500).json({ status: 'ERROR', error: 'Docker inspect command failed.' });
        });
    } catch (err) {
        Logger.ERROR(`Unexpected error: ${err}`);
        res.status(500).json({ status: 'ERROR', error: 'An unexpected error occurred.' });
    }
};

export const getSessionMsgs = async (req: any, res: any) => {
    const { sessionId } = req.params;
    const { msg_limit } = req.query;

    if(await doesSessionExist(sessionId)) {
        res.json(await getLatestMsgsFromSession(sessionId, msg_limit));
    } else {
        res.status(404).send('Session not found');
    }

    // Send the memory data as a response
}

export const createSess = async (req: any, res: any) => {
    // Create a new session
    const session = await createSession();
    if (session) {
        res.json(session);
    } else {
        res.status(500).send('Session already exists or error creating session');
    }
}


export const getAllSessionsJSON = async (req: any, res: any) => {
    res.json(await getAllSessions());
}