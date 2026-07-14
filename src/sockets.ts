import { createHash } from 'crypto';
import { Server, type Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { Core } from "./core";
import { SESSION_ID, startSession } from "./langchain/memory/memory";
import { Logger } from "./logger";
import { proactiveScreenComment } from "./chat";
import { handleUserInput } from './console';
import jwt from 'jsonwebtoken';
import { doesSessionBelongToUser } from './langchain/memory/memory';
import type { JwtPayloadCustom } from './middleware/auth.middleware';
import { ConversationRuntime } from './modules/conversation/conversation.runtime';
import type { ConversationObservation, ScreenFrame } from './modules/conversation/conversation.events';

const proactiveState = new Map<string, { lastAt: number; lastHash?: string; lastComment?: string; inFlight?: boolean }>();
const commentStopWords = new Set(['about', 'after', 'again', 'also', 'because', 'being', 'could', 'from', 'have', 'into', 'just', 'like', 'looks', 'really', 'that', 'their', 'there', 'these', 'this', 'through', 'very', 'what', 'when', 'with', 'would', 'your']);

const contentWords = (text: string) => new Set(
    (text.toLowerCase().match(/[a-z0-9']{3,}/g) || []).filter(word => !commentStopWords.has(word)),
);

const textSimilarity = (left: string, right: string) => {
    const leftWords = contentWords(left);
    const rightWords = contentWords(right);
    const denominator = Math.min(leftWords.size, rightWords.size);
    if (!denominator) return 0;
    let shared = 0;
    leftWords.forEach(word => { if (rightWords.has(word)) shared += 1; });
    return shared / denominator;
};

const requestsVisualContext = (message: string) => [
    /\b(?:look|take a look|check)\s+(?:at\s+)?(?:this|that|my (?:screen|camera)|the (?:screen|camera))\b/i,
    /\bcan you see\b/i,
    /\bwhat(?:'s| is)\s+(?:this|that|in my hands?|on (?:my|the) screen|in (?:my|the) camera)\b/i,
    /\bwhat (?:am i|are we) (?:holding|showing|looking at)\b/i,
    /\b(?:read|identify|recognize)\s+(?:this|that|what(?:'s| is) (?:here|visible)|the screen)\b/i,
].some(pattern => pattern.test(message));

const requestFreshFrame = (socket: Socket) => new Promise<ScreenFrame | undefined>(resolve => {
    let settled = false;
    const finish = (frame?: ScreenFrame) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(frame);
    };
    const timer = setTimeout(() => finish(), 4000);
    socket.emit('conversation:request-frame', { requestedAt: Date.now() }, finish);
});

/**
 * Decide whether Okuu should voice a comment about the current screen observation.
 * The vision model produces Okuu's opinion in the same call as the observation. This avoids
 * a second LLM round trip and deterministically delivers each distinct, warranted comment.
 */
function maybeProactiveComment(userId: string, ownerId: number, sessionId: string, observation: ConversationObservation) {
    const comment = observation.comment?.trim();
    if (observation.requestedVisualContext || observation.source !== 'perception' || !observation.message || !comment || /^SKIP[.!]?$/i.test(comment)) return;

    const cooldownMs = Number(process.env.PROACTIVE_COMMENT_COOLDOWN_MS || 12000);
    const importanceThreshold = Number(process.env.PROACTIVE_COMMENT_IMPORTANCE || 0.55);
    const state = proactiveState.get(userId) || { lastAt: 0 };
    const now = Date.now();
    if (state.inFlight || now - state.lastAt < cooldownMs) return;
    if (observation.category === 'info' && (observation.importance || 0) < importanceThreshold) return;
    if (/^(?:i see|this (?:image|screen|view|scene)|the (?:image|screen|view)|there (?:is|are)|it appears)\b/i.test(comment)) return;
    if (observation.category === 'info' && /^(?:i['’]d (?:suggest|recommend)|you should|you might want)\b/i.test(comment)) return;
    if (textSimilarity(comment, observation.message) >= 0.55) return;
    if (state.lastComment && textSimilarity(comment, state.lastComment) >= 0.75) return;

    const hash = createHash('sha256').update(comment).digest('hex');
    if (state.lastHash === hash) return; // Skip repeating the same observation.
    state.inFlight = true;
    proactiveState.set(userId, state);

    void proactiveScreenComment(
        sessionId,
        ownerId,
        { message: observation.message, timestamp: observation.timestamp, extractedText: observation.extractedText, stream: observation.stream },
        comment,
    ).then(sent => {
        if (!sent) return;
        state.lastAt = Date.now();
        state.lastHash = hash;
        state.lastComment = comment;
    }).catch(error => Logger.WARN(`Proactive screen comment failed: ${error}`)).finally(() => {
        state.inFlight = false;
    });
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
                    maybeProactiveComment(String(socket.data.user.id), socket.data.user.id, conversationSessionId, observation);
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
                data.metadata = { ...(data.metadata || {}) };
                const userId = String(socket.data.user.id);
                let screenContext;
                if (
                    conversationRuntime.isActive()
                    && conversationSessionId === data.sessionId
                    && requestsVisualContext(data.message)
                ) {
                    const frame = await requestFreshFrame(socket);
                    if (frame) {
                        frame.query = String(data.message).slice(0, 500);
                        data.metadata.visual_context_requested = true;
                        const accepted = conversationRuntime.submitFrame(userId, data.sessionId, frame, true);
                        if (accepted) {
                            screenContext = await conversationRuntime.waitForFreshScreenContext(
                                userId,
                                data.sessionId,
                                frame.capturedAt,
                                Number(process.env.VISION_ON_DEMAND_TIMEOUT_MS || 25000),
                            );
                        }
                    }
                }
                screenContext ||= conversationRuntime.getScreenContext(userId, data.sessionId);
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
