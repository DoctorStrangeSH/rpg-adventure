import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { Storage } from '../js/core/storage.js';
import { getLocation } from '../js/data/locations.js';
import { getBattleState } from '../js/ui/battle.js';
import { handleVictory, getLocationState, resetLocationState, startLocation, startStageBattle } from '../js/systems/dungeon.js';

function setup(t) {
    const previousStorage = globalThis.localStorage;
    const previousWindow = globalThis.window;
    const previousTimeout = globalThis.setTimeout;
    const values = new Map();
    globalThis.localStorage = {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    };
    globalThis.window = {
        showScreen() {},
        showNotification() {},
        updateMainMenu() {},
        updateMapScreen() {},
        exitBattle() {},
        showBattleMessage() {}
    };
    globalThis.setTimeout = () => 0;
    const battle = getBattleState();
    battle.isActive = false;
    battle.currentEnemy = null;
    const player = gameState.createPlayer('warrior');
    player.unlockedLocations = ['forest'];
    getLocation('forest').unlocked = true;

    t.after(() => {
        resetLocationState();
        battle.isActive = false;
        battle.currentEnemy = null;
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        globalThis.setTimeout = previousTimeout;
    });
    return { player, values, battle };
}

test('a cleared enemy reward and its next encounter position survive reload together', (t) => {
    const { player } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 0;
    run.enemiesDefeated = 0;
    run.visitedEventStages.add(0);
    player.experience = 25;
    player.gold = 175;

    handleVictory();
    const savedAfterVictory = Storage.load().player;
    assert.equal(savedAfterVictory.experience, 25);
    assert.equal(savedAfterVictory.gold, 175);
    assert.equal(savedAfterVictory.dungeonProgress.forest.stage, 0);
    assert.equal(savedAfterVictory.dungeonProgress.forest.enemiesDefeated, 1);
    assert.deepEqual(savedAfterVictory.dungeonProgress.forest.visitedEventStages, [0]);

    resetLocationState();
    assert.equal(gameState.load(), true);
    startLocation('forest');
    const restored = getLocationState();
    assert.equal(restored.currentStage, 0);
    assert.equal(restored.enemiesDefeated, 1);
    assert.equal(restored.visitedEventStages.has(0), true);
});

test('per-location expedition snapshots do not overwrite another region resume point', (t) => {
    const { player } = setup(t);
    player.dungeonProgress = {
        forest: { campaignCycle: 1, stage: 3, enemiesDefeated: 1 },
        mountains: { campaignCycle: 1, stage: 7, enemiesDefeated: 0 }
    };
    assert.equal(gameState.save(), true);
    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.dungeonProgress.forest.stage, 3);
    assert.equal(gameState.player.dungeonProgress.mountains.stage, 7);
});

test('malformed and out-of-range expedition snapshots are discarded during save normalization', (t) => {
    const { values } = setup(t);
    values.set('rpg_adventure_save', JSON.stringify({
        schemaVersion: 2,
        player: {
            class: 'warrior',
            campaignCycle: 1,
            dungeonProgress: {
                village: { campaignCycle: 1, stage: 0, enemiesDefeated: 0 },
                forest: { campaignCycle: 2, stage: 0, enemiesDefeated: 0 },
                mountains: { campaignCycle: 1, stage: 999, enemiesDefeated: 0 },
                ruins: { campaignCycle: 1, stage: 0, enemiesDefeated: -1 }
            }
        }
    }));
    assert.equal(gameState.load(), true);
    assert.deepEqual(gameState.player.dungeonProgress, {});
});


test('boss rewards and the next stage resume marker are committed in the same save', async (t) => {
    const { player } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 4;
    run.enemiesDefeated = getLocation('forest').stages[4].enemiesCount;
    run.claimedDeepChestStages = new Set();
    run.claimedUnbrokenBonusStages = new Set();
    player.experience = 777;
    player.gold = 888;

    const { handleBossVictory } = await import('../js/systems/dungeon.js');
    handleBossVictory();

    const saved = Storage.load().player;
    assert.equal(saved.experience, 777);
    assert.equal(saved.gold, 888);
    assert.equal(saved.dungeonProgress.forest.stage, 5);
    assert.equal(saved.dungeonProgress.forest.enemiesDefeated, 0);

    resetLocationState();
    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.dungeonProgress.forest.stage, 5);
});


test('checkpoint and event fallbacks are persisted when the battle UI is not mounted', (t) => {
    const { player } = setup(t);
    const previousDocument = globalThis.document;
    globalThis.document = { getElementById() { return null; } };
    window.updateBattleUI = () => {};
    window.animateBattle = () => {};

    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 4;
    run.enemiesDefeated = 0;
    startStageBattle();

    const saved = Storage.load().player.dungeonProgress.forest;
    assert.ok(saved.visitedCheckpointStages.includes(4));
    assert.ok(saved.visitedEventStages.includes(4));
    assert.equal(saved.stage, 4);

    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
});

test('safe-route fallback is persisted when the battle UI is not mounted', (t) => {
    const { player } = setup(t);
    const previousDocument = globalThis.document;
    globalThis.document = { getElementById() { return null; } };
    window.updateBattleUI = () => {};
    window.animateBattle = () => {};

    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 2;
    run.enemiesDefeated = 0;
    startStageBattle();

    const saved = Storage.load().player.dungeonProgress.forest;
    assert.equal(saved.routeChoices['2'], 'safe');
    assert.ok(saved.visitedRouteStages.includes(2));

    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
});
