import { defineStore } from 'pinia';
import { getAllSessions, getSessionMessages, createSession, sendAttachment, deleteSession, deleteChatMessage } from 'src/services/session.service';

export interface Message {
    timestamp: number;
    user: string;
    message: string;
    avatar?: string;
    memoryKey: string;
    sessionId: string;
    stream: boolean;
    thinking?: string;
    done: boolean;
    attachment?: string;
    file?: string;
    metadata?: {
        web_search?: { sources: { title: string; url: string }[] };
        weather?: any;
        [key: string]: any;
    };
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
    isStreaming: boolean;
    isGenerating: boolean;
}

export const useSessionStore = defineStore('session', {
    state: (): SessionStore => ({
        sessions: [],
        currentSessionId: '',
        isStreaming: false,
        isGenerating: false,
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
            formData.append('message', JSON.stringify(msg));
            try {
                const response = await sendAttachment(formData);
                if (response.status !== 200) {
                    console.error('Failed to send attachment');
                    return false;
                }
                return response;
            } catch (error) {
                console.error('Failed to send attachment:', error);
                return false;
            }

        },
        async fetchSessionMessages(sessionId: string) {
            const { data, status } = await getSessionMessages(sessionId);
            if (status !== 200) {
                console.error('Failed to fetch messages for session', sessionId);
                return;
            }
            const { messages } = data;
            this.updateSessionMessagesLocal(sessionId, messages);
            //this.orderSessions();
        },
        updateSessionMessagesLocal(sessionId: string, messages: Message[]) {
            const session = this.sessions.find((session: Session) => session.sessionId === sessionId);
            if (session) {
                session.messages = messages;
                session.lastMessage = messages[messages.length - 1] || undefined;
                //this.orderSessions();
            }
        },
        async addSession() {
            const { data, status } = await createSession();
            if (status !== 200) {
                console.error('Failed to create session');
                return;
            }
            const newSession = data;
            newSession.lastMessage = data.messages[data.messages.length - 1] || '';
            this.sessions.push(newSession);
            this.orderSessions();
            return data.sessionId;
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
        getSessionById(sessionId: string): Session | undefined {
            return this.sessions.find((session: Session) => session.sessionId === sessionId);
        },
        async deleteChatMessage(memoryKey: string, sessionId: string) {
            const { status, data } = await deleteChatMessage(memoryKey);
            if (status !== 200 || !data.result) {
                console.error('Failed to delete chat message:', memoryKey);
                return;
            }
            const session = this.sessions.find((session: Session) => session.sessionId === sessionId);
            if (session) {
                const messageIndex = session.messages.findIndex((msg: Message) => msg.memoryKey === memoryKey);
                session.messages.splice(messageIndex, 1);
                session.lastMessage = session.messages[session.messages.length - 1] || undefined;
                this.orderSessions();
            }
        },
        addMessageToSession(message: Message) {
            console.log('🟢 Adding message to session:', {
                sessionId: this.currentSessionId,
                memoryKey: message.memoryKey,
                messageLength: message.message?.length || 0,
                isStreaming: message.stream
            });

            const session = this.sessions.find((session: Session) => session.sessionId === this.currentSessionId);
            if (!session) {
                console.warn('🔴 No session found for:', this.currentSessionId);
                return;
            }

            // Check if message with same timestamp already exists to prevent duplicates
            // (e.g. when adding locally first then receiving echo from socket)
            const exists = session.messages.some(m => m.timestamp === message.timestamp);
            if (exists) {
                console.log('🟡 Message already exists, skipping add:', message.timestamp);
                return;
            }

            // Create a new message object to ensure reactivity
            const newMessage = { ...message };
            session.messages = [...session.messages, newMessage];
            session.lastMessage = newMessage;

            if (message.stream) {
                console.log('🟢 Setting streaming state true');
                this.isStreaming = true;
            }

            this.orderSessions();
            console.log('🟢 Current messages count:', session.messages.length);
        },

        updateMessageInSession(memoryKey: string, newMessage: string, finishStreaming: boolean = true, sources?: any) {
            console.log('🟡 Updating message:', {
                memoryKey,
                messageLength: newMessage?.length || 0,
                finishStreaming,
                metadataPresent: !!sources
            });

            const session = this.sessions.find((session: Session) => session.sessionId === this.currentSessionId);
            if (!session) {
                console.warn('🔴 No session found for update:', this.currentSessionId);
                return;
            }

            const messageIndex = session.messages.findIndex((msg: Message) => msg.memoryKey === memoryKey);
            if (messageIndex === -1) {
                console.warn('🔴 No message found with key:', memoryKey);
                return;
            }

            const oldMessage = session.messages[messageIndex];
            if (!oldMessage) {
                console.warn('🔴 Message at index is undefined:', messageIndex);
                return;
            }

            console.log('🟡 Found message to update:', {
                index: messageIndex,
                oldLength: oldMessage.message?.length || 0,
                newLength: newMessage?.length || 0,
                wasStreaming: oldMessage.stream,
                wasDone: oldMessage.done
            });

            // Create completely new array and message objects to force reactivity
            const updatedMessage: Message = {
                timestamp: oldMessage.timestamp,
                user: oldMessage.user,
                message: newMessage || '',
                memoryKey: oldMessage.memoryKey,
                sessionId: oldMessage.sessionId,
                stream: true, // Ensure stream stays true while updating
                done: !!finishStreaming,
                ...(oldMessage.avatar ? { avatar: oldMessage.avatar } : {}),
                ...(oldMessage.thinking ? { thinking: oldMessage.thinking } : {}),
                ...(oldMessage.attachment ? { attachment: oldMessage.attachment } : {}),
                ...(oldMessage.file ? { file: oldMessage.file } : {}),
                ...(sources ? { metadata: sources } : (oldMessage.metadata ? { metadata: oldMessage.metadata } : {}))
            };

            // Create new array to force reactivity
            const newMessages = [...session.messages];
            newMessages[messageIndex] = updatedMessage;
            session.messages = newMessages;

            if (messageIndex === session.messages.length - 1) {
                session.lastMessage = { ...updatedMessage };
            }

            // Keep streaming true until explicitly finished
            this.isStreaming = !finishStreaming;

            console.log('🟡 Updated message result:', {
                messageLength: updatedMessage.message?.length || 0,
                isDone: updatedMessage.done,
                isStreaming: this.isStreaming
            });
        },
        hasMessageInSession(memoryKey: string): boolean {
            const session = this.sessions.find((session: Session) => session.sessionId === this.currentSessionId);
            if (session) {
                return session.messages.some((msg: Message) => msg.memoryKey === memoryKey);
            }
            return false;
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
        },
        getMemoryKey(sessionId: string, timestamp: number): string {
            return `okuuMemory:${sessionId}:${timestamp}`;
        },
        setIsGenerating(value: boolean) {
            this.isGenerating = value;
        }
    },
    getters: {
        currentSession: (state): Session | undefined => {
            return state.sessions.find((session: Session) => session.sessionId === state.currentSessionId);
        }
    }
});
