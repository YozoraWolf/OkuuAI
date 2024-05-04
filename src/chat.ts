import { Core } from "./core";
import { Logger } from "./logger";

export const sendChat = async (cnt: string, callback?: (data: string) => void) => {
    try {
        //Logger.DEBUG(`Sending chat: ${cnt}`);
        if(Core.ollama_settings.stream) {
            await Core.chat_session.stream({
                input: cnt,
            }, {
                callbacks: [
                    {
                        async handleLLMNewToken(token: string) {
                            //console.log(token);
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
    } catch (error: any) {
        Logger.ERROR(`Error sending chat: ${error.response ? error.response.data : error.message}`);
        return null;
    }
};