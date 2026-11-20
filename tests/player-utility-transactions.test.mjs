import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlayerGold, healPlayer, restorePlayerMana } from '../js/systems/playerUtilities.js';

test('health and mana restoration roll back when persistence fails', () => {
    const player = { health: 20, maxHealth: 100, mana: 5, maxMana: 40 };
    const before = structuredClone(player);
    assert.equal(healPlayer(player, 30, () => false), false);
    assert.deepEqual(player, before);
    assert.equal(restorePlayerMana(player, 15, () => { throw new Error('QuotaExceededError'); }), false);
    assert.deepEqual(player, before);
});

test('gold grants roll back on failed saves and preserve the player object', () => {
    const player = { gold: 120, inventory: [{ id: 'health_potion', quantity: 2 }] };
    const reference = player;
    assert.equal(addPlayerGold(player, 50, () => false), false);
    assert.equal(player, reference);
    assert.deepEqual(player, { gold: 120, inventory: [{ id: 'health_potion', quantity: 2 }] });
});

test('successful health, mana and gold changes persist exactly once each', () => {
    const player = { health: 30, maxHealth: 100, mana: 10, maxMana: 50, gold: 200 };
    let saves = 0;
    const save = () => { saves++; return true; };
    assert.equal(healPlayer(player, 25, save), true);
    assert.equal(restorePlayerMana(player, 20, save), true);
    assert.equal(addPlayerGold(player, 75, save), true);
    assert.deepEqual(player, { health: 55, maxHealth: 100, mana: 30, maxMana: 50, gold: 275 });
    assert.equal(saves, 3);
});

test('invalid and overflow amounts are rejected without mutation or persistence', () => {
    const player = {
        health: 40, maxHealth: 100, mana: 20, maxMana: 50,
        gold: Number.MAX_SAFE_INTEGER - 1
    };
    let saves = 0;
    const save = () => { saves++; return true; };
    assert.equal(healPlayer(player, -5, save), false);
    assert.equal(restorePlayerMana(player, Infinity, save), false);
    assert.equal(addPlayerGold(player, 2, save), false);
    assert.equal(addPlayerGold(player, 1.5, save), false);
    assert.equal(saves, 0);
    assert.equal(player.health, 40);
    assert.equal(player.mana, 20);
    assert.equal(player.gold, Number.MAX_SAFE_INTEGER - 1);
});

test('restoring an already-full resource is a safe no-op without an unnecessary save', () => {
    const player = { health: 100, maxHealth: 100, mana: 50, maxMana: 50 };
    let saves = 0;
    assert.equal(healPlayer(player, 10, () => { saves++; return true; }), true);
    assert.equal(restorePlayerMana(player, 10, () => { saves++; return true; }), true);
    assert.equal(saves, 0);
});
