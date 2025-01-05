import { io } from "./index";
import { Core } from "./core";
import { Logger } from "./logger";
import { SESSION_ID } from "./langchain/memory/memory";
import { franc } from 'franc-ce'

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
            id: msg.id || incrementMessagesCount()
        }
        Logger.DEBUG(`Sending chat: ${msg.id}`);
        incrementMessagesCount();
        const reply: ChatMessage = {
            id: incrementMessagesCount(),
            type: Core.ai_name || 'ai',
            content: '',
            done: false,
            lang: 'en-US',
            sessionId: msg.sessionId || SESSION_ID,
            stream: msg.stream || false
        };
        
        if(msg.stream) {
            io.emit('chat', reply); // send back AI response (for GUI to display and await)
            await Core.chat_session.stream({
                input: msg.content
            }, {
                callbacks: [
                    {
                        async handleLLMNewToken(token: string) {
                            if (callback) callback(token);
                            reply.content += token;
                            io.emit('chat', reply);
                        }
                    }
                ]
            });
            Logger.DEBUG(`Response: ${reply.content}`);

            //Logger.DEBUG(`Response: ${stream}`);
        } else {
            Logger.DEBUG(`Loading Response...`);
            const resp = await Core.chat_session.invoke({
                input: msg.content,
            });
            reply.done = true;
            reply.content = resp.response;
            reply.lang = langMappings[franc(reply.content)] || 'en-US';
            io.emit('chat', reply);
            return reply.content;
        }

    } catch (error: any) {
        Logger.ERROR(`Error sending chat: ${error.response ? error.response.data : error.message}`);
        return null;
    }
};