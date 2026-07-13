import assert from 'node:assert/strict';
import test from 'node:test';
import { EventBus } from '../src/events/event-bus';

type TestEvents = { Updated: { value: number } };

test('EventBus publishes typed events to subscribers', async () => {
    const eventBus = new EventBus<TestEvents>();
    const values: number[] = [];
    eventBus.subscribe('Updated', event => { values.push(event.value); });

    await eventBus.publish('Updated', { value: 42 });

    assert.deepEqual(values, [42]);
});

test('EventBus removes AbortSignal subscriptions', async () => {
    const eventBus = new EventBus<TestEvents>();
    const controller = new AbortController();
    let calls = 0;
    eventBus.subscribe('Updated', () => { calls += 1; }, controller.signal);
    controller.abort();

    await eventBus.publish('Updated', { value: 1 });

    assert.equal(calls, 0);
});
