import { createHash, randomUUID } from 'crypto';
import { EventBus, type EventListener } from '../../events/event-bus';
import { Logger } from '../../logger';
import type { ConversationEvent, ConversationEvents, ConversationObservation, ObservationCategory, ScreenFrame, VisualStream } from './conversation.events';
import type { VisionProvider } from './vision.provider';

const MAX_OBSERVATIONS = 200;

type FrameState = {
    inFlight: boolean;
    lastAcceptedAt: number;
    lastHash?: string;
    lastErrorAt?: number;
    pendingFrame?: ScreenFrame;
};

export class ConversationRuntime {
    private active = false;
    private readonly observations: ConversationEvent[] = [];
    private readonly frameStates = new Map<string, FrameState>();
    private readonly screenContexts = new Map<string, ConversationObservation>();
    private stopRecording?: () => void;

    constructor(private readonly eventBus: EventBus<ConversationEvents>, private readonly visionProvider?: VisionProvider) {}

    isActive() {
        return this.active;
    }

    getHistory(userId: string) {
        return this.observations
            .filter(event => !event.userId || event.userId === userId)
            .map(event => event.observation);
    }

    getScreenContext(userId: string, sessionId: string) {
        return this.screenContexts.get(this.contextKey(userId, sessionId));
    }

    waitForFreshScreenContext(userId: string, sessionId: string, capturedAfter: number, timeoutMs = 25000) {
        const key = this.contextKey(userId, sessionId);
        return new Promise<ConversationObservation | undefined>(resolve => {
            const startedAt = Date.now();
            const check = () => {
                const context = this.screenContexts.get(key);
                if (context?.capturedAt && context.capturedAt >= capturedAfter) {
                    clearInterval(timer);
                    resolve(context);
                } else if (!this.active || Date.now() - startedAt >= timeoutMs) {
                    clearInterval(timer);
                    resolve(undefined);
                }
            };
            const timer = setInterval(check, 100);
            check();
        });
    }

    subscribe(userId: string, listener: EventListener<ConversationObservation>, signal?: AbortSignal) {
        return this.eventBus.subscribe('ScreenObservation', event => {
            if (!event.userId || event.userId === userId) return listener(event.observation);
        }, signal);
    }

    async start() {
        if (this.active) return;
        this.active = true;
        this.stopRecording = this.eventBus.subscribe('ScreenObservation', event => {
            this.observations.push(event);
            if (this.observations.length > MAX_OBSERVATIONS) this.observations.shift();
        });
        await this.publish('success', 'Conversation Mode is ready.', 'conversation');
    }

    async stop() {
        if (!this.active) return;
        await this.publish('info', 'Conversation Mode was disabled.', 'conversation');
        this.active = false;
        this.stopRecording?.();
        this.stopRecording = undefined;
        this.frameStates.clear();
        this.screenContexts.clear();
    }

    async reportScreenState(userId: string, sessionId: string, shared: boolean, application?: string, stream: VisualStream = 'screen') {
        if (!this.active) throw new Error('Conversation Mode is disabled');
        if (!shared) {
            this.screenContexts.delete(this.contextKey(userId, sessionId));
            this.frameStates.delete(this.contextKey(userId, sessionId));
        }
        const label = stream === 'camera' ? 'Camera sharing' : 'Screen sharing';
        await this.publish(
            shared ? 'info' : 'warning',
            shared ? `${label} started. Visual perception is active.` : `${label} stopped.`,
            'screen',
            application,
            shared ? 0.7 : 0.5,
            userId,
            undefined,
            undefined,
            stream,
        );
    }

    submitFrame(userId: string, sessionId: string, frame: ScreenFrame, force = false) {
        if (!this.active) throw new Error('Conversation Mode is disabled');
        if (!this.visionProvider) throw new Error('Vision provider is unavailable');
        if (
            !['image/jpeg', 'image/webp'].includes(frame.mimeType)
            || !frame.base64
            || frame.base64.length > 1_400_000
            || !Number.isInteger(frame.width)
            || !Number.isInteger(frame.height)
            || frame.width < 1
            || frame.height < 1
            || frame.width > 2048
            || frame.height > 2048
        ) {
            throw new Error('Invalid screen frame');
        }

        const key = this.contextKey(userId, sessionId);
        const state = this.frameStates.get(key) || { inFlight: false, lastAcceptedAt: 0 };
        if (state.inFlight) {
            if (force) state.pendingFrame = frame;
            this.frameStates.set(key, state);
            return force;
        }
        const now = Date.now();
        const intervalMs = Number(process.env.VISION_ANALYSIS_INTERVAL_MS || 1500);
        const refreshMs = frame.stream === 'camera' ? 6000 : 10000;
        const hash = createHash('sha256').update(frame.base64).digest('hex');
        const duplicateTooSoon = state.lastHash === hash && now - state.lastAcceptedAt < refreshMs;
        if (!force && (now - state.lastAcceptedAt < intervalMs || duplicateTooSoon)) return false;

        state.inFlight = true;
        state.lastAcceptedAt = now;
        state.lastHash = hash;
        this.frameStates.set(key, state);
        void this.analyzeFrame(key, userId, sessionId, frame, state).catch(error => Logger.WARN(`Screen perception task failed: ${error}`));
        return true;
    }

    private async analyzeFrame(
        key: string,
        userId: string,
        sessionId: string,
        frame: ScreenFrame,
        state: FrameState,
    ) {
        const startedAt = Date.now();
        try {
            const previous = this.screenContexts.get(key);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), Number(process.env.VISION_TIMEOUT_MS || 30000));
            let analysis;
            try {
                const previousContext = previous
                    ? `Observation: ${previous.message}\nComment: ${previous.comment || 'SKIP'}`
                    : undefined;
                analysis = await this.visionProvider!.analyze(frame, previousContext, controller.signal);
            } finally {
                clearTimeout(timeout);
            }
            if (!analysis.observation || !this.active) return;
            const observation = await this.publish(
                analysis.category,
                analysis.observation,
                'perception',
                frame.application,
                analysis.importance,
                userId,
                Date.now() - startedAt,
                analysis.extractedText,
                frame.stream,
                analysis.comment,
                frame.capturedAt,
                Boolean(frame.query),
            );
            this.screenContexts.set(key, observation);
        } catch (error) {
            Logger.WARN(`Screen perception failed: ${error}`);
            if (Date.now() - (state.lastErrorAt || 0) > 60000 && this.active) {
                state.lastErrorAt = Date.now();
                try {
                    await this.publish('warning', 'Visual analysis is temporarily unavailable.', 'perception', frame.application, 0.7, userId);
                } catch { /* runtime stopped while reporting the error */ }
            }
        } finally {
            state.inFlight = false;
            const pendingFrame = state.pendingFrame;
            state.pendingFrame = undefined;
            if (pendingFrame && this.active) this.submitFrame(userId, sessionId, pendingFrame, true);
        }
    }

    async publish(
        category: ObservationCategory,
        message: string,
        source: ConversationObservation['source'],
        application?: string,
        importance?: number,
        userId?: string,
        latencyMs?: number,
        extractedText?: string,
        stream?: VisualStream,
        comment?: string,
        capturedAt?: number,
        requestedVisualContext?: boolean,
    ) {
        if (!this.active) throw new Error('Conversation Mode is disabled');
        const observation: ConversationObservation = {
            id: randomUUID(),
            timestamp: Date.now(),
            category,
            message,
            source,
            stream,
            application,
            importance,
            latencyMs,
            extractedText,
            comment,
            capturedAt,
            requestedVisualContext,
        };
        await this.eventBus.publish('ScreenObservation', {
            userId,
            observation,
        });
        return observation;
    }

    private contextKey(userId: string, sessionId: string) {
        return `${userId}:${sessionId}`;
    }
}
