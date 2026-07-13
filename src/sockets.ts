import { createHash } from 'crypto';
import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { Core } from "./core";
import { SESSION_ID, startSession } from "./langchain/memory/memory";
import { Logger } from "./logger";
import { handleUserInput, proactiveScreenComment } from "./chat";
import jwt from 'jsonwebtoken';
import { doesSessionBelongToUser } from './langchain/memory/memory';
import type { JwtPayloadCustom } from './middleware/auth.middleware';
import { ConversationRuntime } from './modules/conversation/conversation.runtime';
import type { ConversationObservation, ScreenFrame } from './modules/conversation/conversation.events';

const proactiveState = new Map<string, { lastAt: number; lastHash?: string }>();

/**
 * Decide whether Okuu should voice a comment about the current screen observation.
 * Gating is deliberately independent of the vision model's weak importance/category
 * signals: it fires on a cooldown + dedup + probability, and lets the model itself decide
 * (via the SKIP response) whether there is actually something worth saying.
 */
function maybeProactiveComment(userId: string, sessionId: string, observation: ConversationObservation) {
    if (!conversationRuntime.isActive() || observation.source !== 'perception' || !observation.message) return;

    const cooldownMs = Number(process.env.PROACTIVE_COMMENT_COOLDOWN_MS || 30000);
    const state = proactiveState.get(userId) || { lastAt: 0 };
    const now = Date.now();
    if (now - state.lastAt < cooldownMs) return;

    const hash = createHash('sha256').update(observation.message).digest('hex');
    if (state.lastHash === hash) return; // Skip repeating the same observation.
    if (Math.random() > Number(process.env.PROACTIVE_COMMENT_RATE || 0.6)) return;

    state.lastAt = now;
    state.lastHash = hash;
    proactiveState.set(userId, state);

    void proactiveScreenComment(
        sessionId,
        userId,
        { message: observation.message, timestamp: observation.timestamp, extractedText: observation.extractedText },
    ).catch(error => Logger.WARN(`Proactive screen comment failed: ${error}`));
}

let io: Server;

export const setupSockets = (server: HTTPServer, conversationRuntime: ConversationRuntime) => {
    io = new Server(server, {
        cors: {
            origin: "*", // Allow all origins - for production, specify exact origins
            methods: ["GET", "POST"],
            credentials: true
        },
        pingInterval: 10000,
        pingTimeout: 5000,
        maxHttpBufferSize: 2_000_000,
        transports: ['websocket', 'polling'] // Enable fallback to polling if websocket fails
    }
    );

    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        const secret = process.env.JWT_SECRET;
        if (!token || !secret) return next(new Error('Unauthorized'));
        try {
            const payload = jwt.verify(token, secret) as JwtPayloadCustom;
            socket.data.user = { id: payload.sub, username: payload.username, role: payload.role };
            next();
        } catch {
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        Logger.INFO('A client connected: ' + socket.id);
        const conversationSubscriptions = new AbortController();
        let observingConversation = false;
        let conversationSessionId = '';

        socket.on('conversation:join', async (
            data: { sessionId?: string },
            ack?: (result: { enabled: boolean; observations: ReturnType<ConversationRuntime['getHistory']> }) => void,
        ) => {
            if (!conversationRuntime.isActive()) {
                ack?.({ enabled: false, observations: [] });
                return;
            }
            if (!data?.sessionId || !await doesSessionBelongToUser(data.sessionId, socket.data.user.id)) {
                ack?.({ enabled: false, observations: [] });
                return;
            }
            conversationSessionId = data.sessionId;
            if (!observingConversation) {
                observingConversation = true;
                conversationRuntime.subscribe(String(socket.data.user.id), observation => {
                    socket.emit('conversation:observation', observation);
                    maybeProactiveComment(String(socket.data.user.id), conversationSessionId, observation);
                }, conversationSubscriptions.signal);
            }
            ack?.({ enabled: true, observations: conversationRuntime.getHistory(socket.data.user.id) });
        });

        socket.on('conversation:screen-state', async (data: { shared?: boolean; application?: string; stream?: 'screen' | 'camera' }) => {
            if (!conversationSessionId || typeof data?.shared !== 'boolean') return;
            try {
                const application = typeof data.application === 'string' ? data.application.slice(0, 100) : undefined;
                const stream = data.stream === 'camera' ? 'camera' : 'screen';
                await conversationRuntime.reportScreenState(String(socket.data.user.id), conversationSessionId, data.shared, application, stream);
            } catch (error) {
                socket.emit('conversation:error', {
                    message: error instanceof Error ? error.message : 'Unable to update screen state',
                });
            }
        });

        socket.on('conversation:frame', (frame: ScreenFrame, ack?: (result: { accepted: boolean; error?: string }) => void) => {
            if (!conversationSessionId) {
                ack?.({ accepted: false, error: 'Conversation session is not active' });
                return;
            }
            try {
                const accepted = conversationRuntime.submitFrame(String(socket.data.user.id), conversationSessionId, frame);
                ack?.({ accepted });
            } catch (error) {
                ack?.({ accepted: false, error: error instanceof Error ? error.message : 'Unable to analyze frame' });
            }
        });

        socket.on('joinChat', async (sessionId: string) => {
            if (!await doesSessionBelongToUser(sessionId, socket.data.user.id)) {
                socket.emit('error', { message: 'Forbidden session' });
                return;
            }
            Logger.DEBUG('Joining chat: ' + sessionId);
            socket.join(sessionId);
        });

        // Handle chat messages
        socket.on('chat', async (data: any) => {
            try {
                if (!data || !data.sessionId || !data.message) {
                    Logger.ERROR('Invalid chat data received: ' + data);
                    socket.emit('error', { message: 'Invalid data format' });
                    return;
                }

                if (!await doesSessionBelongToUser(data.sessionId, socket.data.user.id)) {
                    socket.emit('error', { message: 'Forbidden session' });
                    return;
                }

                data.ownerId = socket.data.user.id;
                data.user = socket.data.user.username;
                const screenContext = conversationRuntime.getScreenContext(String(socket.data.user.id), data.sessionId);
                data.metadata = { ...(data.metadata || {}) };
                if (screenContext) data.metadata.screen_context = screenContext;
                else delete data.metadata.screen_context;
                Logger.DEBUG(`Received chat message: ${JSON.stringify(data)}`);
                Core.chat_session = await startSession(data.sessionId);
                Logger.DEBUG(`Session started: ${SESSION_ID}`);
                await handleUserInput(data.message, data);

                //socket.emit('chat', { success: true });
            } catch (err) {
                Logger.ERROR('Error processing chat message: ' + err);
                socket.emit('error', { message: 'Internal server error' });
            }
        });

        // Handle stop generation signal
        socket.on('stopGeneration', async (data: { sessionId: string }) => {
            try {
                if (!data || !data.sessionId) {
                    Logger.ERROR('Invalid stop generation data received');
                    return;
                }
                if (!await doesSessionBelongToUser(data.sessionId, socket.data.user.id)) {
                    socket.emit('error', { message: 'Forbidden session' });
                    return;
                }
                Logger.DEBUG(`Received stop generation signal for session: ${data.sessionId}`);

                // Set flag to prevent generation from starting if it hasn't started yet
                Core.shouldStopGeneration = true;

                // Ollama exposes an abort helper; custom OpenAI-compatible streams use the stop flag above.
                Core.ollama_instance?.abort?.();
                Logger.INFO('Generation aborted successfully');
            } catch (err) {
                Logger.ERROR('Error processing stop generation signal: ' + err);
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            conversationSubscriptions.abort();
            Logger.INFO('Client disconnected: ' + socket.id);
        });
    });

    Logger.INFO('Socket server initialized');

    return io;
};
