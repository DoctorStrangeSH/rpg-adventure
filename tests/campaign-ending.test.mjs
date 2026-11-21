import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { getLocation, LOCATIONS } from '../js/data/locations.js';
import { getBattleState } from '../js/ui/battle.js';
import { getLocationState, handleBossVictory, resetLocationState, completeLocation } from '../js/systems/dungeon.js';

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
