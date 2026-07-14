import { createHash, randomUUID } from 'crypto';
import { EventBus, type EventListener } from '../../events/event-bus';
import { Logger } from '../../logger';
import type { ConversationEvent, ConversationEvents, ConversationObservation, ObservationCategory, ScreenFrame, VisualStream } from './conversation.events';
import type { ConversationResearchProvider } from './context-research.service';
import type { VisionProvider } from './vision.provider';

const MAX_OBSERVATIONS = 200;

type FrameState = {
    inFlight: boolean;
    lastAcceptedAt: number;
    lastHash?: string;
    lastErrorAt?: number;
    pendingFrame?: ScreenFrame;
    cancelled?: boolean;
};

const sameResearchTopic = (left?: string, right?: string) => {
    if (!left || !right) return false;
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const normalizedLeft = normalize(left);
    const normalizedRight = normalize(right);
    return normalizedLeft === normalizedRight
        || (Math.min(normalizedLeft.length, normalizedRight.length) >= 6
            && (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)));
};

export class ConversationRuntime {
    private active = false;
    private readonly observations: ConversationEvent[] = [];
    private readonly frameStates = new Map<string, FrameState>();
    private readonly screenContexts = new Map<string, ConversationObservation>();
    private stopRecording?: () => void;

    constructor(
        private readonly eventBus: EventBus<ConversationEvents>,
        private readonly visionProvider?: VisionProvider,
        private readonly researchProvider?: ConversationResearchProvider,
    ) {}

    isActive() {
        return this.active;
    }

    getHistory(userId: string, sessionId?: string) {
        return this.observations
            .filter(event => (!event.userId || event.userId === userId) && (!event.sessionId || !sessionId || event.sessionId === sessionId))
            .map(event => event.observation);
    }

    getScreenContext(userId: string, sessionId: string) {
        return this.screenContexts.get(this.contextKey(userId, sessionId));
    }

    async setResearchConsent(userId: string, sessionId: string, topic: string, approved: boolean) {
        this.researchProvider?.setConsent?.(userId, sessionId, topic, approved);
        const current = this.screenContexts.get(this.contextKey(userId, sessionId));
        if (current?.researchApprovalRequired && sameResearchTopic(current.researchApprovalRequired, topic)) {
            current.researchApprovalRequired = undefined;
            await this.eventBus.publish('ScreenObservation', { userId, sessionId, observation: current });
        }
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

    subscribe(userId: string, sessionId: string, listener: EventListener<ConversationObservation>, signal?: AbortSignal) {
        return this.eventBus.subscribe('ScreenObservation', event => {
            if ((!event.userId || event.userId === userId) && (!event.sessionId || event.sessionId === sessionId)) return listener(event.observation);
        }, signal);
    }

    async start() {
        if (this.active) return;
        this.active = true;
        this.stopRecording = this.eventBus.subscribe('ScreenObservation', event => {
            const existingIndex = this.observations.findIndex(existing =>
                existing.observation.id === event.observation.id
                && existing.userId === event.userId
                && existing.sessionId === event.sessionId,
            );
            if (existingIndex >= 0) this.observations.splice(existingIndex, 1, event);
            else this.observations.push(event);
            if (this.observations.length > MAX_OBSERVATIONS) this.observations.shift();
        });
        await this.publish('success', 'Conversation Mode is ready.', 'conversation');
    }

    async stop() {
        if (!this.active) return;
        await this.publish('info', 'Conversation Mode was disabled.', 'conversation');
        this.active = false;
        this.frameStates.forEach(state => {
            state.cancelled = true;
            state.pendingFrame = undefined;
        });
        this.stopRecording?.();
        this.stopRecording = undefined;
        this.frameStates.clear();
        this.screenContexts.clear();
        this.researchProvider?.clearAll?.();
    }

    async reportScreenState(userId: string, sessionId: string, shared: boolean, application?: string, stream: VisualStream = 'screen') {
        if (!this.active) throw new Error('Conversation Mode is disabled');
        const key = this.contextKey(userId, sessionId);
        if (!shared) {
            this.screenContexts.delete(key);
            const state = this.frameStates.get(key);
            if (state) {
                state.cancelled = true;
                state.pendingFrame = undefined;
            }
            this.researchProvider?.clearSession(userId, sessionId);
        } else {
            // Replace rather than revive a cancelled state. Any analysis from the previous
            // stream keeps its cancelled object and cannot publish into this new stream.
            this.frameStates.set(key, { inFlight: false, lastAcceptedAt: 0 });
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
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            sessionId,
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
        if (state.cancelled) return false;
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
            const research = this.researchProvider?.get(userId, sessionId);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), Number(process.env.VISION_TIMEOUT_MS || 30000));
            let analysis;
            try {
                const previousContext = previous
                    ? `Observation: ${previous.message}\nComment: ${previous.comment || 'SKIP'}`
                    : undefined;
                analysis = await this.visionProvider!.analyze(frame, previousContext, controller.signal, research);
            } finally {
                clearTimeout(timeout);
            }
            if (!analysis.observation || !this.active || state.cancelled) return;
            const matchingResearch = sameResearchTopic(analysis.contextLabel, research?.topic) ? research : undefined;
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
                analysis.contextLabel,
                matchingResearch,
                sessionId,
            );
            this.screenContexts.set(key, observation);
            if (analysis.contextLabel) {
                const researchTask = this.researchProvider?.observe(userId, sessionId, {
                    topic: analysis.contextLabel,
                    focus: analysis.researchFocus,
                    confidence: analysis.contextConfidence,
                    depth: analysis.researchDepth,
                    observation: analysis.observation,
                });
                if (researchTask) void researchTask.then(async updatedResearch => {
                    const current = this.screenContexts.get(key);
                    let changed = false;
                    if (updatedResearch && current && sameResearchTopic(current.contextLabel, updatedResearch.topic)) {
                        current.research = updatedResearch;
                        changed = true;
                    }
                    const approvalRequired = this.researchProvider?.getPendingApproval?.(userId, sessionId);
                    if (current && current.researchApprovalRequired !== approvalRequired) {
                        current.researchApprovalRequired = approvalRequired;
                        changed = true;
                    }
                    if (current && changed) await this.eventBus.publish('ScreenObservation', { userId, sessionId, observation: current });
                }).catch(error => Logger.WARN(`[ConversationResearch] Observation processing failed: ${error}`));
            }
        } catch (error) {
            Logger.WARN(`Screen perception failed: ${error}`);
            if (Date.now() - (state.lastErrorAt || 0) > 60000 && this.active) {
                state.lastErrorAt = Date.now();
                try {
                    await this.publish('warning', 'Visual analysis is temporarily unavailable.', 'perception', frame.application, 0.7, userId, undefined, undefined, frame.stream, undefined, frame.capturedAt, Boolean(frame.query), undefined, undefined, sessionId);
                } catch { /* runtime stopped while reporting the error */ }
            }
        } finally {
            state.inFlight = false;
            const pendingFrame = state.pendingFrame;
            state.pendingFrame = undefined;
            if (pendingFrame && this.active && !state.cancelled) this.submitFrame(userId, sessionId, pendingFrame, true);
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
        contextLabel?: string,
        research?: ConversationObservation['research'],
        sessionId?: string,
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
            contextLabel,
            research,
        };
        await this.eventBus.publish('ScreenObservation', {
            userId,
            sessionId,
            observation,
        });
        return observation;
    }

    private contextKey(userId: string, sessionId: string) {
        return `${userId}:${sessionId}`;
    }
}
