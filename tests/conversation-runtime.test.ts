import assert from 'node:assert/strict';
import test from 'node:test';
import { EventBus } from '../src/events/event-bus';
import type { ConversationEvents } from '../src/modules/conversation/conversation.events';
import { ConversationRuntime } from '../src/modules/conversation/conversation.runtime';

test('ConversationRuntime emits and retains structured observations while active', async () => {
    const eventBus = new EventBus<ConversationEvents>();
    const runtime = new ConversationRuntime(eventBus);
    const received: string[] = [];
    runtime.subscribe('user-1', 'session-1', observation => { received.push(observation.message); });

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
    runtime.subscribe('user-2', 'session-1', observation => { userTwoMessages.push(observation.message); });
    await runtime.start();

    await runtime.reportScreenState('user-1', 'session-1', true, 'window');

    assert.equal(userTwoMessages.length, 1);
    assert.equal(runtime.getHistory('user-2').length, 1);
});

test('ConversationRuntime isolates observations between sessions for the same user', async () => {
    const runtime = new ConversationRuntime(new EventBus<ConversationEvents>());
    const otherSessionMessages: string[] = [];
    runtime.subscribe('user-1', 'session-2', observation => { otherSessionMessages.push(observation.message); });
    await runtime.start();

    await runtime.reportScreenState('user-1', 'session-1', true, 'window');

    assert.equal(otherSessionMessages.length, 1);
    assert.equal(runtime.getHistory('user-1', 'session-2').length, 1);
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

test('ConversationRuntime suppresses semantically repeated periodic observations', async () => {
    let call = 0;
    const visionProvider = {
        analyze: async () => {
            call += 1;
            return {
                observation: call === 1
                    ? 'The image shows a social media post featuring a 7-Eleven sign and user interaction options.'
                    : 'The image displays a social media post featuring a 7-Eleven sign and user interaction panel.',
                comment: 'SKIP',
                category: 'info' as const,
                importance: 0.7,
            };
        },
    };
    const runtime = new ConversationRuntime(new EventBus<ConversationEvents>(), visionProvider);
    await runtime.start();
    runtime.submitFrame('user-1', 'session-1', {
        capturedAt: 1000, mimeType: 'image/jpeg', base64: 'first-frame', width: 640, height: 360, stream: 'screen',
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    runtime.submitFrame('user-1', 'session-1', {
        capturedAt: 2000, mimeType: 'image/jpeg', base64: 'second-frame', width: 640, height: 360, stream: 'screen',
    }, true);
    await new Promise(resolve => setTimeout(resolve, 10));

    const perceptionHistory = runtime.getHistory('user-1', 'session-1').filter(item => item.source === 'perception');
    assert.equal(call, 2);
    assert.equal(perceptionHistory.length, 1);
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

test('ConversationRuntime does not revive an old frame after screen sharing restarts', async () => {
    let resolveAnalysis: ((value: any) => void) | undefined;
    const visionProvider = {
        analyze: () => new Promise(resolve => { resolveAnalysis = resolve; }),
    };
    const runtime = new ConversationRuntime(new EventBus<ConversationEvents>(), visionProvider);
    await runtime.start();
    await runtime.reportScreenState('user-1', 'session-1', true, 'window');
    runtime.submitFrame('user-1', 'session-1', {
        capturedAt: 1000, mimeType: 'image/jpeg', base64: 'old-stream-frame', width: 640, height: 360, stream: 'screen',
    });

    await runtime.reportScreenState('user-1', 'session-1', false, 'window');
    await runtime.reportScreenState('user-1', 'session-1', true, 'window');
    resolveAnalysis?.({ observation: 'Stale content from the old stream.', category: 'info', importance: 0.7 });
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(runtime.getScreenContext('user-1', 'session-1'), undefined);
});

test('ConversationRuntime injects accumulated research and emits new research signals', async () => {
    const researchContext = {
        topic: 'Neverness to Everness',
        summary: 'An urban supernatural open-world RPG with vehicle exploration.',
        sources: [{ title: 'Official site', url: 'https://nte.perfectworld.com/' }],
        updatedAt: Date.now(),
    };
    let receivedResearch: typeof researchContext | undefined;
    let receivedSignal: any;
    const researchProvider = {
        get: () => researchContext,
        observe: async (_userId: string, _sessionId: string, signal: any) => {
            receivedSignal = signal;
            return researchContext;
        },
        clearSession: () => undefined,
    };
    const visionProvider = {
        analyze: async (_frame: any, _previous: any, _signal: any, research: typeof researchContext) => {
            receivedResearch = research;
            return {
                observation: 'The vehicle customization menu is open.',
                comment: 'That paint choice has considerably more confidence than restraint. ^^',
                category: 'info' as const,
                importance: 0.8,
                contextLabel: 'Neverness to Everness',
                contextConfidence: 0.96,
                researchFocus: 'mechanics' as const,
                researchDepth: 'simple' as const,
            };
        },
    };
    const runtime = new ConversationRuntime(new EventBus<ConversationEvents>(), visionProvider, researchProvider);
    await runtime.start();
    runtime.submitFrame('user-1', 'session-1', {
        capturedAt: Date.now(), mimeType: 'image/jpeg', base64: 'nte-frame', width: 640, height: 360, stream: 'screen',
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(receivedResearch?.topic, 'Neverness to Everness');
    assert.equal(receivedSignal?.depth, 'simple');
    assert.equal(receivedSignal?.focus, 'mechanics');
    assert.equal(runtime.getScreenContext('user-1', 'session-1')?.research?.topic, 'Neverness to Everness');
});
