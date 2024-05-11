import { getLatestMsgs } from "@src/langchain/memory/memory";

export const getLatestMsgsCont = async (req: any, res: any) => {
    const { msg_limit } = req.query;

    // Validate msg_limit parameter
    if (typeof msg_limit !== 'string' || isNaN(Number(msg_limit))) {
        return res.status(400).json({ error: 'Invalid msg_limit parameter' });
    }

    // Convert msg_limit to a number
    const limit = Number(msg_limit);

    // Send the memory data as a response
    res.json(await getLatestMsgs(limit));
};