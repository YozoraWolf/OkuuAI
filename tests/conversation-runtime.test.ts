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

test('ConversationRuntime queues a forced frame and waits for that exact visual context', async () => {
    const analyzedFrames: string[] = [];
    const visionProvider = {
        analyze: async (frame: { base64: string; query?: string }) => {
            analyzedFrames.push(frame.base64);
            await new Promise(resolve => setTimeout(resolve, 10));
            return {
                observation: frame.query ? 'A black earbud case is visible.' : 'An older periodic frame.',
                comment: 'SKIP',
                category: 'info' as const,
                importance: 0.7,
            };
        },
    };
    const runtime = new ConversationRuntime(new EventBus<ConversationEvents>(), visionProvider);
    await runtime.start();

    runtime.submitFrame('user-1', 'session-1', {
        capturedAt: 1000, mimeType: 'image/jpeg', base64: 'periodic', width: 640, height: 360, stream: 'camera',
    });
    const accepted = runtime.submitFrame('user-1', 'session-1', {
        capturedAt: 2000,
        mimeType: 'image/jpeg',
        base64: 'requested',
        width: 640,
        height: 360,
        stream: 'camera',
        query: 'What am I holding?',
    }, true);
    const context = await runtime.waitForFreshScreenContext('user-1', 'session-1', 2000, 500);

    assert.equal(accepted, true);
    assert.deepEqual(analyzedFrames, ['periodic', 'requested']);
    assert.equal(context?.capturedAt, 2000);
    assert.equal(context?.requestedVisualContext, true);
    assert.match(context?.message || '', /earbud case/);
});
