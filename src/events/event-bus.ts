export type EventListener<T> = (event: T) => void | Promise<void>;

export class EventBus<TEvents extends object> {
    private readonly listeners = new Map<keyof TEvents, Set<EventListener<unknown>>>();

    subscribe<TKey extends keyof TEvents>(
        eventName: TKey,
        listener: EventListener<TEvents[TKey]>,
        signal?: AbortSignal,
    ) {
        if (signal?.aborted) return () => undefined;

        const listeners = this.listeners.get(eventName) ?? new Set<EventListener<unknown>>();
        listeners.add(listener as EventListener<unknown>);
        this.listeners.set(eventName, listeners);

        const unsubscribe = () => {
            listeners.delete(listener as EventListener<unknown>);
            if (listeners.size === 0) this.listeners.delete(eventName);
        };
        signal?.addEventListener('abort', unsubscribe, { once: true });
        return unsubscribe;
    }

    async publish<TKey extends keyof TEvents>(eventName: TKey, event: TEvents[TKey]) {
        const listeners = [...(this.listeners.get(eventName) ?? [])];
        await Promise.all(listeners.map(listener => listener(event)));
    }
}
