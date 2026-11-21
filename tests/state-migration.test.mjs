import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { RECOVERY_SAVE_KEY, Storage } from '../js/core/storage.js';
import { QUESTS } from '../js/data/quests.js';
import { ACHIEVEMENTS } from '../js/data/achievements.js';
import { LOCATIONS } from '../js/data/locations.js';

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


test('future-version saves are preserved when the active player saves', (t) => {
    const values = installStorage(t);
    const futureSave = JSON.stringify({
        schemaVersion: 99,
        player: { class: 'warrior', level: 42, futureProgress: { chapter: 8 } }
    });
    values.set('rpg_adventure_save', futureSave);
    const activePlayer = gameState.createPlayer('archer');

    assert.equal(gameState.load(), false);
    assert.equal(gameState.player, activePlayer);
    assert.equal(values.get('rpg_adventure_save'), futureSave);
    assert.equal(gameState.save(), true);
    assert.equal(values.get(RECOVERY_SAVE_KEY), futureSave);
    assert.equal(Storage.loadRecovery().player.futureProgress.chapter, 8);
    assert.equal(gameState.player.class, 'archer');
});

test('migration normalizes saved equipment upgrades and rune sockets without losing valid progression', (t) => {
    const values = installStorage(t);
    const saved = {
        class: 'warrior',
        level: 12,
        equipment: { weapon: 'iron_sword', armor: 'leather_armor' },
        itemUpgrades: {
            iron_sword: 4,
            leather_armor: 8,
            dragon_sword: 99,
            health_potion: 5,
            unknown_weapon: 3,
            malformed: 1.5,
            negative: -2
        },
        weaponRunes: {
            iron_sword: ['flame', 'retired_rune', 'flame', 'frost', 'blood', 'storm'],
            dragon_sword: ['dragon'],
            health_potion: ['blood'],
            unknown_weapon: ['flame'],
            malformed: 'flame'
        },
        inventory: [{ id: 'health_potion', quantity: 2 }]
    };
    values.set('rpg_adventure_save', JSON.stringify({ player: saved }));

    assert.equal(gameState.load(), true);
    const player = gameState.player;
    assert.deepEqual(player.itemUpgrades, {
        iron_sword: 4,
        leather_armor: 8,
        dragon_sword: 10
    });
    assert.deepEqual(player.weaponRunes, {
        iron_sword: ['flame', 'frost', 'blood'],
        dragon_sword: ['dragon']
    });
    assert.equal(gameState.save(), true);
    const reloaded = Storage.load().player;
    assert.deepEqual(reloaded.itemUpgrades, player.itemUpgrades);
    assert.deepEqual(reloaded.weaponRunes, player.weaponRunes);
});

test('migration replaces malformed equipment progression containers with empty safe records', (t) => {
    const values = installStorage(t);
    values.set('rpg_adventure_save', JSON.stringify({
        player: {
            class: 'mage',
            itemUpgrades: ['iron_sword', 10],
            weaponRunes: 'not-a-record',
            inventory: [],
            equipment: {}
        }
    }));

    assert.equal(gameState.load(), true);
    assert.deepEqual(gameState.player.itemUpgrades, {});
    assert.deepEqual(gameState.player.weaponRunes, {});
});


test('version-one historical profile keeps NG+, claims, equipment and a resumable expedition through migrate-save-reload', (t) => {
    const values = installStorage(t);
    const previousData = gameState.data;
    const previousUnlocks = LOCATIONS.map(location => location.unlocked);
    t.after(() => {
        gameState.data = previousData;
        LOCATIONS.forEach((location, index) => { location.unlocked = previousUnlocks[index]; });
    });

    const historicalProfile = {
        id: 84, username: 'Legacy Hero', class: 'warrior',
        level: 18, experience: 35, maxExperience: 500,
        health: 180, maxHealth: 240, mana: 70, maxMana: 90, gold: 1250,
        inventory: [{ id: 'health_potion', quantity: 4 }, { id: 'mana_potion', quantity: 2 }],
        equipment: { weapon: 'iron_sword', armor: 'leather_armor' },
        itemUpgrades: { iron_sword: 3, leather_armor: 2 },
        weaponRunes: { iron_sword: ['flame'] },
        unlockedLocations: ['forest', 'mountains', 'ruins', 'dragon_lair'],
        talents: ['warrior_force'], relics: ['ember_crown'], activeRelics: ['ember_crown'],
        discoveredItems: ['iron_sword'],
        quests: [{ id: 'first_blood', progress: 1, completed: true, rewardClaimed: true }],
        achievements: [{ id: 'first_kill', progress: 1, completed: true, claimed: true }],
        stats: { kills: 300, battles: 400, wins: 350, losses: 5, dungeonsCompleted: 4, bossesKilled: 18 },
        campaignCycle: 2, completedCampaignCycles: 1, lastCompletedCampaignCycle: 1,
        campaignCompleted: false, newGamePlusUnlocked: true,
        locationRewardCycles: { forest: 2, mountains: 2 },
        deepChestRewardCycles: { 'forest:20': 2 },
        dungeonCheckpoints: { forest: 2 },
        dungeonProgress: {
            forest: {
                campaignCycle: 2, stage: 1, enemiesDefeated: 1,
                visitedEventStages: [0], visitedRouteStages: [1],
                routeChoices: { 1: 'danger' }, checkedSecretStages: [0],
                visitedCheckpointStages: [0], claimedDeepChestStages: [0],
                claimedUnbrokenBonusStages: [0], resumedFromCheckpoint: true,
                travelerFavorFights: 2, travelerReturnPending: true,
                bloodPursuerPending: false, finalBossDefeated: false,
                pendingAdventureEventId: 'cache', pendingSecretRoomId: 'armory',
                activeEncounter: {
                    enemy: {
                        id: 'wolf', name: 'Старый волк', health: 137, maxHealth: 180,
                        attack: 24, defense: 8, effects: { burnTurns: 1 },
                        intent: 'heavy', phase: 1
                    },
                    isBossBattle: false, turn: 'enemy', guardReduction: 0.35,
                    relicEffects: { phoenixRebirthUsed: true }
                }
            }
        }
    };
    values.set('rpg_adventure_save', JSON.stringify({
        schemaVersion: 1, player: historicalProfile, screen: 'battle'
    }));

    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.level, 18);
    assert.equal(gameState.player.gold, 1250);
    assert.equal(gameState.player.campaignCycle, 2);
    assert.equal(gameState.player.completedCampaignCycles, 1);
    assert.equal(gameState.player.newGamePlusUnlocked, true);
    assert.deepEqual(gameState.player.equipment, historicalProfile.equipment);
    assert.deepEqual(gameState.player.itemUpgrades, historicalProfile.itemUpgrades);
    assert.deepEqual(gameState.player.weaponRunes, historicalProfile.weaponRunes);
    assert.equal(gameState.player.quests.find(entry => entry.id === 'first_blood').rewardClaimed, true);
    assert.equal(gameState.player.achievements.find(entry => entry.id === 'first_kill').claimed, true);
    assert.deepEqual(gameState.player.locationRewardCycles, { forest: 2, mountains: 2 });
    assert.deepEqual(gameState.player.deepChestRewardCycles, { 'forest:20': 2 });

    const progress = gameState.player.dungeonProgress.forest;
    assert.equal(progress.stage, 1);
    assert.equal(progress.enemiesDefeated, 1);
    assert.deepEqual(progress.routeChoices, { 1: 'danger' });
    assert.equal(progress.pendingAdventureEventId, 'cache');
    assert.equal(progress.pendingSecretRoomId, 'armory');
    assert.equal(progress.activeEncounter.enemy.health, 137);
    assert.equal(progress.activeEncounter.enemy.intent, 'heavy');
    assert.equal(progress.activeEncounter.guardReduction, 0.35);
    assert.equal(progress.travelerReturnPending, true);

    assert.equal(gameState.save(), true);
    const upgraded = JSON.parse(values.get('rpg_adventure_save'));
    assert.equal(upgraded.schemaVersion, 2);
    assert.equal(upgraded.player.quests.find(entry => entry.id === 'first_blood').rewardClaimed, true);
    assert.equal(upgraded.player.achievements.find(entry => entry.id === 'first_kill').claimed, true);

    gameState.data = { player: null, screen: 'main-menu' };
    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.campaignCycle, 2);
    assert.equal(gameState.player.gold, 1250);
    assert.equal(gameState.player.inventory.find(item => item.id === 'health_potion').quantity, 4);
    assert.equal(gameState.player.dungeonProgress.forest.activeEncounter.enemy.health, 137);
    assert.equal(gameState.player.dungeonProgress.forest.pendingAdventureEventId, 'cache');
    assert.equal(gameState.player.dungeonProgress.forest.pendingSecretRoomId, 'armory');
    assert.equal(gameState.player.quests.find(entry => entry.id === 'first_blood').rewardClaimed, true);
    assert.equal(gameState.player.achievements.find(entry => entry.id === 'first_kill').claimed, true);
});
