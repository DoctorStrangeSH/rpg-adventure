import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createPlayerSnapshot, restorePlayerSnapshot, commitPlayerMutation
} from '../js/systems/playerTransactions.js';

test('failed save rolls back a player mutation in place without replacing its object identity', () => {
    const player = {
        gold: 500,
        inventory: [{ id: 'iron_ore', quantity: 8 }],
        weaponRunes: { iron_sword: ['flame'] }
    };
    const reference = player;
    const snapshot = createPlayerSnapshot(player);

    player.gold -= 100;
    player.inventory[0].quantity -= 4;
    player.weaponRunes.iron_sword.push('blood');

    assert.equal(commitPlayerMutation(player, snapshot, () => false), false);
    assert.equal(player, reference);
    assert.deepEqual(player, {
        gold: 500,
        inventory: [{ id: 'iron_ore', quantity: 8 }],
        weaponRunes: { iron_sword: ['flame'] }
    });
});

test('a thrown persistence error also rolls back the complete player state', () => {
    const player = { level: 7, experience: 25, discoveredItems: ['iron_sword'] };
    const snapshot = createPlayerSnapshot(player);
    player.level = 8;
    player.experience = 0;
    player.discoveredItems.push('dragon_sword');

    assert.equal(commitPlayerMutation(player, snapshot, () => {
        throw new Error('QuotaExceededError');
    }), false);
    assert.deepEqual(player, {
        level: 7, experience: 25, discoveredItems: ['iron_sword']
    });
});

test('successful persistence keeps the mutation and does not restore the snapshot', () => {
    const player = { gold: 100 };
    const snapshot = createPlayerSnapshot(player);
    player.gold = 75;
    let saveCalls = 0;

    assert.equal(commitPlayerMutation(player, snapshot, () => {
        saveCalls++;
        return true;
    }), true);
    assert.equal(saveCalls, 1);
    assert.equal(player.gold, 75);
});

test('invalid snapshots are rejected without invoking persistence', () => {
    const player = { gold: 100 };
    assert.equal(createPlayerSnapshot(null), null);
    assert.equal(restorePlayerSnapshot(player, null), false);
    let saveCalls = 0;
    assert.equal(commitPlayerMutation(player, null, () => {
        saveCalls++;
        return true;
    }), false);
    assert.equal(saveCalls, 0);
    assert.deepEqual(player, { gold: 100 });
});
