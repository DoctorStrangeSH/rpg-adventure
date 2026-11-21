import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentRegistry } from '../js/core/contentRegistry.js';
import { ENEMY_REGISTRY } from '../js/data/enemies.js';
import { ITEM_REGISTRY, getItem, getItemsByType, validateItemDefinition } from '../js/data/items.js';
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


test('all shipped items satisfy progression, rarity and combat-effect contracts', () => {
    for (const item of ITEM_REGISTRY.list()) {
        assert.equal(validateItemDefinition(item), true, item.id);
        if (item.type === 'weapon') assert.ok(Number.isFinite(item.attackBonus) && item.attackBonus >= 0, item.id);
        if (item.type === 'armor') assert.ok(Number.isFinite(item.defenseBonus) && item.defenseBonus >= 0, item.id);
        if (item.requiredLevel !== undefined) assert.ok(Number.isSafeInteger(item.requiredLevel) && item.requiredLevel >= 1, item.id);
    }
});

test('item registry rejects malformed progression values and effect probabilities', () => {
    const base = { id: 'test_blade', name: 'Test Blade', type: 'weapon', rarity: 'rare', attackBonus: 10, price: 100 };
    assert.match(validateItemDefinition({ ...base, requiredLevel: 0 }), /requiredLevel/);
    assert.match(validateItemDefinition({ ...base, attackBonus: -1 }), /attackBonus/);
    assert.match(validateItemDefinition({ ...base, rarity: 'mythic' }), /rarity/);
    assert.match(validateItemDefinition({ ...base, onHit: { type: 'burn', chance: 1.5, turns: 2 } }), /chance/);
    assert.match(validateItemDefinition({ ...base, onHit: { type: 'burn', chance: 0.2, turns: 0 } }), /duration/);
});

test('valid bounded healing armor and critical weapon effects remain accepted', () => {
    assert.equal(validateItemDefinition({
        id: 'test_armor', name: 'Test Armor', type: 'armor', rarity: 'rare',
        defenseBonus: 10, price: 100,
        onDamaged: { type: 'heal', chance: 0.25, fraction: 0.2, maxHealthFraction: 0.1 }
    }), true);
    assert.equal(validateItemDefinition({
        id: 'test_blade', name: 'Test Blade', type: 'weapon', rarity: 'legendary',
        attackBonus: 40, price: 100,
        onCrit: { type: 'echo', fraction: 0.25, maxTargetHealthFraction: 0.08 }
    }), true);
});


test('weapon progression keeps level gates and base power within the intended tier ladder', () => {
    const expected = [
        ['iron_sword', 2, 15],
        ['blood_dagger', 3, 12],
        ['ember_sword', 4, 20],
        ['frost_blade', 6, 24],
        ['moonblade', 6, 28],
        ['dragon_sword', 8, 40]
    ];
    for (const [id, level, attack] of expected) {
        const item = getItem(id);
        assert.equal(item.requiredLevel, level, id);
        assert.equal(item.attackBonus, attack, id);
    }
    assert.ok(getItem('dragon_sword').attackBonus > getItem('moonblade').attackBonus);
});

test('armor progression retains valid defensive tiers and level requirements', () => {
    const expected = [
        ['leather_armor', undefined, 8],
        ['blood_armor', 3, 13],
        ['guardian_armor', 4, 17],
        ['frost_armor', 6, 19]
    ];
    for (const [id, level, defense] of expected) {
        const item = getItem(id);
        assert.equal(item.requiredLevel, level, id);
        assert.equal(item.defenseBonus, defense, id);
    }
});
