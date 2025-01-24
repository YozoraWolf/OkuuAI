import { defineStore } from 'pinia';
import { getAllSessions, getSessionMessages, createSession } from 'src/services/session.service';

export interface Message {
    timestamp: number;
    user: string;
    message: string;
    avatar?: string;
}

export interface Session {
    sessionId: string;
    messages: Message[];
    lastMessage?: string;
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
            } else {
                console.error('Failed to fetch sessions');
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
        },
        async addSession() {
            const { data, status } = await createSession();
            if (status !== 200) {
                console.error('Failed to create session');
                return;
            }
            const newSession = data;
            this.sessions.push(newSession);
        },
        addMessageToSession(message: Message) {
            const session = this.sessions.find((session: Session) => session.sessionId === this.currentSessionId);
            if (session) {
                session.messages.push(message);
                session.lastMessage = message.message;
            }
        },
        setCurrentSessionId(sessionId: string) {
            this.currentSessionId = sessionId;
        }
    },
    getters: {
        currentSession: (state): Session | undefined => {
            return state.sessions.find((session: Session) => session.sessionId === state.currentSessionId);
        }
    }
});
