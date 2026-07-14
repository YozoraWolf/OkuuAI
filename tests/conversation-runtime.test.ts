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
    await runtime.reportScreenState('user-1', 'session-1', true, 'browser');

    assert.equal(runtime.isActive(), true);
    assert.equal(runtime.getHistory('user-1').length, 2);
    assert.match(received[1], /Screen sharing started/);
    assert.equal(runtime.getHistory('user-1')[1]?.application, 'browser');
});

test('ConversationRuntime rejects screen events when disabled', async () => {
    const runtime = new ConversationRuntime(new EventBus<ConversationEvents>());

    await assert.rejects(
        runtime.reportScreenState('user-1', 'session-1', true),
        /Conversation Mode is disabled/,
    );
});

test('ConversationRuntime isolates user observations', async () => {
    const runtime = new ConversationRuntime(new EventBus<ConversationEvents>());
    const userTwoMessages: string[] = [];
    runtime.subscribe('user-2', observation => { userTwoMessages.push(observation.message); });
    await runtime.start();

    await runtime.reportScreenState('user-1', 'session-1', true, 'window');

    assert.equal(userTwoMessages.length, 1);
    assert.equal(runtime.getHistory('user-2').length, 1);
});

test('ConversationRuntime analyzes frames and exposes session context', async () => {
    const visionProvider = {
        analyze: async () => ({
            observation: 'A build failed in the terminal.',
            comment: 'That build failed; I would check the first TypeScript error.',
            category: 'error' as const,
            importance: 0.9,
            extractedText: 'Build failed',
        }),
    };
    const runtime = new ConversationRuntime(new EventBus<ConversationEvents>(), visionProvider);
    await runtime.start();

    const accepted = runtime.submitFrame('user-1', 'session-1', {
        capturedAt: Date.now(), mimeType: 'image/jpeg', base64: 'frame-data', width: 640, height: 360, stream: 'camera',
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(accepted, true);
    assert.equal(runtime.getScreenContext('user-1', 'session-1')?.category, 'error');
    assert.equal(runtime.getScreenContext('user-1', 'session-1')?.stream, 'camera');
    assert.match(runtime.getScreenContext('user-1', 'session-1')?.comment || '', /build failed/);
    assert.equal(runtime.getScreenContext('user-2', 'session-1'), undefined);
});
