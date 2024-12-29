import { io } from "./index";
import { Core } from "./core";
import { Logger } from "./logger";
import { SESSION_ID } from "./langchain/memory/memory";

export interface ChatMessage {
    id: number;
    type: string;
    content?: string;
    done: boolean;
    sessionId?: string;
}

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
        io.emit('chat', msg); // send back user input (for GUI to display)
        incrementMessagesCount();
        const reply: ChatMessage = {
            id: incrementMessagesCount(),
            type: 'ai',
            content: '',
            done: false,
            sessionId: msg.sessionId || SESSION_ID
        };
        io.emit('chat', reply); // send back AI response (for GUI to display and await)
        if(Core.ollama_settings.stream) {
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

            //Logger.DEBUG(`Response: ${stream}`);
        } else {
            const resp = await Core.chat_session.invoke({
                input: msg.content,
            });
            return resp.content;
        }
        reply.done = true;
        io.emit('chat', reply);
    } catch (error: any) {
        Logger.ERROR(`Error sending chat: ${error.response ? error.response.data : error.message}`);
        return null;
    }
};