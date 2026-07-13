import assert from 'node:assert/strict';
import test from 'node:test';
import { EventBus } from '../src/events/event-bus';
import type { ConversationEvents } from '../src/modules/conversation/conversation.events';
import { ConversationRuntime } from '../src/modules/conversation/conversation.runtime';

test('ConversationRuntime emits and retains structured observations while active', async () => {
    const eventBus = new EventBus<ConversationEvents>();
    const runtime = new ConversationRuntime(eventBus);
    const received: string[] = [];
    runtime.subscribe('user-1', observation => { received.push(observation.message); });

    await runtime.start();
    await runtime.reportScreenState('user-1', true, 'browser');

    assert.equal(runtime.isActive(), true);
    assert.equal(runtime.getHistory('user-1').length, 2);
    assert.match(received[1], /Screen sharing started/);
    assert.equal(runtime.getHistory('user-1')[1]?.application, 'browser');
});

test('ConversationRuntime rejects screen events when disabled', async () => {
    const runtime = new ConversationRuntime(new EventBus<ConversationEvents>());

    await assert.rejects(
        runtime.reportScreenState('user-1', true),
        /Conversation Mode is disabled/,
    );
});

test('ConversationRuntime isolates user observations', async () => {
    const runtime = new ConversationRuntime(new EventBus<ConversationEvents>());
    const userTwoMessages: string[] = [];
    runtime.subscribe('user-2', observation => { userTwoMessages.push(observation.message); });
    await runtime.start();

    await runtime.reportScreenState('user-1', true, 'window');

    assert.equal(userTwoMessages.length, 1);
    assert.equal(runtime.getHistory('user-2').length, 1);
});
