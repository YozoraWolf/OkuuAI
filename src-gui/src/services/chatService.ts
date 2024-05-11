import axios from 'axios';
import env from '@/env.json';
import { ChatMessage } from '@/src/stores/chatStore';

export const fetchChatHistory = async () => {
    try {
        const response = await axios.get(`http://localhost:${env.okuuai_port}/memory`, { 
            params: {
                msg_limit: env.msg_limit 
            }
        });
        console.log('Messages:', response.data);
        //console.log('Messages:', chatHistoryStore.getChatHistory());
        return response.data as ChatMessage[];
    } catch (error) {
        console.error('Error loading messages:', error); 
    }
    return [];
};