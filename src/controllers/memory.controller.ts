import { getLatestMsgs, getAllSessions, getLatestMsgsFromSession, doesSessionExist, createSession } from "@src/langchain/memory/memory";

export const getLatestMsgsCont = async (req: any, res: any) => {
    const { msg_limit } = req.query;

    // Send the memory data as a response
    res.json(await getLatestMsgs(msg_limit));
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