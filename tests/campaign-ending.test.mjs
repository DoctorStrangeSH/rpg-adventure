import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { getLocation } from '../js/data/locations.js';
import { getBattleState } from '../js/ui/battle.js';
import { getLocationState, handleBossVictory, resetLocationState } from '../js/systems/dungeon.js';

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
    const { completeLocation } = await import('../js/systems/dungeon.js');
    completeLocation();
    assert.equal(player.campaignCompleted, false);
    assert.equal(player.newGamePlusUnlocked, false);
});
