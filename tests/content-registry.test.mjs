import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentRegistry } from '../js/core/contentRegistry.js';
import { ENEMY_REGISTRY } from '../js/data/enemies.js';
import { ITEM_REGISTRY, getItem, getItemsByType } from '../js/data/items.js';
import { QUEST_REGISTRY } from '../js/data/quests.js';
import { ACHIEVEMENT_REGISTRY } from '../js/data/achievements.js';
import { LOCATION_REGISTRY } from '../js/data/locations.js';

test('registry supports validated registration and stable lookups', () => {
    const registry = createContentRegistry({ kind: 'test', validate: item => typeof item.name === 'string' });
    const entry = { id: 'sample_relic', name: 'Sample Relic' };
    assert.equal(registry.register(entry), entry);
    assert.equal(registry.get('sample_relic'), entry);
    assert.equal(registry.has('sample_relic'), true);
    assert.deepEqual(registry.list(), [entry]);
    assert.equal(registry.size, 1);
});

test('registry rejects malformed ids, invalid definitions and duplicate ids atomically', () => {
    const registry = createContentRegistry({ kind: 'test', validate: item => typeof item.name === 'string' });
    assert.throws(() => registry.register({ id: 'Bad-ID', name: 'Bad' }), /Invalid test id/);
    assert.throws(() => registry.register({ id: 'missing_name' }), /Invalid test/);
    assert.throws(() => registry.registerMany([
        { id: 'first_entry', name: 'First' }, { id: 'first_entry', name: 'Duplicate' }
    ]), /Duplicate test id/);
    assert.equal(registry.size, 0);
    registry.register({ id: 'first_entry', name: 'First' });
    assert.throws(() => registry.register({ id: 'first_entry', name: 'Duplicate' }), /Duplicate test id/);
    assert.equal(registry.size, 1);
});

test('built-in content is registered without changing legacy lookup APIs', () => {
    assert.ok(ENEMY_REGISTRY.size >= 4);
    assert.ok(ITEM_REGISTRY.size >= 10);
    assert.ok(QUEST_REGISTRY.size > 0);
    assert.ok(ACHIEVEMENT_REGISTRY.size > 0);
    assert.ok(LOCATION_REGISTRY.size >= 5);
    assert.equal(getItem('health_potion').id, 'health_potion');
    assert.ok(getItemsByType('weapon').every(item => item.type === 'weapon'));
});
