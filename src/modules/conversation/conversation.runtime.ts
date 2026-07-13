import { randomUUID } from 'crypto';
import { EventBus, type EventListener } from '../../events/event-bus';
import type { ConversationEvent, ConversationEvents, ConversationObservation, ObservationCategory } from './conversation.events';

const MAX_OBSERVATIONS = 200;

export class ConversationRuntime {
    private active = false;
    private readonly observations: ConversationEvent[] = [];
    private stopRecording?: () => void;

    constructor(private readonly eventBus: EventBus<ConversationEvents>) {}

    isActive() {
        return this.active;
    }

    getHistory(userId: string) {
        return this.observations
            .filter(event => !event.userId || event.userId === userId)
            .map(event => event.observation);
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
    }

    async reportScreenState(userId: string, shared: boolean, application?: string) {
        if (!this.active) throw new Error('Conversation Mode is disabled');
        await this.publish(
            shared ? 'info' : 'warning',
            shared ? 'Screen sharing started. The local preview is active.' : 'Screen sharing stopped.',
            'screen',
            application,
            shared ? 0.7 : 0.5,
            userId,
        );
    }

    async publish(
        category: ObservationCategory,
        message: string,
        source: ConversationObservation['source'],
        application?: string,
        importance?: number,
        userId?: string,
    ) {
        if (!this.active) throw new Error('Conversation Mode is disabled');
        await this.eventBus.publish('ScreenObservation', {
            userId,
            observation: {
                id: randomUUID(),
                timestamp: Date.now(),
                category,
                message,
                source,
                application,
                importance,
            },
        });
    }
}
