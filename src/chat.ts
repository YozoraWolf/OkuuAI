import { createClient } from 'redis';
import { io } from './index';
import { Core } from './core';
import { Logger } from './logger';
import { getLatestMsgsFromSession, SESSION_ID } from './langchain/memory/memory';
import { franc } from 'franc-ce';
import { Ollama } from 'ollama';
import { isQuestion, saveMemoryWithEmbedding, searchMemoryWithEmbedding } from './langchain/redis';

export interface ChatMessage {
    id?: number;
    type?: string;
    user?: string;
    message?: string;
    done?: boolean;
    sessionId: string;
    lang?: string;
    timestamp: number;
    stream?: boolean;
    memoryKey?: string;
}

export const langMappings: { [key: string]: string } = {
    spa: 'es-ES',
    eng: 'en-US',
    jpn: 'ja-JP',
    fra: 'fr-FR',
};

let messagesCount = 0;

export const setMessagesCount = (cnt: number) => {
    messagesCount = cnt;
};

export const getMessagesCount = () => {
    return messagesCount;
};

export const incrementMessagesCount = () => {
    return messagesCount++;
};

export const sendChat = async (msg: ChatMessage, callback?: (data: string) => void) => {
    try {
        msg = {
            ...msg,
            id: msg.id || incrementMessagesCount(),
        };
        Logger.DEBUG(`Sending chat: ${msg.id}`);
        incrementMessagesCount();

        const reply: ChatMessage = {
            id: incrementMessagesCount(),
            user: Core.ai_name || 'ai',
            message: '',
            done: false,
            lang: 'en-US',
            timestamp: Date.now(),
            sessionId: msg.sessionId || SESSION_ID || '',
            stream: msg.stream || false,
        };

        const ollama = new Ollama({ host: `http://127.0.0.1:${process.env.OLLAMA_PORT}` });

        // Step 1: Query Redis for related memories
        const memoryQuery = msg.message as string;
        const memories = await searchMemoryWithEmbedding(memoryQuery);

        const memoryContext = memories?.documents.map((doc: any) => doc.value.message).join('\n');
        Logger.DEBUG(`Retrieved Memories: ${JSON.stringify(memoryContext)}`);

        // Save user input in memory
        const timestamp = Date.now();
        const memoryKey = `okuuMemory:${reply.sessionId}:${timestamp}`;
        const messageType = isQuestion(msg.message as string) ? 'question' : 'statement';
        const saved = await saveMemoryWithEmbedding(memoryKey, msg.message as string, "user", messageType);
        Logger.DEBUG(`Saved memory: ${saved}`);

        // Get last 6 messages from current session
        const lastMsgs = await getLatestMsgsFromSession(msg.sessionId, 6);

        // Join them in a string to use as context for the AI, adding User: message
        const chatHistory = lastMsgs.messages.map((msg: any) => `${msg.user}: ${msg.message}`).join('\n');


        // Send message back to client
        io.to(msg.sessionId).emit('chat', { ...msg, memoryKey, timestamp });

        // Step 2: Prepare prompt with memory context
        const prompt = `
            Relevant memories:
            NOTE: Any memories talking in first person are from the user. Only use the following memories only if they are relevant to the conversation.
            ${memoryContext}
            ---
            ${chatHistory}
            Okuu: 
        `;

        Logger.DEBUG(`Prompt: ${prompt}`);

        if (msg.stream) {
            io.emit('chat', reply); // send back AI response (for GUI to display and await)
            const stream = await ollama.generate({
                prompt,
                model: Core.model_name,
                stream: true,
            });

            reply.done = false;
            reply.lang = langMappings[franc(reply.message)] || 'en-US';
            reply.timestamp = timestamp;
            
            for await (const part of stream) {
                if (callback) callback(part.response);
                reply.message += part.response;
                reply.done = false;
                io.to(msg.sessionId).emit('chat', reply);
            }

            reply.done = true;
            io.emit('chat', reply);
            //Logger.DEBUG(`Response: ${reply.content}`);
        } else {
            //Logger.DEBUG(`Loading Response...`);
            const resp = await ollama.generate({
                prompt,
                model: Core.model_name,
                system: Core.model_settings.system,
            });

            //Logger.DEBUG(`Response: ${resp.response}`);
            reply.done = true;
            reply.message = resp.response;
            reply.lang = langMappings[franc(reply.message)] || 'en-US';
            
            // Save AI response in memory
            const timestamp = Date.now();
            const aiMemoryKey = `okuuMemory:${reply.sessionId}:${timestamp}`;
            const messageTypeAI = isQuestion(reply.message) ? 'question' : 'statement';
            const aiSaved = await saveMemoryWithEmbedding(aiMemoryKey, reply.message, "okuu", messageTypeAI);
            //Logger.DEBUG(`Saved AI memory: ${aiSaved}`);
            reply.memoryKey = aiMemoryKey;
            reply.timestamp = timestamp;
            
            io.to(msg.sessionId).emit('chat', reply);

            callback && callback(reply.message);
            Logger.DEBUG("Returning...")
            return reply.message;
        }
    } catch (error: any) {
        Logger.ERROR(`Error sending chat: ${error.response ? error.response.data : error.message}`);
        return null;
    }
};
