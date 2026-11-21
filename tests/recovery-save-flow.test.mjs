import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../js/config/constants.js';
import { gameState } from '../js/core/state.js';
import { RECOVERY_SAVE_KEY, Storage } from '../js/core/storage.js';

function setup(t, options = {}) {
    const previousStorage = globalThis.localStorage;
    const previousPlayer = gameState.player;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) {
            if (options.failActiveWrite && key === GAME_CONFIG.saveKey) throw new Error('QuotaExceededError');
            values.set(key, value);
        },
        removeItem(key) { values.delete(key); }
    };
    gameState.player = null;
    t.after(() => {
        gameState.player = previousPlayer;
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    });
    return values;
}

test('valid recovery can be previewed and restored in the current schema without changing the backup', (t) => {
    const values = setup(t);
    const recovery = JSON.stringify({
        player: {
            id: 7, class: 'warrior', username: 'Recovered Hero',
            level: 14, experience: 35, gold: 920,
            inventory: [{ id: 'health_potion', quantity: 6 }],
            equipment: { weapon: 'iron_sword', armor: null }
        }
    });
    values.set(RECOVERY_SAVE_KEY, recovery);
    values.set(GAME_CONFIG.saveKey, '{broken');

    assert.equal(gameState.canRestoreRecovery(), true);
    assert.equal(gameState.player, null);
    assert.equal(gameState.restoreRecovery(), true);
    assert.equal(gameState.player.username, 'Recovered Hero');
    assert.equal(gameState.player.level, 14);
    assert.equal(gameState.player.gold, 920);
    assert.equal(gameState.player.inventory[0].quantity, 6);
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery);

    const active = JSON.parse(values.get(GAME_CONFIG.saveKey));
    assert.equal(active.schemaVersion, 2);
    assert.equal(active.player.username, 'Recovered Hero');
    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.gold, 920);
});

test('future-version and malformed recovery copies are not offered or restored', (t) => {
    const values = setup(t);
    const future = JSON.stringify({
        schemaVersion: 99,
        player: { class: 'warrior', level: 99, futureProgress: true }
    });
    values.set(RECOVERY_SAVE_KEY, future);
    values.set(GAME_CONFIG.saveKey, '{broken');

    assert.equal(gameState.canRestoreRecovery(), false);
    assert.equal(gameState.restoreRecovery(), false);
    assert.equal(values.get(GAME_CONFIG.saveKey), '{broken');
    assert.equal(values.get(RECOVERY_SAVE_KEY), future);

    values.set(RECOVERY_SAVE_KEY, '{invalid-json');
    assert.equal(gameState.canRestoreRecovery(), false);
    assert.equal(gameState.restoreRecovery(), false);
    assert.equal(values.get(GAME_CONFIG.saveKey), '{broken');
});

test('failed recovery write leaves both the current save and recovery copy untouched', (t) => {
    const values = setup(t, { failActiveWrite: true });
    const recovery = JSON.stringify({
        schemaVersion: 2,
        player: { class: 'mage', username: 'Safe Backup', level: 8 }
    });
    const current = '{damaged-current-save';
    values.set(RECOVERY_SAVE_KEY, recovery);
    values.set(GAME_CONFIG.saveKey, current);

    assert.equal(gameState.canRestoreRecovery(), true);
    assert.equal(gameState.restoreRecovery(), false);
    assert.equal(gameState.player, null);
    assert.equal(values.get(GAME_CONFIG.saveKey), current);
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery);
});

test('recovery validation does not mutate the stored backup or active profile', (t) => {
    const values = setup(t);
    const recovery = JSON.stringify({
        schemaVersion: 1,
        player: { class: 'archer', level: 5, inventory: [{ id: 'health_potion', quantity: 2 }] }
    });
    values.set(RECOVERY_SAVE_KEY, recovery);
    const activePlayer = gameState.createPlayer('mage');
    const activeBefore = structuredClone(activePlayer);

    assert.equal(gameState.canRestoreRecovery(), true);
    assert.deepEqual(gameState.player, activeBefore);
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery);
});


test('recovery restores NG+ progression, equipment upgrades, runes, claims and expedition resume state across reload', (t) => {
    const values = setup(t);
    const player = gameState.createPlayer('warrior');
    Object.assign(player, {
        level: 18,
        experience: 35,
        gold: 1250,
        campaignCycle: 2,
        completedCampaignCycles: 1,
        lastCompletedCampaignCycle: 1,
        campaignCompleted: false,
        newGamePlusUnlocked: true,
        inventory: [
            { id: 'iron_sword', quantity: 1 },
            { id: 'health_potion', quantity: 4 },
            { id: 'ember_core', quantity: 2 }
        ],
        equipment: { weapon: 'iron_sword', armor: 'leather_armor' },
        itemUpgrades: { iron_sword: 8, leather_armor: 4 },
        weaponRunes: { iron_sword: ['flame', 'blood'] },
        unlockedLocations: ['forest'],
        locationRewardCycles: { forest: 2, mountains: 1 },
        deepChestRewardCycles: { 'forest:20': 2 },
        dungeonProgress: {
            forest: {
                campaignCycle: 2,
                stage: 0,
                enemiesDefeated: 1,
                visitedEventStages: [0],
                visitedRouteStages: [0],
                routeChoices: { 0: 'safe' },
                checkedSecretStages: [],
                visitedCheckpointStages: [],
                claimedDeepChestStages: [],
                claimedUnbrokenBonusStages: [],
                resumedFromCheckpoint: true,
                travelerFavorFights: 2,
                travelerReturnPending: false,
                bloodPursuerPending: true,
                finalBossDefeated: false
            }
        },
        stats: { kills: 300, battles: 400, wins: 350, losses: 5, dungeonsCompleted: 4, bossesKilled: 18 }
    });
    player.quests.find(entry => entry.id === 'first_blood').rewardClaimed = true;
    player.achievements.find(entry => entry.id === 'first_kill').claimed = true;

    const recovery = JSON.stringify({ schemaVersion: 2, player });
    values.set(RECOVERY_SAVE_KEY, recovery);
    values.set(GAME_CONFIG.saveKey, '{damaged-primary-save');

    assert.equal(gameState.canRestoreRecovery(), true);
    assert.equal(gameState.restoreRecovery(), true);
    assert.equal(gameState.save(), true);
    assert.equal(gameState.load(), true);

    const restored = gameState.player;
    assert.equal(restored.campaignCycle, 2);
    assert.equal(restored.completedCampaignCycles, 1);
    assert.equal(restored.newGamePlusUnlocked, true);
    assert.equal(restored.campaignCompleted, false);
    assert.deepEqual(restored.itemUpgrades, { iron_sword: 8, leather_armor: 4 });
    assert.deepEqual(restored.weaponRunes, { iron_sword: ['flame', 'blood'] });
    assert.deepEqual(restored.locationRewardCycles, { forest: 2, mountains: 1 });
    assert.deepEqual(restored.deepChestRewardCycles, { 'forest:20': 2 });
    assert.deepEqual(restored.dungeonProgress.forest, {
        campaignCycle: 2,
        stage: 0,
        enemiesDefeated: 1,
        visitedEventStages: [0],
        visitedRouteStages: [0],
        routeChoices: { 0: 'safe' },
        checkedSecretStages: [],
        visitedCheckpointStages: [],
        claimedDeepChestStages: [],
        claimedUnbrokenBonusStages: [],
        resumedFromCheckpoint: true,
        travelerFavorFights: 2,
        travelerReturnPending: false,
        bloodPursuerPending: true,
        finalBossDefeated: false
    });
    assert.equal(restored.quests.find(entry => entry.id === 'first_blood').rewardClaimed, true);
    assert.equal(restored.achievements.find(entry => entry.id === 'first_kill').claimed, true);
    assert.equal(restored.stats.bossesKilled, 18);
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery,
        'restoration and subsequent save must not consume or rewrite the recovery copy');
});
