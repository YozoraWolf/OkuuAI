import { createClient } from 'redis';
import { io } from './index';
import { Core } from './core';
import { Logger } from './logger';
import { getLatestMsgsFromSession, SESSION_ID } from './langchain/memory/memory';
import { franc } from 'franc-ce';
import { Ollama } from 'ollama';
import { isQuestion, saveMemoryWithEmbedding, searchMemoryWithEmbedding, updateAttachmentForMemory, updateMemory } from './langchain/redis';
import { loadFileContentFromStorage } from './langchain/memory/storage';

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
    thinking?: string;
    memoryKey?: string;
    file?: string;
    attachment?: string;
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

const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

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
            timestamp: Date.now() + 1000, // Add 1 sec to avoid same timestamp
            sessionId: msg.sessionId || SESSION_ID || '',
            stream: msg.stream || false,
        };

        const ollama = new Ollama({ host: `http://127.0.0.1:${process.env.OLLAMA_PORT}` });

        // Step 1: Save user input in memory
        const timestamp = Date.now();
        const messageType = isQuestion(msg.message as string) ? 'question' : 'statement';
        const memory = await saveMemoryWithEmbedding(msg.sessionId, msg.message as string, "user", messageType);
        Logger.DEBUG(`Saved memory: ${memory.memoryKey}`);

        // Step 2 (Optional): Update attachment in memory
        let sentImage: string[] | undefined = undefined;
        if (msg.file) {
            // Note: Images get encoded to base64 before sending
            const fileContent = await loadFileContentFromStorage(msg.file);
            if (fileContent) {
                await updateAttachmentForMemory(memory.memoryKey, fileContent, msg.file);
                if(imageExts.includes(msg.file.split('.').pop() || ''))
                    sentImage = [fileContent];
                msg.attachment = fileContent;
                Logger.INFO(`Attachment updated for memory: ${memory.memoryKey}`);
            } else {
                Logger.ERROR(`Error loading file content: ${msg.file}`);
            }
        }

        // Step 3: Query Redis for related memories
        const memoryQuery = msg.message as string;
        const memories = await searchMemoryWithEmbedding(memoryQuery, Number(msg.sessionId));

        const memoryContext = memories?.map((doc: any, index: number) => `${index + 1}. ${doc.message}`).join('\n');
        Logger.DEBUG(`Retrieved Memories: ${JSON.stringify(memoryContext)}`);

        // Get last 6 messages from current session
        const lastMsgs = await getLatestMsgsFromSession(msg.sessionId, 20);

        // Join them in a string to use as context for the AI, adding User: message
        const chatHistory = lastMsgs.messages.map((msg: any) => `${msg.user}: ${msg.message}`).join('\n');

        // Send message back to client
        io.to(msg.sessionId).emit('chat', { ...msg, memoryKey: memory.memoryKey, timestamp: memory.timestamp });

        // Step 2: Prepare prompt with memory context
        const prompt = `
            Relevant memories:
            NOTE: Any memories talking in first person are from the user. Only use the following memories only if they are relevant to the conversation.
            ${memoryContext}
            ---
            Chat History:
            ${chatHistory}
            Okuu: 
        `;

        Logger.DEBUG(`Prompt: ${prompt}`);
        Logger.DEBUG(`Message: ${JSON.stringify(msg, null, 2)}`);

        if (msg.stream) {

            reply.done = false;
            reply.lang = langMappings[franc(reply.message)] || 'en-US';
            const timestamp = Date.now() + 1000; // Add 1 sec to avoid same timestamp
            reply.sessionId = msg.sessionId;
            reply.timestamp = timestamp;

            io.to(msg.sessionId).emit('chat', reply); // send back AI response (for GUI to display and await)
            

            // Save AI response in memory

            const messageTypeAI = isQuestion(reply.message as string) ? 'question' : 'statement';
            const aiSaved = await saveMemoryWithEmbedding(reply.sessionId, reply.message as string, "okuu", messageTypeAI);
            
            reply.memoryKey = aiSaved.memoryKey;

            const stream = await ollama.generate({
                prompt,
                model: Core.model_name,
                stream: true,
                system: Core.model_settings.system,
                think: Core.model_settings.think,
                images: sentImage,
            });



            for await (const part of stream) {
                if (callback) callback(part.response);
                reply.message += part.response;
                reply.done = false;
                io.to(msg.sessionId).emit('chat', reply);
            }

            reply.done = true;

            // Update memory with AI response
            await updateMemory(reply);
            
            // TODO: Search a way to make this the last message sent in stream, since it's not getting sent last
            io.to(msg.sessionId).emit('chat', reply);
            //Logger.DEBUG(`Saved AI memory: ${aiSaved}`);

            return reply.message;
            //Logger.DEBUG(`Response: ${reply.content}`);
        } else {
            //Logger.DEBUG(`Loading Response...`);
            Logger.DEBUG(`🧠 Think: ${Core.model_settings.think}`);
            const resp = await ollama.generate({
                prompt,
                model: Core.model_name,
                system: Core.model_settings.system,
                think: Core.model_settings.think,
                images: sentImage,
            });

            //Logger.DEBUG(`Response: ${JSON.stringify(resp, null, 2)}`);
            reply.done = true;
            reply.message = resp.response;
            reply.lang = langMappings[franc(reply.message)] || 'en-US';
            reply.thinking = resp.thinking || '';

            // Save AI response in memory
            const messageTypeAI = isQuestion(reply.message) ? 'question' : 'statement';
            const aiMemory = await saveMemoryWithEmbedding(reply.sessionId, reply.message, "okuu", messageTypeAI, reply.thinking);
            //Logger.DEBUG(`Saved AI memory: ${aiSaved}`);
            reply.memoryKey = aiMemory.memoryKey;
            reply.timestamp = aiMemory.timestamp;

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
