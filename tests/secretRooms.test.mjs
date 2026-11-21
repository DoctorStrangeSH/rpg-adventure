import test from 'node:test';
import assert from 'node:assert/strict';
import { SECRET_ROOMS, rollSecretRoom, resolveSecretRoom } from '../js/systems/secretRooms.js';

const hero = () => ({
    health: 45,
    maxHealth: 100,
    mana: 10,
    maxMana: 60,
    inventory: [],
    discoveredItems: [],
    relics: []
});

test('secret room roll boundaries cover every room and reject invalid rolls', () => {
    assert.equal(rollSecretRoom(0).id, 'armory');
    assert.equal(rollSecretRoom(0.34).id, 'sanctuary');
    assert.equal(rollSecretRoom(0.67).id, 'crypt');
    assert.equal(rollSecretRoom(1), null);
    assert.equal(rollSecretRoom(-0.01), null);
    assert.equal(rollSecretRoom(NaN), null);
    assert.equal(SECRET_ROOMS.length, 3);
});

test('leaving any secret room has no side effects', () => {
    for (const room of SECRET_ROOMS) {
        const player = hero();
        const before = structuredClone(player);
        const result = resolveSecretRoom(player, room.id, 'leave', 0.2);
        assert.ok(result, room.id + ' must allow leaving');
        assert.deepEqual(player, before, room.id + ' leave must not change player state');
    }
});

test('every secret room resolves deterministic trap and reward outcomes safely', () => {
    for (const room of SECRET_ROOMS) {
        const trapped = hero();
        const trap = resolveSecretRoom(trapped, room.id, 'explore', 0.9);
        assert.ok(trap, room.id + ' trap outcome must resolve');
        assert.ok(trapped.health >= 1 && trapped.health <= trapped.maxHealth);
        assert.equal(trapped.mana, 10);

        const rewarded = hero();
        const reward = resolveSecretRoom(rewarded, room.id, 'explore', 0.2);
        assert.ok(reward, room.id + ' reward outcome must resolve');
        assert.ok(rewarded.health >= 1 && rewarded.health <= rewarded.maxHealth);
        assert.ok(rewarded.mana >= 0 && rewarded.mana <= rewarded.maxMana);
        if (room.id === 'armory') assert.ok(rewarded.inventory.length > 0);
        if (room.id === 'sanctuary') {
            assert.equal(rewarded.health, 85);
            assert.equal(rewarded.mana, 35);
        }
        if (room.id === 'crypt') assert.equal(rewarded.relics.length, 1);
    }
});

test('secret room reward refuses a full item stack without partial mutation', () => {
    const player = hero();
    player.inventory = [{ id: 'big_health_potion', quantity: Number.MAX_SAFE_INTEGER }];
    const before = structuredClone(player);
    assert.equal(resolveSecretRoom(player, 'armory', 'explore', 0.2), null);
    assert.deepEqual(player, before);
});

test('secret room resolver rejects unknown rooms, choices and invalid random values', () => {
    const player = hero();
    const before = structuredClone(player);
    assert.equal(resolveSecretRoom(null, 'armory', 'explore', 0.2), null);
    assert.equal(resolveSecretRoom(player, 'unknown', 'explore', 0.2), null);
    assert.equal(resolveSecretRoom(player, 'armory', 'unknown', 0.2), null);
    assert.equal(resolveSecretRoom(player, 'armory', 'explore', NaN), null);
    assert.equal(resolveSecretRoom(player, 'armory', 'explore', 1), null);
    assert.deepEqual(player, before);
});
