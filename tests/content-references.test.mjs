import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContentReferences } from '../js/data/validateContent.js';

test('all shipped regions, encounters and quest rewards resolve to registered content', () => {
    assert.deepEqual(validateContentReferences(), { valid: true, errors: [] });
});

test('content reference validator reports missing enemy and item references', () => {
    const result = validateContentReferences({
        enemies: { has: id => id !== 'missing_enemy' },
        items: { has: id => id !== 'missing_item' },
        quests: { list: () => [{ id: 'test_quest', rewardItems: [{ id: 'missing_item' }] }] },
        locations: { list: () => [{
            id: 'test_region',
            stages: [{ enemies: ['missing_enemy'] }],
            rewards: { items: [{ id: 'missing_item' }] }
        }] }
    });
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 3);
});
