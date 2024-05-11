import { defineStore } from 'pinia';
import { fetchChatHistory } from '@/src/services/chatService';

export interface ChatMessage {
  id: number;
  type: string;
  content: string;
  done: boolean;
}

export const useSendingStore = defineStore({
  id: 'sending',
  state: () => ({
    sending: false,
  }),
  actions: {
    setSending(value: boolean) {
      this.sending = value;
    },
  },
});

export const useChatHistoryStore = defineStore({
  id: 'chatHistory',
  state: () => ({
    chatHistory: [] as ChatMessage[],
  }),
  actions: {
    addMessage(message: ChatMessage) {
      this.chatHistory.push(message);
    },
    clearChatHistory() {
      this.chatHistory = [];
    },
    getChatHistory() {
      return this.chatHistory;
    },
    setChatHistory(history: ChatMessage[]) {
      this.chatHistory = history;
    },
    async loadChatHistory(): Promise<ChatMessage[]> {
      this.setChatHistory(await fetchChatHistory()); 
      return this.getChatHistory();
    }
  },
});