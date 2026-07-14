import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalVisionProvider } from '../src/modules/conversation/vision.provider';

test('Vision provider recovers observation fields from JSON truncated by runaway OCR', () => {
    const provider = new LocalVisionProvider() as any;
    const response = `{ "observation": "A social media post features a 7-Eleven sign.", "comment": "SKIP", "category": "info", "importance": 0.7, "extractedText": "7-ELEVEN\\n7-ELEVEN\\n7-E`;

    const result = provider.parse(response);

    assert.equal(result.observation, 'A social media post features a 7-Eleven sign.');
    assert.equal(result.comment, 'SKIP');
    assert.equal(result.category, 'info');
    assert.equal(result.importance, 0.7);
    assert.doesNotMatch(result.observation, /^\s*\{/);
});

test('Vision provider deduplicates repeated OCR lines', () => {
    const provider = new LocalVisionProvider() as any;
    const response = JSON.stringify({
        observation: 'A convenience-store sign is visible.',
        comment: 'SKIP',
        category: 'info',
        importance: 0.6,
        extractedText: '7-ELEVEN\n7-ELEVEN\nOPEN\nOPEN',
    });

    const result = provider.parse(response);

    assert.equal(result.extractedText, '7-ELEVEN\nOPEN');
});
