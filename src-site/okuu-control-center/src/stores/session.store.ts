import { defineStore } from 'pinia';
import { getAllSessions, getSessionMessages, createSession, sendAttachment, deleteSession, deleteChatMessage } from 'src/services/session.service';

export interface Message {
    timestamp: number;
    user: string;
    message: string;
    avatar?: string;
    memoryKey: string;
}

export interface Session {
    sessionId: string;
    messages: Message[];
    lastMessage?: Message | undefined;
    index?: number;
}

interface SessionStore {
    sessions: Session[];
    currentSessionId: string;
}

export const useSessionStore = defineStore('session', {
    state: (): SessionStore => ({
        sessions: [],
        currentSessionId: '',
    }),
    actions: {
        async fetchAllSessions() {
            const { data, status } = await getAllSessions();
            //console.log('Fetched sessions:', data);
            if (status === 200) {
                this.sessions = data;
                this.orderSessions();
            } else {
                console.error('Failed to fetch sessions');
            }
        },
        async sendAttachment(file: File, msg: Message) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('message', msg.message);
            const { data, status } = await sendAttachment(formData);
            if (status !== 200) {
                console.error('Failed to send attachment');
                return;
            }
        },
        async fetchSessionMessages(sessionId: string) {
            const session = this.sessions.find((session: Session) => session.sessionId === sessionId);
            const { data, status } = await getSessionMessages(sessionId);
            if(status !== 200) {
                console.error('Failed to fetch messages for session', sessionId);
                return;
            }
            const { messages } = data;
            if (session) {
                session.messages = messages;
            } else {
                this.sessions.push({ sessionId, messages });
            }
            this.setCurrentSessionId(sessionId);
            this.orderSessions();
        },
        async addSession() {
            const { data, status } = await createSession();
            if (status !== 200) {
                console.error('Failed to create session');
                return;
            }
            const newSession = data;
            newSession.lastMessage = data.messages[data.messages.length - 1]  || '';
            this.sessions.push(newSession);
            this.orderSessions();
        },
        async deleteSession(sessionId: string) {
            const { status, data } = await deleteSession(sessionId);
            if (status !== 200 || !data.result) {
                console.error('Failed to delete session:', sessionId);
                return;
            }
            const sessionIndex = this.sessions.findIndex((session: Session) => session.sessionId === sessionId);
            if (sessionIndex === -1) {
                console.error('Session not found:', sessionId);
                return;
            }
            this.sessions.splice(sessionIndex, 1);
            if (this.currentSessionId === sessionId) {
                this.currentSessionId = '';
            }
            this.orderSessions();
        },
        async deleteChatMessage(memoryKey: string) {
            const { status, data } = await deleteChatMessage(memoryKey);
            if (status !== 200 || !data.result) {
                console.error('Failed to delete chat message:', memoryKey);
                return;
            }
            const session = this.sessions.find((session: Session) => session.messages.some((msg: Message) => msg.memoryKey === memoryKey));
            if (session) {
                const messageIndex = session.messages.findIndex((msg: Message) => msg.memoryKey === memoryKey);
                session.messages.splice(messageIndex, 1);
                session.lastMessage = session.messages[session.messages.length - 1] || undefined;
                this.orderSessions();
            }
        },
        addMessageToSession(message: Message) {
            const session = this.sessions.find((session: Session) => session.sessionId === this.currentSessionId);
            if (session) {
                session.messages.push(message);
                session.lastMessage = message;
                this.orderSessions();
            }
        },
        setCurrentSessionId(sessionId: string) {
            this.currentSessionId = sessionId;
        },
        orderSessions() {
            console.log("ORDER SESSIONS", this.sessions);
            // Order sessions by last message timestamp in descending order
            this.sessions.sort((a: Session, b: Session) => {
                // get the last message timestamp
                const aTimestamp = a.messages?.[a.messages.length - 1]?.timestamp ?? 0;
                const bTimestamp = b.messages?.[b.messages.length - 1]?.timestamp ?? 0;
                return bTimestamp - aTimestamp;
            });
        }
    },
    getters: {
        currentSession: (state): Session | undefined => {
            return state.sessions.find((session: Session) => session.sessionId === state.currentSessionId);
        }
    }
});
