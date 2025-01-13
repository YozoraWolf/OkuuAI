import { createClient } from 'redis';
import { io } from './index';
import { Core } from './core';
import { Logger } from './logger';
import { SESSION_ID } from './langchain/memory/memory';
import { franc } from 'franc-ce';
import { Ollama } from 'ollama';
import { isQuestion, saveMemoryWithEmbedding, searchMemoryWithEmbedding } from './langchain/redis';

export interface ChatMessage {
    id: number;
    type: string;
    content?: string;
    done: boolean;
    sessionId?: string;
    lang?: string;
    stream?: boolean;
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
            type: Core.ai_name || 'ai',
            content: '',
            done: false,
            lang: 'en-US',
            sessionId: msg.sessionId || SESSION_ID || '',
            stream: msg.stream || false,
        };

        const ollama = new Ollama({ host: `http://127.0.0.1:${process.env.OLLAMA_PORT}` });

        // Step 1: Query Redis for related memories
        const memoryQuery = msg.content as string;
        const memories = await searchMemoryWithEmbedding(memoryQuery);

        const memoryContext = memories?.documents.map((doc: any) => doc.value.message).join('\n');
        Logger.DEBUG(`Retrieved Memories: ${JSON.stringify(memoryContext)}`);

        // Step 2: Prepare prompt with memory context
        const prompt = `
            ${Core.model_settings.system}
            Relevant memories:
            Notes: Any memories talking in first person are from the user.
            ${memoryContext}
            ---
            User: ${msg.content}
            Okuu: 
        `;

        if (msg.stream) {
            io.emit('chat', reply); // send back AI response (for GUI to display and await)
            const stream = await ollama.generate({
                prompt,
                model: Core.model_name,
                stream: true,
            });

            for await (const part of stream) {
                if (callback) callback(part.response);
                reply.content += part.response;
                io.emit('chat', reply);
            }
            Logger.DEBUG(`Response: ${reply.content}`);
        } else {
            Logger.DEBUG(`Loading Response...`);
            const resp = await ollama.generate({
                prompt,
                model: Core.model_name,
            });

            Logger.DEBUG(`Response: ${resp.response}`);
            reply.done = true;
            reply.content = resp.response;
            reply.lang = langMappings[franc(reply.content)] || 'en-US';
            io.emit('chat', reply);

            // Step 3: Save new memory if its not a question
            if(!isQuestion(msg.content as string)) {
                const timestamp = new Date().toISOString();
                const memoryKey = `okuuMemory:${reply.sessionId}:${timestamp}`;
                const saved = await saveMemoryWithEmbedding(memoryKey, msg.content as string);
                Logger.DEBUG(`Saved memory: ${saved}`);
            }

            return reply.content;
        }
    } catch (error: any) {
        Logger.ERROR(`Error sending chat: ${error.response ? error.response.data : error.message}`);
        return null;
    }
};
