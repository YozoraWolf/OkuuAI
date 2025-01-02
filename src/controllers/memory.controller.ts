import { getLatestMsgs, getAllSessions, getLatestMsgsFromSession } from "@src/langchain/memory/memory";

export const getLatestMsgsCont = async (req: any, res: any) => {
    const { msg_limit } = req.query;

    // Send the memory data as a response
    res.json(await getLatestMsgs(msg_limit));
};

export const getSessionMsgs = async (req: any, res: any) => {
    const { sessionId } = req.params;
    const { msg_limit } = req.query;

    // Send the memory data as a response
    res.json(await getLatestMsgsFromSession(sessionId, msg_limit));
}

export const getAllSessionsJSON = async (req: any, res: any) => {
    res.json(await getAllSessions());
}