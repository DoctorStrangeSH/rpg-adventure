import test from 'node:test';
import assert from 'node:assert/strict';
import {
    canStartNewGamePlus, canClaimLocationReward, completeCampaign, claimLocationReward,
    prepareNewGamePlus, startNewGamePlus
} from '../js/systems/newGamePlus.js';
import { LOCATIONS } from '../js/data/locations.js';
import { gameState } from '../js/core/state.js';
import { claimDeepChestAttempt } from '../js/systems/loot.js';
import { startNewGamePlusFromEnding } from '../js/ui/ending.js';

function makeCompletedPlayer() {
    return {
        class: 'warrior', level: 18, experience: 35, maxExperience: 500,
        health: 12, maxHealth: 240, mana: 3, maxMana: 90, gold: 1250,
        campaignCycle: 1, completedCampaignCycles: 1, lastCompletedCampaignCycle: 1,
        campaignCompleted: true, campaignCompletedAt: '2026-11-20T12:00:00.000Z', newGamePlusUnlocked: true,
        inventory: [{ id: 'dragon_sword', quantity: 1 }],
        equipment: { weapon: 'dragon_sword', armor: 'guardian_armor' },
        talents: ['warrior_force'], relics: ['ember_crown'], activeRelics: ['ember_crown'],
        discoveredItems: ['dragon_sword'], unlockedLocations: ['forest', 'mountains', 'ruins', 'dragon_lair'],
        dungeonCheckpoints: { forest: 9 }, locationRewardCycles: { forest: 1, mountains: 1 },
        deepChestRewardCycles: { 'forest:20': 1, 'mountains:30': 1 },
        itemUpgrades: { dragon_sword: 8, guardian_armor: 4 },
        weaponRunes: { dragon_sword: ['flame', 'blood'], guardian_armor: [] },
        stats: { kills: 300, battles: 400, wins: 350, losses: 5, dungeonsCompleted: 4, bossesKilled: 18 },
        quests: [
            { id: 'first_blood', progress: 1, completed: true, rewardClaimed: true },
            { id: 'monster_hunter', progress: 2, completed: false, rewardClaimed: false },
            { id: 'battle_veteran', progress: 3, completed: true, rewardClaimed: false }
        ],
        achievements: [{ id: 'first_kill', progress: 1, completed: true, claimed: true }]
    };
}

test('NG+ unlocks once and only after the campaign completion flag', () => {
    const player = { campaignCycle: 1, completedCampaignCycles: 0, lastCompletedCampaignCycle: 0 };
    assert.equal(canStartNewGamePlus(player), false);
    assert.equal(completeCampaign(player, '2026-11-20T00:00:00.000Z'), true);
    assert.equal(completeCampaign(player, '2026-11-20T00:00:01.000Z'), false);
    assert.equal(player.campaignCompleted, true);
    assert.equal(player.newGamePlusUnlocked, true);
    assert.equal(player.completedCampaignCycles, 1);
    assert.equal(canStartNewGamePlus(player), true);
});

test('each region reward is claimable once per cycle and again in the next cycle', () => {
    const player = { campaignCycle: 1, locationRewardCycles: {} };
    assert.equal(claimLocationReward(player, 'forest'), true);
    assert.equal(claimLocationReward(player, 'forest'), false);
    assert.equal(claimLocationReward(player, 'village'), false);
    player.campaignCycle = 2;
    assert.equal(claimLocationReward(player, 'forest'), true);
});

test('NG+ carries character progression and resets only campaign-run state', () => {
    const player = makeCompletedPlayer();
    const next = prepareNewGamePlus(player);
    assert.equal(next.campaignCycle, 2);
    assert.equal(next.campaignCompleted, false);
    assert.equal(next.campaignCompletedAt, null);
    assert.equal(next.newGamePlusUnlocked, true);
    assert.equal(next.level, player.level);
    assert.equal(next.experience, player.experience);
    assert.equal(next.gold, player.gold);
    assert.deepEqual(next.inventory, player.inventory);
    assert.deepEqual(next.equipment, player.equipment);
    assert.deepEqual(next.talents, player.talents);
    assert.deepEqual(next.relics, player.relics);
    assert.deepEqual(next.activeRelics, player.activeRelics);
    assert.deepEqual(next.itemUpgrades, player.itemUpgrades);
    assert.deepEqual(next.weaponRunes, player.weaponRunes);
    assert.deepEqual(next.achievements, player.achievements);
    assert.deepEqual(next.stats, player.stats);
    assert.deepEqual(next.unlockedLocations, ['forest']);
    assert.deepEqual(next.dungeonCheckpoints, {});
    assert.deepEqual(next.dungeonProgress, {});
    assert.deepEqual(next.locationRewardCycles, player.locationRewardCycles);
    assert.deepEqual(next.deepChestRewardCycles, player.deepChestRewardCycles);
    assert.equal(claimDeepChestAttempt(next, 'forest', 20), true,
        'a new campaign cycle can roll the same deep chest milestone again');
    assert.equal(next.health, next.maxHealth);
    assert.equal(next.mana, next.maxMana);
    assert.equal(next.quests.find(entry => entry.id === 'first_blood').rewardClaimed, true);
    assert.deepEqual(next.quests.find(entry => entry.id === 'battle_veteran'), {
        id: 'battle_veteran', progress: 3, completed: true, rewardClaimed: false
    }, 'completed but unclaimed quests remain claimable without replaying progress');
    assert.equal(next.quests.find(entry => entry.id === 'monster_hunter').progress, 0);
    assert.equal(player.campaignCycle, 1);
    assert.deepEqual(LOCATIONS.map(location => location.unlocked),
        [true, false, false, false, true]);
});

test('NG+ save failure rolls back player and world unlocks', () => {
    const player = makeCompletedPlayer();
    const state = { player, save: () => false };
    const previousUnlocks = LOCATIONS.map(location => location.unlocked);
    assert.equal(startNewGamePlus(state), false);
    assert.equal(state.player, player);
    assert.deepEqual(LOCATIONS.map(location => location.unlocked), previousUnlocks);
});

test('NG+ starts only after a successful save and resets world unlocks', () => {
    const player = makeCompletedPlayer();
    const state = { player, save: () => true };
    assert.equal(startNewGamePlus(state), true);
    assert.equal(state.player.campaignCycle, 2);
    assert.deepEqual(state.player.unlockedLocations, ['forest']);
    assert.deepEqual(LOCATIONS.filter(location => location.unlocked).map(location => location.id)
        .sort(), ['forest', 'village']);
    LOCATIONS.forEach(location => { location.unlocked = false; });
});


test('NG+ cycle survives a real localStorage save and reload', (t) => {
    const previousStorage = globalThis.localStorage;
    const previousPlayer = gameState.player;
    const previousUnlocks = LOCATIONS.map(location => location.unlocked);
    const values = new Map();
    globalThis.localStorage = {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    };

    t.after(() => {
        gameState.player = previousPlayer;
        LOCATIONS.forEach((location, index) => { location.unlocked = previousUnlocks[index]; });
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    });

    gameState.player = makeCompletedPlayer();
    assert.equal(startNewGamePlus(gameState), true);
    assert.equal(gameState.player.campaignCycle, 2);
    assert.equal(gameState.player.campaignCompleted, false);
    assert.equal(gameState.save(), true);
    assert.equal(gameState.load(), true);

    const restored = gameState.player;
    assert.equal(restored.campaignCycle, 2);
    assert.equal(restored.completedCampaignCycles, 1);
    assert.equal(restored.newGamePlusUnlocked, true);
    assert.equal(restored.campaignCompleted, false);
    assert.equal(restored.campaignCompletedAt, null);
    assert.equal(restored.level, 18);
    assert.equal(restored.gold, 1250);
    assert.deepEqual(restored.inventory, [{ id: 'dragon_sword', quantity: 1 }]);
    assert.deepEqual(restored.equipment, { weapon: 'dragon_sword', armor: 'guardian_armor' });
    assert.deepEqual(restored.unlockedLocations, ['forest']);
    assert.deepEqual(restored.dungeonProgress, {});
    assert.equal(restored.quests.find(entry => entry.id === 'first_blood').rewardClaimed, true);
    assert.equal(restored.achievements.find(entry => entry.id === 'first_kill').claimed, true);
    assert.deepEqual(LOCATIONS.filter(location => location.unlocked).map(location => location.id)
        .sort(), ['forest', 'village']);
});



test('ending screen NG+ action starts the next cycle, persists retained progression and returns to the menu', (t) => {
    const previousStorage = globalThis.localStorage;
    const previousWindow = globalThis.window;
    const previousPlayer = gameState.player;
    const previousUnlocks = LOCATIONS.map(location => location.unlocked);
    const values = new Map();
    const screens = [];
    const notifications = [];
    const uiCalls = [];
    globalThis.localStorage = {
        setItem(key, value) { values.set(key, String(value)); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    };
    globalThis.window = {
        initUI() { uiCalls.push('init'); },
        showScreen(screen) { screens.push(screen); },
        updateMainMenu() { uiCalls.push('menu'); },
        showNotification(message, type) { notifications.push({ message, type }); }
    };

    t.after(() => {
        gameState.player = previousPlayer;
        LOCATIONS.forEach((location, index) => { location.unlocked = previousUnlocks[index]; });
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    });

    gameState.player = makeCompletedPlayer();
    gameState.player.dungeonProgress = { forest: { stage: 12, enemiesDefeated: 4 } };
    gameState.player.dungeonCheckpoints = { forest: 10 };
    gameState.player.health = 12;
    gameState.player.mana = 3;

    assert.equal(startNewGamePlusFromEnding(), true);
    assert.equal(gameState.player.campaignCycle, 2);
    assert.equal(gameState.player.campaignCompleted, false);
    assert.equal(gameState.player.newGamePlusUnlocked, true);
    assert.equal(gameState.player.level, 18);
    assert.equal(gameState.player.itemUpgrades.dragon_sword, 8);
    assert.deepEqual(gameState.player.weaponRunes.dragon_sword, ['flame', 'blood']);
    assert.deepEqual(gameState.player.dungeonProgress, {});
    assert.deepEqual(gameState.player.dungeonCheckpoints, {});
    assert.equal(gameState.player.health, gameState.player.maxHealth);
    assert.equal(gameState.player.mana, gameState.player.maxMana);
    assert.deepEqual(screens, ['main-menu']);
    assert.deepEqual(uiCalls, ['init', 'menu']);
    assert.equal(notifications.at(-1)?.type, 'success');

    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.campaignCycle, 2);
    assert.equal(gameState.player.campaignCompleted, false);
    assert.equal(gameState.player.itemUpgrades.dragon_sword, 8);
    assert.deepEqual(gameState.player.weaponRunes.dragon_sword, ['flame', 'blood']);
    assert.deepEqual(gameState.player.dungeonProgress, {});
    assert.deepEqual(gameState.player.dungeonCheckpoints, {});
});

test('location reward eligibility can be checked without consuming its campaign claim', () => {
    const player = { campaignCycle: 1 };
    assert.equal(canClaimLocationReward(player, 'forest'), true);
    assert.deepEqual(player, { campaignCycle: 1 });
    assert.equal(claimLocationReward(player, 'forest'), true);
    assert.equal(canClaimLocationReward(player, 'forest'), false);
    assert.equal(canClaimLocationReward({ campaignCycle: 1, locationRewardCycles: [] }, 'forest'), false);
});


test('NG++ advances campaign cycles monotonically and allows regional rewards once in each cycle', () => {
    const player = makeCompletedPlayer();
    const claimRegionsForCycle = (cycle) => {
        assert.equal(player.campaignCycle, cycle);
        for (const region of ['forest', 'mountains', 'ruins', 'dragon_lair']) {
            assert.equal(claimLocationReward(player, region), true,
                `${region} reward is claimable in campaign cycle ${cycle}`);
            assert.equal(claimLocationReward(player, region), false,
                `${region} reward cannot be claimed twice in campaign cycle ${cycle}`);
        }
    };

    // The first cycle's Forest and Mountains rewards were already claimed.
    assert.equal(canClaimLocationReward(player, 'forest'), false);
    assert.equal(canClaimLocationReward(player, 'mountains'), false);
    assert.equal(canClaimLocationReward(player, 'ruins'), true);
    assert.equal(canClaimLocationReward(player, 'dragon_lair'), true);
    claimRegionsForCycle(1);

    for (const nextCycle of [2, 3]) {
        const next = prepareNewGamePlus(player);
        assert.ok(next, `campaign cycle ${nextCycle} can be prepared after completion`);
        assert.equal(next.campaignCycle, nextCycle);
        assert.equal(next.completedCampaignCycles, nextCycle - 1);
        assert.equal(next.lastCompletedCampaignCycle, nextCycle - 1);
        assert.equal(next.campaignCompleted, false);
        assert.equal(next.newGamePlusUnlocked, true);
        assert.equal(next.locationRewardCycles.forest, nextCycle - 1);
        assert.equal(next.locationRewardCycles.mountains, nextCycle - 1);
        assert.equal(next.locationRewardCycles.ruins, 1);
        assert.equal(next.locationRewardCycles.dragon_lair, 1);
        assert.equal(canClaimLocationReward(next, 'forest'), true,
            `Forest reward resets for cycle ${nextCycle}`);
        assert.equal(canClaimLocationReward(next, 'mountains'), true,
            `Mountains reward resets for cycle ${nextCycle}`);

        // Model the successful final boss transaction for this cycle.
        assert.equal(completeCampaign(next, `2026-11-22T0${nextCycle}:00:00.000Z`), true);
        assert.equal(completeCampaign(next), false, 'one campaign cycle can only be completed once');
        assert.equal(next.completedCampaignCycles, nextCycle);
        assert.equal(next.lastCompletedCampaignCycle, nextCycle);
        Object.assign(player, next);
        claimRegionsForCycle(nextCycle);
    }

    assert.equal(player.campaignCycle, 3);
    assert.equal(player.completedCampaignCycles, 3);
    assert.equal(player.lastCompletedCampaignCycle, 3);
    assert.equal(player.campaignCompleted, true);
    assert.equal(player.locationRewardCycles.forest, 3);
    assert.equal(player.locationRewardCycles.mountains, 3);
    assert.equal(player.locationRewardCycles.ruins, 3);
    assert.equal(player.locationRewardCycles.dragon_lair, 3);
});
