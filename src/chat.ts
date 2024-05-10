import { io } from "./index";
import { Core } from "./core";
import { Logger } from "./logger";

interface ChatMessage {
    id: number;
    type: string;
    content: string;
    done: boolean;
}

let messagesSent = 0;

export const sendChat = async (cnt: string, callback?: (data: string) => void) => {
    try {
        //Logger.DEBUG(`Sending chat: ${cnt}`);
        io.emit('chat', { id:  messagesSent++, type: 'user', content: cnt, done: true });
        if(Core.ollama_settings.stream) {
            await Core.chat_session.stream({
                input: cnt
            }, {
                callbacks: [
                    {
                        async handleLLMNewToken(token: string) {
                            //console.log(token);
                            io.emit('chat', { id:  messagesSent, type: 'ai', content: token, done: false });
                            if (callback) callback(token);
                        }
                    }
                ]
            });

            //Logger.DEBUG(`Response: ${stream}`);
        } else {
            const resp = await Core.chat_session.invoke({
                input: cnt,
            });
            return resp.content;
        }
        io.emit('chat', { id: messagesSent++, type: 'ai', done: true });

    } catch (error: any) {
        Logger.ERROR(`Error sending chat: ${error.response ? error.response.data : error.message}`);
        return null;
    }
};