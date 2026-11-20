import test from 'node:test';
import assert from 'node:assert/strict';
import {
    canStartNewGamePlus, completeCampaign, claimLocationReward,
    prepareNewGamePlus, startNewGamePlus
} from '../js/systems/newGamePlus.js';
import { LOCATIONS } from '../js/data/locations.js';
import { claimDeepChestAttempt } from '../js/systems/loot.js';

function makeCompletedPlayer() {
    return {
        class: 'warrior', level: 18, experience: 35, maxExperience: 500,
        health: 12, maxHealth: 240, mana: 3, maxMana: 90, gold: 1250,
        campaignCycle: 1, completedCampaignCycles: 1, lastCompletedCampaignCycle: 1,
        campaignCompleted: true, newGamePlusUnlocked: true,
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
            { id: 'monster_hunter', progress: 2, completed: false, rewardClaimed: false }
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
