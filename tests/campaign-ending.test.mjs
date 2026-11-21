import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { getLocation, LOCATIONS } from '../js/data/locations.js';
import { getBattleState } from '../js/ui/battle.js';
import { getLocationState, handleBossVictory, resetLocationState, completeLocation } from '../js/systems/dungeon.js';
import { startNewGamePlus } from '../js/systems/newGamePlus.js';

function installBrowserStubs(t) {
    const previousWindow = globalThis.window;
    const previousStorage = globalThis.localStorage;
    const previousTimeout = globalThis.setTimeout;
    const values = new Map();
    const screens = [];
    globalThis.window = {
        showNotification() {},
        updateMainMenu() {},
        updateMapScreen() {},
        exitBattle() {},
        showScreen(screen) { screens.push(screen); }
    };
    globalThis.localStorage = {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    };
    globalThis.setTimeout = callback => { callback(); return 1; };
    t.after(() => {
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
        globalThis.setTimeout = previousTimeout;
        resetLocationState();
        const battle = getBattleState();
        battle.isActive = false;
        battle.currentEnemy = null;
    });
    return screens;
}

test('World Eater victory completes the campaign, saves it and opens the ending', (t) => {
    const screens = installBrowserStubs(t);
    const player = gameState.createPlayer('warrior');
    const run = getLocationState();
    const finalLocation = getLocation('dragon_lair');
    run.currentLocation = finalLocation;
    run.currentStage = finalLocation.stages.length - 1;
    run.enemiesDefeated = finalLocation.stages.at(-1).enemiesCount;
    run.inLocation = true;
    run.finalBossDefeated = false;
    const battle = getBattleState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.isBossBattle = true;

    handleBossVictory();

    assert.equal(finalLocation.stages.at(-1).boss.id, 'world_eater');
    assert.equal(player.campaignCompleted, true);
    assert.equal(player.newGamePlusUnlocked, true);
    assert.equal(player.completedCampaignCycles, 1);
    assert.equal(player.lastCompletedCampaignCycle, 1);
    assert.equal(player.locationRewardCycles.dragon_lair, 1);
    assert.equal(run.inLocation, false);
    assert.ok(screens.includes('ending-screen'));
    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.campaignCompleted, true);
    assert.equal(gameState.player.newGamePlusUnlocked, true);
});




test('all three classes complete the real World Eater victory pipeline and restore the ending after reload', (t) => {
    const screens = installBrowserStubs(t);
    const previousUnlocks = LOCATIONS.map(location => location.unlocked);
    t.after(() => {
        LOCATIONS.forEach((location, index) => { location.unlocked = previousUnlocks[index]; });
    });

    for (const classId of ['warrior', 'mage', 'archer']) {
        resetLocationState();
        LOCATIONS.forEach(location => { location.unlocked = location.type === 'safe' || location.id === 'dragon_lair'; });
        const player = gameState.createPlayer(classId);
        player.level = 100;
        player.unlockedLocations = ['forest', 'mountains', 'ruins', 'dragon_lair'];
        const location = getLocation('dragon_lair');
        const run = getLocationState();
        run.currentLocation = location;
        run.currentStage = location.stages.length - 1;
        run.enemiesDefeated = location.stages.at(-1).enemiesCount;
        run.inLocation = true;
        run.finalBossDefeated = false;

        const battle = getBattleState();
        battle.isActive = false;
        battle.currentEnemy = null;
        battle.isBossBattle = true;

        assert.equal(handleBossVictory(), true, classId + ' must complete the real World Eater victory callback');
        assert.equal(player.campaignCompleted, true);
        assert.equal(player.newGamePlusUnlocked, true);
        assert.equal(player.completedCampaignCycles, 1);
        assert.equal(player.lastCompletedCampaignCycle, 1);
        assert.equal(player.locationRewardCycles.dragon_lair, 1);
        assert.equal(player.inventory.find(item => item.id === 'rune_world_fragment')?.quantity, 1);
        assert.ok(screens.includes('ending-screen'));

        const rewardCount = player.inventory.find(item => item.id === 'rune_world_fragment')?.quantity;
        assert.equal(handleBossVictory(), false, classId + ' duplicate victory callback must be rejected');
        assert.equal(player.inventory.find(item => item.id === 'rune_world_fragment')?.quantity, rewardCount);

        assert.equal(gameState.load(), true);
        assert.equal(gameState.player.class, classId);
        assert.equal(gameState.player.campaignCompleted, true);
        assert.equal(gameState.player.newGamePlusUnlocked, true);
        assert.equal(gameState.player.completedCampaignCycles, 1);
        assert.equal(gameState.player.locationRewardCycles.dragon_lair, 1);
        assert.equal(gameState.player.inventory.find(item => item.id === 'rune_world_fragment')?.quantity, 1);
    }
});

test('region completion pipeline grants each guaranteed rune exactly once per campaign cycle', (t) => {
    installBrowserStubs(t);
    const previousPlayer = gameState.player;
    const previousUnlocks = LOCATIONS.map(location => location.unlocked);
    t.after(() => {
        gameState.player = previousPlayer;
        LOCATIONS.forEach((location, index) => { location.unlocked = previousUnlocks[index]; });
    });

    const expected = new Map([
        ['forest', 'rune_verdant_heart'],
        ['mountains', 'rune_dragon_heart'],
        ['ruins', 'rune_lich_soul'],
        ['dragon_lair', 'rune_world_fragment']
    ]);

    for (const [locationId, runeId] of expected) {
        const player = gameState.createPlayer('warrior');
        const location = getLocation(locationId);
        const run = getLocationState();

        run.currentLocation = location;
        run.currentStage = location.stages.length - 1;
        run.inLocation = true;
        run.finalBossDefeated = false;
        completeLocation();

        assert.equal(player.locationRewardCycles[locationId], 1);
        assert.equal(player.inventory.find(item => item.id === runeId)?.quantity, 1,
            `${locationId} must grant its guaranteed rune through the runtime reward pipeline`);

        // Simulate entering and clearing the same region again in the same cycle.
        run.currentLocation = location;
        run.currentStage = location.stages.length - 1;
        run.inLocation = true;
        run.finalBossDefeated = false;
        completeLocation();

        assert.equal(player.inventory.find(item => item.id === runeId)?.quantity, 1,
            `${locationId} must not duplicate its guaranteed rune in one campaign cycle`);
    }
});

test('a final-region clear without the World Eater victory flag cannot unlock NG+', (t) => {
    installBrowserStubs(t);
    const player = gameState.createPlayer('mage');
    const run = getLocationState();
    run.currentLocation = getLocation('dragon_lair');
    run.currentStage = run.currentLocation.stages.length - 1;
    run.inLocation = true;
    run.finalBossDefeated = false;
    const battle = getBattleState();
    battle.isActive = false;
    battle.currentEnemy = null;

    // Completion without the final boss callback must not count as campaign victory.
    completeLocation();
    assert.equal(player.campaignCompleted, false);
    assert.equal(player.newGamePlusUnlocked, false);
});

test('failed regional item batch does not consume the once-per-cycle reward claim', (t) => {
    installBrowserStubs(t);
    const player = gameState.createPlayer('warrior');
    const location = getLocation('forest');
    const run = getLocationState();
    const initialExperience = player.experience;
    const initialGold = player.gold;
    player.inventory.push({ id: 'iron_sword', quantity: Number.MAX_SAFE_INTEGER });

    run.currentLocation = location;
    run.currentStage = location.stages.length - 1;
    run.inLocation = true;
    assert.equal(completeLocation(), false);

    assert.equal(player.locationRewardCycles?.forest, undefined);
    assert.equal(player.experience, initialExperience);
    assert.equal(player.gold, initialGold);
    assert.equal(player.inventory.find(item => item.id === 'rune_verdant_heart'), undefined);
    assert.equal(run.inLocation, true);
    assert.equal(run.currentLocation.id, 'forest');

    // Repair the damaged stack and retry without leaving or restarting the expedition.
    player.inventory = player.inventory.filter(item => item.id !== 'iron_sword');
    assert.equal(completeLocation(), true);

    assert.equal(player.locationRewardCycles.forest, 1);
    assert.equal(player.inventory.find(item => item.id === 'rune_verdant_heart')?.quantity, 1);
    assert.equal(player.experience, initialExperience + location.rewards.exp);
    assert.equal(player.gold, initialGold + location.rewards.gold);
});


test('malformed regional reward claim state cannot silently skip the guaranteed reward', (t) => {
    installBrowserStubs(t);
    const player = gameState.createPlayer('warrior');
    const location = getLocation('forest');
    const run = getLocationState();
    player.locationRewardCycles = [];
    const beforePlayer = structuredClone(player);

    run.currentLocation = location;
    run.currentStage = location.stages.length - 1;
    run.inLocation = true;

    assert.equal(completeLocation(), false);
    assert.deepEqual(player, beforePlayer);
    assert.equal(run.inLocation, true);
    assert.equal(run.currentLocation.id, 'forest');
    assert.equal(player.inventory.find(item => item.id === 'rune_verdant_heart'), undefined);
});


test('all three classes follow the same four-region unlock and reward progression', (t) => {
    installBrowserStubs(t);
    const previousUnlocks = LOCATIONS.map(location => location.unlocked);
    t.after(() => {
        LOCATIONS.forEach((location, index) => { location.unlocked = previousUnlocks[index]; });
    });

    const route = ['forest', 'mountains', 'ruins', 'dragon_lair'];
    for (const classId of ['warrior', 'mage', 'archer']) {
        resetLocationState();
        LOCATIONS.forEach(location => { location.unlocked = location.type === 'safe' || location.id === 'forest'; });
        const player = gameState.createPlayer(classId);
        player.level = 100;
        player.unlockedLocations = ['forest'];

        for (let index = 0; index < route.length; index++) {
            const locationId = route[index];
            const location = getLocation(locationId);
            const run = getLocationState();
            assert.equal(location.unlocked, true, classId + ' must unlock ' + locationId + ' before entering');
            run.currentLocation = location;
            run.currentStage = location.stages.length - 1;
            run.enemiesDefeated = location.stages.at(-1).enemiesCount;
            run.inLocation = true;
            run.finalBossDefeated = locationId === 'dragon_lair';

            assert.equal(completeLocation(), true, classId + ' must complete ' + locationId);
            assert.equal(player.locationRewardCycles[locationId], 1);
            if (index < route.length - 1) {
                const nextId = route[index + 1];
                assert.equal(getLocation(nextId).unlocked, true);
                assert.ok(player.unlockedLocations.includes(nextId));
            }
        }

        assert.equal(player.campaignCompleted, true, classId + ' must reach the campaign ending');
        assert.equal(player.newGamePlusUnlocked, true);
        assert.equal(player.completedCampaignCycles, 1);
        assert.deepEqual(player.unlockedLocations, route);
    }
});


test('NG+ commits atomically, survives reload and resets only current-cycle progress', (t) => {
    installBrowserStubs(t);
    const player = gameState.createPlayer('mage');
    player.level = 42;
    player.experience = 73;
    player.gold = 9876;
    player.campaignCycle = 1;
    player.campaignCompleted = true;
    player.newGamePlusUnlocked = true;
    player.completedCampaignCycles = 1;
    player.lastCompletedCampaignCycle = 1;
    player.campaignCompletedAt = '2026-11-21T00:00:00.000Z';
    player.unlockedLocations = ['forest', 'mountains', 'ruins', 'dragon_lair'];
    player.dungeonCheckpoints = { forest: 12, mountains: 8 };
    player.dungeonProgress = { forest: { stage: 12, enemiesDefeated: 4 } };
    player.locationRewardCycles = { forest: 1, mountains: 1, ruins: 1, dragon_lair: 1 };
    player.inventory = [{ id: 'iron_ore', quantity: 17 }];
    player.talents = ['mage_arcane_mastery'];
    player.relics = ['phoenix_crown'];
    player.activeRelics = ['phoenix_crown'];
    player.itemUpgrades = { moonblade: 7 };
    player.weaponRunes = { moonblade: ['rune_flame'] };
    player.stats.wins = 91;
    player.quests = player.quests.map(entry => ({
        ...entry,
        progress: entry.id === 'first_blood' ? 1 : entry.id === 'monster_hunter' ? 3 : entry.progress,
        completed: entry.id === 'first_blood',
        rewardClaimed: entry.id === 'first_blood'
    }));
    player.health = 1;
    player.mana = 2;

    assert.equal(startNewGamePlus(gameState), true);
    const next = gameState.player;
    assert.equal(next.campaignCycle, 2);
    assert.equal(next.campaignCompleted, false);
    assert.equal(next.newGamePlusUnlocked, true);
    assert.equal(next.completedCampaignCycles, 1);
    assert.equal(next.lastCompletedCampaignCycle, 1);
    assert.equal(next.campaignCompletedAt, null);
    assert.equal(next.level, 42);
    assert.equal(next.experience, 73);
    assert.equal(next.gold, 9876);
    assert.equal(next.health, next.maxHealth);
    assert.equal(next.mana, next.maxMana);
    assert.deepEqual(next.unlockedLocations, ['forest']);
    assert.deepEqual(next.dungeonCheckpoints, {});
    assert.deepEqual(next.dungeonProgress, {});
    assert.deepEqual(next.locationRewardCycles, {
        forest: 1, mountains: 1, ruins: 1, dragon_lair: 1
    });
    assert.deepEqual(next.inventory, [{ id: 'iron_ore', quantity: 17 }]);
    assert.deepEqual(next.talents, ['mage_arcane_mastery']);
    assert.deepEqual(next.relics, ['phoenix_crown']);
    assert.deepEqual(next.activeRelics, ['phoenix_crown']);
    assert.deepEqual(next.itemUpgrades, { moonblade: 7 });
    assert.deepEqual(next.weaponRunes, { moonblade: ['rune_flame'] });
    assert.equal(next.stats.wins, 91);
    assert.equal(next.quests.find(entry => entry.id === 'first_blood').completed, true);
    assert.equal(next.quests.find(entry => entry.id === 'first_blood').rewardClaimed, true);
    assert.equal(next.quests.find(entry => entry.id === 'monster_hunter').completed, false);
    assert.equal(next.quests.find(entry => entry.id === 'monster_hunter').progress, 0);

    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.campaignCycle, 2);
    assert.equal(gameState.player.campaignCompleted, false);
    assert.equal(gameState.player.level, 42);
    assert.equal(gameState.player.gold, 9876);
    assert.deepEqual(gameState.player.inventory, [{ id: 'iron_ore', quantity: 17 }]);
    assert.deepEqual(gameState.player.dungeonProgress, {});
    assert.deepEqual(gameState.player.unlockedLocations, ['forest']);
});

test('NG+ save failure restores the completed campaign and region unlocks', (t) => {
    installBrowserStubs(t);
    const player = gameState.createPlayer('warrior');
    player.campaignCompleted = true;
    player.newGamePlusUnlocked = true;
    player.campaignCycle = 3;
    player.completedCampaignCycles = 2;
    player.lastCompletedCampaignCycle = 3;
    player.unlockedLocations = ['forest', 'mountains', 'ruins', 'dragon_lair'];
    const previous = structuredClone(player);
    const unlocks = LOCATIONS.map(location => location.unlocked);
    const save = gameState.save;
    gameState.save = () => false;
    try {
        assert.equal(startNewGamePlus(gameState), false);
        assert.deepEqual(gameState.player, previous);
        assert.deepEqual(LOCATIONS.map(location => location.unlocked), unlocks);
    } finally {
        gameState.save = save;
    }
});


test('World Eater victory completes NG+ cycle two without duplicating cycle-one rewards', (t) => {
    const screens = installBrowserStubs(t);
    const previousUnlocks = LOCATIONS.map(location => location.unlocked);
    t.after(() => {
        LOCATIONS.forEach((location, index) => { location.unlocked = previousUnlocks[index]; });
    });
    LOCATIONS.forEach(location => { location.unlocked = location.type === 'safe' || location.id === 'dragon_lair'; });

    const player = gameState.createPlayer('archer');
    player.level = 58;
    player.campaignCycle = 2;
    player.completedCampaignCycles = 1;
    player.lastCompletedCampaignCycle = 1;
    player.newGamePlusUnlocked = true;
    player.unlockedLocations = ['forest', 'mountains', 'ruins', 'dragon_lair'];
    player.locationRewardCycles = {
        forest: 1,
        mountains: 1,
        ruins: 1,
        dragon_lair: 1
    };
    player.inventory = [{ id: 'rune_world_fragment', quantity: 1 }];

    const location = getLocation('dragon_lair');
    const run = getLocationState();
    run.currentLocation = location;
    run.currentStage = location.stages.length - 1;
    run.enemiesDefeated = location.stages.at(-1).enemiesCount;
    run.inLocation = true;
    run.finalBossDefeated = false;
    const battle = getBattleState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.isBossBattle = true;

    assert.equal(handleBossVictory(), true);
    assert.equal(player.campaignCompleted, true);
    assert.equal(player.newGamePlusUnlocked, true);
    assert.equal(player.campaignCycle, 2);
    assert.equal(player.completedCampaignCycles, 2);
    assert.equal(player.lastCompletedCampaignCycle, 2);
    assert.equal(player.locationRewardCycles.dragon_lair, 2);
    assert.equal(player.inventory.find(item => item.id === 'rune_world_fragment')?.quantity, 2);
    assert.ok(screens.includes('ending-screen'));

    const rewardQuantity = player.inventory.find(item => item.id === 'rune_world_fragment')?.quantity;
    assert.equal(handleBossVictory(), false, 'the second-cycle final reward must also be idempotent');
    assert.equal(player.completedCampaignCycles, 2);
    assert.equal(player.inventory.find(item => item.id === 'rune_world_fragment')?.quantity, rewardQuantity);

    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.campaignCycle, 2);
    assert.equal(gameState.player.completedCampaignCycles, 2);
    assert.equal(gameState.player.campaignCompleted, true);
    assert.equal(gameState.player.newGamePlusUnlocked, true);
    assert.equal(gameState.player.locationRewardCycles.dragon_lair, 2);
    assert.equal(gameState.player.inventory.find(item => item.id === 'rune_world_fragment')?.quantity, 2);
});
