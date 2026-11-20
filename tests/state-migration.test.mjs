import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { Storage } from '../js/core/storage.js';
import { QUESTS } from '../js/data/quests.js';
import { ACHIEVEMENTS } from '../js/data/achievements.js';

function installStorage(t) {
    const previous = globalThis.localStorage;
    const values = new Map();
    globalThis.localStorage = {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    };
    t.after(() => {
        if (previous === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previous;
    });
    return values;
}

test('legacy saves migrate missing systems without losing existing progression', (t) => {
    const values = installStorage(t);
    const legacyPlayer = {
        id: 42, username: 'Old Hero', telegramId: 123,
        class: 'warrior', level: 7, experience: 31, maxExperience: 180,
        health: 55, maxHealth: 120, mana: 12, maxMana: 40,
        attack: 45, defense: 28, speed: 10, gold: 765,
        inventory: [{ id: 'health_potion', quantity: 4 }],
        equipment: { weapon: 'iron_sword', armor: 'leather_armor' },
        unlockedLocations: ['forest', 'mountains'],
        talents: ['warrior_force'],
        quests: [{ id: 'first_blood', progress: 1, completed: true, rewardClaimed: true }],
        achievements: [{ id: 'first_kill', progress: 1, completed: true, claimed: true }]
    };
    values.set('rpg_adventure_save', JSON.stringify({ player: legacyPlayer }));
    assert.equal(gameState.load(), true);
    const player = gameState.player;
    assert.equal(player.level, 7);
    assert.equal(player.experience, 31);
    assert.equal(player.gold, 765);
    assert.equal(player.equipment.weapon, 'iron_sword');
    assert.deepEqual(player.stats, {
        kills: 0, battles: 0, wins: 0, losses: 0,
        dungeonsCompleted: 0, bossesKilled: 0
    });
    assert.equal(player.quests.length, QUESTS.length);
    assert.equal(player.achievements.length, ACHIEVEMENTS.length);
    assert.equal(player.quests.find(entry => entry.id === 'first_blood').rewardClaimed, true);
    assert.equal(player.achievements.find(entry => entry.id === 'first_kill').claimed, true);
    assert.deepEqual(player.dungeonCheckpoints, {});
    assert.equal(player.campaignCycle, 1);
    assert.equal(player.completedCampaignCycles, 0);
    assert.equal(player.campaignCompleted, false);
    assert.equal(player.newGamePlusUnlocked, false);
    assert.deepEqual(player.locationRewardCycles, {});
    assert.deepEqual(player.deepChestRewardCycles, {});
    assert.equal(gameState.save(), true);
    assert.equal(Storage.load().player.level, 7);
});

test('migration repairs malformed counters, equipment, inventory and checkpoints', (t) => {
    const values = installStorage(t);
    const malformed = {
        class: 'mage', level: -3, experience: NaN, maxExperience: 0,
        health: 999, maxHealth: 90, mana: -4, maxMana: 50,
        attack: Infinity, defense: -1, speed: 0, gold: -50,
        inventory: [
            { id: 'health_potion', quantity: 2 },
            { id: 'health_potion', quantity: 3 },
            { id: 'unknown_item', quantity: 99 },
            { id: 'mana_potion', quantity: -1 }
        ],
        equipment: { weapon: 'leather_armor', armor: 'unknown_item' },
        unlockedLocations: ['forest', 'unknown_location', 'mountains'],
        dungeonCheckpoints: { forest: 4, mountains: -1, village: 2, ruins: 999 },
        deepChestRewardCycles: { 'forest:20': 1, 'forest:10': 1, 'village:20': 1, 'unknown:20': 1, 'mountains:40': 2, broken: 1 },
        stats: { kills: -5, battles: 12.5, wins: 3, losses: 0, bossesKilled: 2 }
    };
    values.set('rpg_adventure_save', JSON.stringify({ player: malformed }));
    assert.equal(gameState.load(), true);
    const player = gameState.player;
    assert.equal(player.level, 1);
    assert.equal(player.experience, 0);
    assert.equal(player.maxExperience, 100);
    assert.equal(player.health, 90);
    assert.equal(player.mana, 50);
    assert.equal(player.gold, 100);
    assert.equal(player.attack, 20);
    assert.equal(player.defense, 3);
    assert.deepEqual(player.inventory, [{ id: 'health_potion', quantity: 5 }]);
    assert.deepEqual(player.equipment, { weapon: null, armor: null });
    assert.deepEqual(player.unlockedLocations, ['forest', 'mountains']);
    assert.deepEqual(player.dungeonCheckpoints, { forest: 4 });
    assert.deepEqual(player.deepChestRewardCycles, { 'forest:20': 1 },
        'only valid deep-chest milestones from the current campaign may survive migration');
    assert.deepEqual(player.stats, {
        kills: 0, battles: 0, wins: 3, losses: 0,
        dungeonsCompleted: 0, bossesKilled: 2
    });
});

test('invalid class save never replaces the active player', (t) => {
    installStorage(t);
    const previousWindow = globalThis.window;
    globalThis.window = {};
    t.after(() => {
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    });
    const activePlayer = gameState.createPlayer('archer');
    globalThis.localStorage.setItem('rpg_adventure_save', JSON.stringify({
        player: { class: 'unknown', inventory: [], equipment: {} }
    }));
    assert.equal(gameState.load(), false);
    assert.equal(gameState.player, activePlayer);
});
