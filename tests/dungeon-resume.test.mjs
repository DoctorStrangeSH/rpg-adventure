import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { Storage } from '../js/core/storage.js';
import { getLocation, LOCATIONS } from '../js/data/locations.js';
import { startNewGamePlus } from '../js/systems/newGamePlus.js';
import { getBattleState } from '../js/ui/battle.js';
import { handleVictory, handleDefeat, fleeLocation, getLocationState, resetLocationState, startLocation, startStageBattle, chooseDungeonRoute, chooseAdventureEvent, chooseSecretRoom } from '../js/systems/dungeon.js';

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
    t.after(() => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });
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

test('dungeon entry is cancelled and the previous resume snapshot is preserved when the initial save fails', (t) => {
    const { player } = setup(t);
    const previousSave = gameState.save;
    const previousProgress = {
        campaignCycle: 1,
        stage: 3,
        enemiesDefeated: 2,
        visitedEventStages: [1],
        routeChoices: { 2: 'safe' }
    };
    player.dungeonProgress = { forest: structuredClone(previousProgress) };
    gameState.save = () => false;
    const screens = [];
    const notifications = [];
    window.showScreen = (screen) => screens.push(screen);
    window.showNotification = (message, type) => notifications.push({ message, type });

    t.after(() => { gameState.save = previousSave; });

    startLocation('forest');

    assert.equal(getLocationState().inLocation, false);
    assert.equal(getLocationState().currentLocation, null);
    assert.deepEqual(player.dungeonProgress.forest, previousProgress);
    assert.equal(screens.includes('battle-screen'), false);
    assert.equal(notifications.some(entry => entry.type === 'error'), true);
});

test('failed initial save does not leave a new empty expedition snapshot behind', (t) => {
    const { player } = setup(t);
    const previousSave = gameState.save;
    delete player.dungeonProgress;
    gameState.save = () => false;

    t.after(() => { gameState.save = previousSave; });

    startLocation('forest');

    assert.equal(getLocationState().inLocation, false);
    assert.equal(player.dungeonProgress, undefined);
});

test('failed route save restores the pending choice and does not start the next encounter', (t) => {
    const { player, battle } = setup(t);
    const previousSave = gameState.save;
    gameState.save = () => false;
    const run = getLocationState();
    run.currentStage = 2;
    run.pendingRoute = { stage: 2, runId: run.runId };
    run.routeChoices = {};
    run.visitedRouteStages = new Set();
    const before = structuredClone(player);
    t.after(() => { gameState.save = previousSave; });

    assert.equal(chooseDungeonRoute('danger'), false);
    assert.deepEqual(player, before);
    assert.deepEqual(run.pendingRoute, { stage: 2, runId: run.runId });
    assert.equal(run.routeChoices[2], undefined);
    assert.equal(run.visitedRouteStages.has(2), false);
    assert.equal(battle.isActive, false);
});

test('failed adventure-event save rolls back player rewards and keeps the event available', (t) => {
    const { player, battle } = setup(t);
    const previousSave = gameState.save;
    gameState.save = () => false;
    player.gold = 100;
    const before = structuredClone(player);
    const run = getLocationState();
    run.currentStage = 4;
    run.pendingEvent = { id: 'campfire', stage: 4, runId: run.runId };
    run.visitedEventStages = new Set();
    const pending = structuredClone(run.pendingEvent);
    t.after(() => { gameState.save = previousSave; });

    assert.equal(chooseAdventureEvent('risk'), false);
    assert.deepEqual(player, before);
    assert.deepEqual(run.pendingEvent, pending);
    assert.equal(run.visitedEventStages.has(4), false);
    assert.equal(battle.isActive, false);
});

test('failed secret-room save rolls back inventory and leaves the room choice pending', (t) => {
    const { player, battle } = setup(t);
    const previousSave = gameState.save;
    const previousRandom = Math.random;
    gameState.save = () => false;
    Math.random = () => 0.1;
    const before = structuredClone(player);
    const run = getLocationState();
    run.currentStage = 6;
    run.pendingSecretRoom = { id: 'armory', stage: 6, runId: run.runId };
    const pending = structuredClone(run.pendingSecretRoom);
    t.after(() => {
        gameState.save = previousSave;
        Math.random = previousRandom;
    });

    assert.equal(chooseSecretRoom('explore'), false);
    assert.deepEqual(player, before);
    assert.deepEqual(run.pendingSecretRoom, pending);
    assert.equal(battle.isActive, false);
});

test('headless checkpoint fallback keeps the checkpoint pending when persistence fails', (t) => {
    const { player, battle } = setup(t);
    startLocation('forest');
    const previousDocument = globalThis.document;
    const previousSave = gameState.save;
    globalThis.document = { getElementById() { return null; } };
    gameState.save = () => false;
    battle.isActive = false;
    battle.currentEnemy = null;
    const run = getLocationState();
    run.currentStage = 4;
    t.after(() => {
        gameState.save = previousSave;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    startStageBattle();

    assert.equal(run.inLocation, true);
    assert.deepEqual(run.pendingCheckpoint, { stage: 4, runId: run.runId });
    assert.equal(run.visitedCheckpointStages.has(4), false);
    assert.equal(player.dungeonProgress.forest.stage, 0);
});

test('headless route fallback does not apply a safe route after save failure', (t) => {
    const { battle } = setup(t);
    startLocation('forest');
    const previousDocument = globalThis.document;
    const previousSave = gameState.save;
    globalThis.document = { getElementById() { return null; } };
    gameState.save = () => false;
    battle.isActive = false;
    battle.currentEnemy = null;
    const run = getLocationState();
    run.currentStage = 2;
    t.after(() => {
        gameState.save = previousSave;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    startStageBattle();

    assert.equal(run.inLocation, true);
    assert.deepEqual(run.pendingRoute, { stage: 2, runId: run.runId });
    assert.equal(run.visitedRouteStages.has(2), false);
    assert.equal(run.routeChoices[2], undefined);
});

test('headless event fallback preserves its pending event when save fails', (t) => {
    const { battle } = setup(t);
    startLocation('forest');
    const previousDocument = globalThis.document;
    const previousSave = gameState.save;
    globalThis.document = { getElementById() { return null; } };
    let saveAttempts = 0;
    gameState.save = () => ++saveAttempts === 1;
    battle.isActive = false;
    battle.currentEnemy = null;
    const run = getLocationState();
    run.currentStage = 4;
    run.visitedCheckpointStages.add(4);
    run.travelerReturnPending = true;
    t.after(() => {
        gameState.save = previousSave;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    startStageBattle();

    assert.equal(run.inLocation, true);
    assert.ok(run.pendingEvent);
    assert.equal(run.pendingEvent.stage, 4);
    assert.equal(run.visitedEventStages.has(4), false);
});

test('secret-stage discovery marker is restored when its save fails', (t) => {
    const { battle } = setup(t);
    startLocation('forest');
    const previousSave = gameState.save;
    const previousRandom = Math.random;
    gameState.save = () => false;
    Math.random = () => 0.1;
    battle.isActive = false;
    battle.currentEnemy = null;
    const run = getLocationState();
    run.currentStage = 6;
    t.after(() => {
        gameState.save = previousSave;
        Math.random = previousRandom;
    });

    startStageBattle();

    assert.equal(run.inLocation, true);
    assert.equal(run.checkedSecretStages.has(6), false);
    assert.equal(run.pendingSecretRoom, null);
});

test('ordinary dungeon victory rolls back its reward and defeated counter when the save fails', (t) => {
    const { player } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 0;
    run.enemiesDefeated = 1;
    const playerBeforeBattle = structuredClone(player);
    player.gold += 75;
    player.experience += 40;
    player.stats.kills += 1;
    const previousSave = gameState.save;
    gameState.save = () => false;
    t.after(() => { gameState.save = previousSave; });

    assert.equal(handleVictory(playerBeforeBattle), false);
    assert.deepEqual(player, playerBeforeBattle);
    assert.equal(run.currentStage, 0);
    assert.equal(run.enemiesDefeated, 1);
    const persisted = Storage.load().player;
    assert.equal(persisted.gold, playerBeforeBattle.gold);
    assert.equal(persisted.experience, playerBeforeBattle.experience);
    assert.equal(persisted.dungeonProgress.forest.enemiesDefeated, 0);
});

test('ordinary dungeon victory advances to the next stage only after its transition save succeeds', (t) => {
    const { player } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    const stage = run.currentLocation.stages[0];
    run.currentStage = 0;
    run.enemiesDefeated = stage.enemiesCount - 1;
    const previousSave = gameState.save;
    const previousTimeout = globalThis.setTimeout;
    let scheduled = null;
    let saves = 0;
    gameState.save = () => ++saves === 1;
    globalThis.setTimeout = (callback) => { scheduled = callback; return 0; };
    t.after(() => {
        gameState.save = previousSave;
        globalThis.setTimeout = previousTimeout;
    });

    assert.equal(handleVictory(), true);
    assert.equal(run.enemiesDefeated, stage.enemiesCount);
    assert.equal(run.currentStage, 0);
    assert.equal(typeof scheduled, 'function');

    scheduled();

    assert.equal(run.currentStage, 0);
    assert.equal(run.enemiesDefeated, stage.enemiesCount);
    assert.equal(player.dungeonProgress.forest.stage, 0);
});

test('resuming an already-cleared stage does not advance when the transition save fails', (t) => {
    const { player, battle } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    const stage = run.currentLocation.stages[0];
    run.currentStage = 0;
    run.enemiesDefeated = stage.enemiesCount;
    const previousSave = gameState.save;
    gameState.save = () => false;
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => { gameState.save = previousSave; });

    startStageBattle();

    assert.equal(run.currentStage, 0);
    assert.equal(run.enemiesDefeated, stage.enemiesCount);
    assert.equal(player.dungeonProgress.forest.stage, 0);
    assert.equal(player.dungeonProgress.forest.enemiesDefeated, 0);
    assert.equal(battle.isActive, false);
});

test('boss victory restores all rewards and keeps the boss stage when its atomic save fails', async (t) => {
    const { player } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    const location = getLocation('forest');
    run.currentStage = 4;
    run.enemiesDefeated = location.stages[4].enemiesCount;
    run.claimedDeepChestStages = new Set();
    run.claimedUnbrokenBonusStages = new Set();
    const beforeBattle = structuredClone(player);
    player.experience += 125;
    player.gold += 90;
    player.stats.kills += 1;
    player.stats.bossesKilled = (player.stats.bossesKilled || 0) + 1;

    const previousSave = gameState.save;
    gameState.save = () => false;
    const { handleBossVictory } = await import('../js/systems/dungeon.js');
    t.after(() => { gameState.save = previousSave; });

    assert.equal(handleBossVictory(beforeBattle), false);
    assert.deepEqual(player, beforeBattle);
    assert.equal(run.currentStage, 4);
    assert.equal(run.enemiesDefeated, location.stages[4].enemiesCount);
    assert.equal(run.claimedDeepChestStages.has(5), false);
    assert.equal(run.claimedUnbrokenBonusStages.has(5), false);
    assert.equal(Storage.load().player.gold, beforeBattle.gold);
});

test('final boss and region completion roll back together when the final save fails', async (t) => {
    const { player } = setup(t);
    const location = getLocation('dragon_lair');
    const previousUnlocked = location.unlocked;
    location.unlocked = true;
    player.level = 100;
    startLocation('dragon_lair');
    const run = getLocationState();
    run.currentStage = location.stages.length - 1;
    run.enemiesDefeated = location.stages.at(-1).enemiesCount;
    run.claimedDeepChestStages = new Set();
    run.claimedUnbrokenBonusStages = new Set();
    const beforeBattle = structuredClone(player);
    player.experience += 500;
    player.gold += 300;
    player.stats.bossesKilled = (player.stats.bossesKilled || 0) + 1;

    const previousSave = gameState.save;
    gameState.save = () => false;
    const { handleBossVictory } = await import('../js/systems/dungeon.js');
    t.after(() => {
        gameState.save = previousSave;
        location.unlocked = previousUnlocked;
    });

    assert.equal(handleBossVictory(beforeBattle), false);
    assert.deepEqual(player, beforeBattle);
    assert.equal(run.inLocation, true);
    assert.equal(run.currentLocation.id, 'dragon_lair');
    assert.equal(run.currentStage, location.stages.length - 1);
    assert.equal(run.finalBossDefeated, false);
    assert.equal(player.campaignCompleted, beforeBattle.campaignCompleted);
});

test('flee keeps the active expedition and saved progress when its save fails', (t) => {
    const { player } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 3;
    run.enemiesDefeated = 1;
    const before = structuredClone(player);
    const previousSave = gameState.save;
    gameState.save = () => false;
    t.after(() => { gameState.save = previousSave; });

    assert.equal(fleeLocation(), false);
    assert.deepEqual(player, before);
    assert.equal(run.inLocation, true);
    assert.equal(run.currentLocation.id, 'forest');
    assert.equal(run.currentStage, 3);
    assert.equal(Storage.load().player.dungeonProgress.forest.stage, 0);
});

test('successful flee clears the expedition only after its save succeeds', (t) => {
    const { player } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 3;
    run.enemiesDefeated = 1;

    assert.equal(fleeLocation(), true);
    assert.equal(run.inLocation, false);
    assert.equal(run.currentLocation, null);
    assert.equal(player.dungeonProgress.forest, undefined);
    assert.equal(Storage.load().player.dungeonProgress.forest, undefined);
});

test('defeat preserves the expedition snapshot when clearing progress cannot be saved', (t) => {
    const { player } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 3;
    run.enemiesDefeated = 1;
    player.dungeonProgress ||= {};
    player.dungeonProgress.forest = { campaignCycle: 1, stage: 3, enemiesDefeated: 1 };
    assert.equal(gameState.save(), true);
    const before = structuredClone(player);
    const previousSave = gameState.save;
    gameState.save = () => false;
    t.after(() => { gameState.save = previousSave; });

    assert.equal(handleDefeat(), false);
    assert.deepEqual(player, before);
    assert.equal(run.inLocation, true);
    assert.equal(run.currentLocation.id, 'forest');
    assert.equal(Storage.load().player.dungeonProgress.forest.stage, 3);
});

test('defeat handler rolls back pre-penalty player snapshot when save fails', (t) => {
    const { player } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 4;
    run.enemiesDefeated = 2;
    player.dungeonProgress ||= {};
    player.dungeonProgress.forest = { campaignCycle: 1, stage: 4, enemiesDefeated: 2 };
    const beforePenalty = structuredClone(player);
    player.health = 1;
    player.gold = Math.max(0, player.gold - 10);
    player.stats.losses++;
    const previousSave = gameState.save;
    gameState.save = () => false;
    t.after(() => { gameState.save = previousSave; });

    assert.equal(handleDefeat(beforePenalty), false);
    assert.deepEqual(player, beforePenalty);
    assert.equal(run.inLocation, true);
    assert.equal(run.currentStage, 4);
    assert.equal(run.enemiesDefeated, 2);
});

test('expedition battle start rolls back counters and consumed run modifiers when save fails', (t) => {
    const { player, battle } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 0;
    run.travelerFavorFights = 2;
    run.bloodPursuerPending = true;
    const battlesBefore = player.stats.battles;
    const playerBefore = structuredClone(player);
    const previousDocument = globalThis.document;
    const previousSave = gameState.save;
    const ui = { innerHTML: '' };
    globalThis.document = { getElementById() { return ui; } };
    gameState.save = () => false;
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        gameState.save = previousSave;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    startStageBattle();

    assert.equal(player.stats.battles, battlesBefore);
    assert.deepEqual(player.dungeonProgress, playerBefore.dungeonProgress);
    assert.equal(run.travelerFavorFights, 2);
    assert.equal(run.bloodPursuerPending, true);
    assert.equal(battle.isActive, false);
    assert.equal(battle.currentEnemy, null);
    assert.match(ui.innerHTML, /Повторить запуск боя/);
});

test('headless expedition battle start returns safely to map when its save fails', (t) => {
    const { player, battle } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 0;
    const battlesBefore = player.stats.battles;
    const previousDocument = globalThis.document;
    const previousSave = gameState.save;
    const screens = [];
    globalThis.document = { getElementById() { return null; } };
    window.showScreen = screen => screens.push(screen);
    gameState.save = () => false;
    t.after(() => {
        gameState.save = previousSave;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    startStageBattle();

    assert.equal(player.stats.battles, battlesBefore);
    assert.equal(battle.isActive, false);
    assert.equal(battle.currentEnemy, null);
    assert.ok(screens.includes('map-screen'));
    assert.equal(run.inLocation, true);
});


test('route decisions, one-time stage markers and expedition modifiers survive a real save/reload/resume', (t) => {
    const { player } = setup(t);
    player.dungeonProgress = {
        forest: {
            campaignCycle: player.campaignCycle,
            stage: 2,
            enemiesDefeated: 1,
            visitedEventStages: [0],
            visitedRouteStages: [2],
            routeChoices: { 2: 'danger' },
            checkedSecretStages: [6],
            visitedCheckpointStages: [4],
            claimedDeepChestStages: [19],
            claimedUnbrokenBonusStages: [19],
            resumedFromCheckpoint: true,
            travelerFavorFights: 3,
            travelerReturnPending: true,
            bloodPursuerPending: true,
            finalBossDefeated: false
        }
    };

    assert.equal(gameState.save(), true);
    resetLocationState();
    assert.equal(gameState.load(), true);

    const restoredPlayer = gameState.player;
    assert.equal(restoredPlayer.dungeonProgress.forest.routeChoices['2'], 'danger');
    startLocation('forest');

    const run = getLocationState();
    assert.equal(run.inLocation, true);
    assert.equal(run.currentStage, 2);
    assert.equal(run.enemiesDefeated, 1);
    assert.equal(run.visitedEventStages.has(0), true);
    assert.equal(run.visitedRouteStages.has(2), true);
    assert.equal(run.routeChoices[2], 'danger');
    assert.equal(run.checkedSecretStages.has(6), true);
    assert.equal(run.visitedCheckpointStages.has(4), true);
    assert.equal(run.claimedDeepChestStages.has(19), true);
    assert.equal(run.claimedUnbrokenBonusStages.has(19), true);
    assert.equal(run.resumedFromCheckpoint, true);
    assert.equal(run.travelerFavorFights, 3);
    assert.equal(run.travelerReturnPending, true);
    assert.equal(run.bloodPursuerPending, true);
    assert.equal(run.pendingRoute, null);
    assert.equal(run.pendingEvent, null);
    assert.equal(run.pendingSecretRoom, null);
    assert.equal(run.pendingCheckpoint, null);
    assert.equal(getBattleState().isActive, false);
});


test('an unresolved adventure event keeps its exact identity and choice UI after reload', (t) => {
    const { player } = setup(t);
    const previousDocument = globalThis.document;
    const previousRandom = Math.random;
    const ui = { innerHTML: '' };
    globalThis.document = { getElementById(id) { return id === 'battle-ui' ? ui : null; } };
    Math.random = () => 0;
    t.after(() => {
        Math.random = previousRandom;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 4;
    run.visitedCheckpointStages.add(4);
    startStageBattle();

    const pendingId = run.pendingEvent?.id;
    assert.equal(pendingId, 'cache');
    assert.equal(Storage.load().player.dungeonProgress.forest.pendingAdventureEventId, pendingId);
    assert.match(ui.innerHTML, /Забытый тайник/);

    resetLocationState();
    assert.equal(gameState.load(), true);
    startLocation('forest');
    startStageBattle();

    const resumed = getLocationState();
    assert.equal(resumed.pendingEvent?.id, pendingId);
    assert.equal(resumed.pendingEvent?.stage, 4);
    assert.match(ui.innerHTML, /Забытый тайник/);
    assert.equal(Storage.load().player.dungeonProgress.forest.pendingAdventureEventId, pendingId);
});

test('an unresolved secret room keeps its exact discovery and choice UI after reload', (t) => {
    const { player } = setup(t);
    const previousDocument = globalThis.document;
    const previousRandom = Math.random;
    const ui = { innerHTML: '' };
    globalThis.document = { getElementById(id) { return id === 'battle-ui' ? ui : null; } };
    Math.random = () => 0;
    t.after(() => {
        Math.random = previousRandom;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 6;
    startStageBattle();

    assert.equal(run.checkedSecretStages.has(6), true);
    assert.equal(run.pendingSecretRoom?.id, 'armory');
    assert.equal(Storage.load().player.dungeonProgress.forest.pendingSecretRoomId, 'armory');
    assert.match(ui.innerHTML, /Забытая оружейная/);

    resetLocationState();
    assert.equal(gameState.load(), true);
    startLocation('forest');
    startStageBattle();

    const resumed = getLocationState();
    assert.equal(resumed.checkedSecretStages.has(6), true);
    assert.equal(resumed.pendingSecretRoom?.id, 'armory');
    assert.equal(resumed.pendingSecretRoom?.stage, 6);
    assert.match(ui.innerHTML, /Забытая оружейная/);
    assert.equal(Storage.load().player.dungeonProgress.forest.pendingSecretRoomId, 'armory');
});


test('failed expedition boss startup rolls back battle counters and never opens an unsaved boss', (t) => {
    const { player, battle } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 9;
    run.enemiesDefeated = getLocation('forest').stages[9].enemiesCount;
    run.visitedCheckpointStages.add(9);
    run.visitedEventStages.add(9);
    const beforePlayer = structuredClone(player);
    const previousSave = gameState.save;
    gameState.save = () => false;
    t.after(() => { gameState.save = previousSave; });

    startStageBattle();

    assert.equal(player.stats.battles, beforePlayer.stats.battles);
    assert.deepEqual(player.dungeonProgress, beforePlayer.dungeonProgress);
    assert.equal(battle.isActive, false);
    assert.equal(battle.currentEnemy, null);
    assert.equal(run.inLocation, true);
    assert.equal(run.currentStage, 9);
});


test('an active expedition encounter restores the same enemy, effects, turn and relic runtime after reload', (t) => {
    const { player, battle } = setup(t);
    const previousDocument = globalThis.document;
    const previousRaf = globalThis.requestAnimationFrame;
    const ui = { innerHTML: '' };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? ui : null; },
        querySelectorAll() { return []; }
    };
    globalThis.requestAnimationFrame = () => 1;
    window.getLocationState = getLocationState;
    window.animateBattle = () => {};
    window.updateBattleUI = () => {};
    window.showBattleMessage = () => {};
    window.showScreen = () => {};
    t.after(() => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        if (previousRaf === undefined) delete globalThis.requestAnimationFrame;
        else globalThis.requestAnimationFrame = previousRaf;
    });

    const savedEnemy = {
        id: 'wolf',
        name: 'Вожак лесных волков',
        icon: '🐺',
        behavior: 'elite',
        health: 137,
        maxHealth: 240,
        attack: 31,
        defense: 12,
        expReward: 80,
        goldReward: 45,
        elite: true,
        effects: { poisonTurns: 2, burnTurns: 1, freezeTurns: 0, weakenTurns: 1 },
        intent: 'heavy',
        phase: 2,
        archerMarks: 1,
        damageModifiers: { fire: 1.2 },
        resistances: { ice: 0.8 }
    };
    player.health = player.maxHealth - 23;
    player.mana = player.maxMana - 11;
    player.dungeonProgress = {
        forest: {
            campaignCycle: player.campaignCycle,
            stage: 3,
            enemiesDefeated: 1,
            activeEncounter: {
                enemy: savedEnemy,
                isBossBattle: false,
                turn: 'enemy',
                guardReduction: 0.35,
                relicEffects: { phoenixRebirthUsed: true, lastStandTriggered: 1 }
            }
        }
    };
    assert.equal(gameState.save(), true);

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    startStageBattle();

    assert.equal(battle.isActive, true);
    assert.equal(battle.isDungeonBattle, true);
    assert.equal(battle.currentEnemy.id, 'wolf');
    assert.equal(battle.currentEnemy.health, 137);
    assert.deepEqual(battle.currentEnemy.effects, savedEnemy.effects);
    assert.equal(battle.currentEnemy.intent, 'heavy');
    assert.equal(battle.currentEnemy.phase, 2);
    assert.equal(battle.turn, 'enemy');
    assert.equal(battle.guardReduction, 0.35);
    assert.deepEqual(battle.relicEffects, {
        phoenixRebirthUsed: true,
        lastStandTriggered: 1
    });
});


test('malformed active encounter snapshots are discarded without invalidating the expedition checkpoint', (t) => {
    const { player } = setup(t);
    player.dungeonProgress = {
        forest: {
            campaignCycle: player.campaignCycle,
            stage: 2,
            enemiesDefeated: 1,
            activeEncounter: {
                enemy: { id: 'wolf', name: 'Broken wolf', health: 'not-a-number', maxHealth: 100, attack: 10, defense: 2 },
                turn: 'enemy'
            }
        }
    };

    assert.equal(gameState.save(), true);
    assert.equal(gameState.load(), true);
    const saved = gameState.player.dungeonProgress.forest;
    assert.equal(saved.stage, 2);
    assert.equal(saved.enemiesDefeated, 1);
    assert.equal(saved.activeEncounter, null);
});


test('a saved regional boss encounter resumes with boss rules instead of a regular enemy', (t) => {
    const { player, battle } = setup(t);
    const previousDocument = globalThis.document;
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelectorAll() { return []; }
    };
    window.getLocationState = getLocationState;
    window.animateBattle = () => {};
    window.showBattleMessage = () => {};
    window.showScreen = () => {};
    t.after(() => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    const stage = getLocation('forest').stages[4];
    const boss = {
        id: stage.boss.id,
        name: stage.boss.name,
        health: 321,
        maxHealth: 500,
        attack: 42,
        defense: 18,
        expReward: stage.boss.expReward,
        goldReward: stage.boss.goldReward,
        miniBoss: true,
        behavior: 'mini_boss',
        effects: { burnTurns: 2 },
        phase: 1
    };
    player.dungeonProgress = {
        forest: {
            campaignCycle: player.campaignCycle,
            stage: 4,
            enemiesDefeated: stage.enemiesCount,
            activeEncounter: {
                enemy: boss,
                isBossBattle: true,
                turn: 'player',
                guardReduction: 0,
                relicEffects: { phoenixRebirthUsed: false }
            }
        }
    };
    assert.equal(gameState.save(), true);
    resetLocationState();
    assert.equal(gameState.load(), true);
    startLocation('forest');
    startStageBattle();

    assert.equal(battle.isActive, true);
    assert.equal(battle.isBossBattle, true);
    assert.equal(battle.isDungeonBattle, true);
    assert.equal(battle.currentEnemy.id, boss.id);
    assert.equal(battle.currentEnemy.health, 321);
    assert.deepEqual(battle.currentEnemy.effects, { burnTurns: 2 });
});


test('a saved boss telegraph survives reload without rerolling or losing the prepared signature attack', (t) => {
    const { player, battle } = setup(t);
    const previousDocument = globalThis.document;
    const ui = { innerHTML: '' };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? ui : null; },
        querySelectorAll() { return []; }
    };
    window.getLocationState = getLocationState;
    window.animateBattle = () => {};
    window.updateBattleUI = () => {};
    window.showBattleMessage = () => {};
    t.after(() => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    const boss = getLocation('forest').stages[29].boss;
    player.dungeonProgress = {
        forest: {
            campaignCycle: player.campaignCycle,
            stage: 29,
            enemiesDefeated: getLocation('forest').stages[29].enemiesCount,
            activeEncounter: {
                enemy: {
                    ...structuredClone(boss),
                    health: 287,
                    maxHealth: boss.health,
                    behavior: 'boss',
                    intent: 'thorn_burst',
                    phase: 2,
                    effects: { burnTurns: 1 }
                },
                isBossBattle: true,
                turn: 'player',
                guardReduction: 0,
                relicEffects: { phoenixRebirthUsed: false }
            }
        }
    };
    assert.equal(gameState.save(), true);

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    startStageBattle();

    assert.equal(battle.isActive, true);
    assert.equal(battle.isBossBattle, true);
    assert.equal(battle.currentEnemy.id, boss.id);
    assert.equal(battle.currentEnemy.intent, 'thorn_burst');
    assert.equal(battle.currentEnemy.phase, 2);
    assert.equal(battle.currentEnemy.health, 287);
    assert.deepEqual(battle.currentEnemy.effects, { burnTurns: 1 });
    assert.equal(battle.turn, 'player');
    assert.equal(Storage.load().player.dungeonProgress.forest.activeEncounter.enemy.intent, 'thorn_burst');
});



test('final World Eater cataclysm telegraph and phase survive a full expedition reload', (t) => {
    const { player, battle } = setup(t);
    const previousDocument = globalThis.document;
    const ui = { innerHTML: '' };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? ui : null; },
        querySelectorAll() { return []; }
    };
    window.animateBattle = () => {};
    window.updateBattleUI = () => {};
    window.showBattleMessage = () => {};
    t.after(() => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });
    const location = getLocation('dragon_lair');
    const previousUnlocks = LOCATIONS.map(entry => entry.unlocked);
    location.unlocked = true;
    player.level = 100;
    player.unlockedLocations = ['forest', 'mountains', 'ruins', 'dragon_lair'];
    t.after(() => {
        LOCATIONS.forEach((entry, index) => { entry.unlocked = previousUnlocks[index]; });
    });

    startLocation('dragon_lair');
    const run = getLocationState();
    const finalStageIndex = location.stages.length - 1;
    const finalStage = location.stages[finalStageIndex];
    const worldEater = {
        ...structuredClone(finalStage.boss),
        health: 777,
        maxHealth: finalStage.boss.health,
        behavior: 'boss',
        intent: 'cataclysm',
        phase: 3,
        effects: { burnTurns: 2, weakenTurns: 1 }
    };
    run.currentStage = finalStageIndex;
    run.enemiesDefeated = finalStage.enemiesCount;
    player.dungeonProgress.dragon_lair = {
        campaignCycle: player.campaignCycle,
        stage: finalStageIndex,
        enemiesDefeated: finalStage.enemiesCount,
        activeEncounter: {
            enemy: worldEater,
            isBossBattle: true,
            turn: 'enemy',
            guardReduction: 0,
            relicEffects: { phoenixRebirthUsed: true }
        }
    };
    assert.equal(gameState.save(), true);

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    assert.equal(gameState.load(), true);
    startLocation('dragon_lair');
    startStageBattle();

    assert.equal(battle.isActive, true);
    assert.equal(battle.isBossBattle, true);
    assert.equal(battle.isDungeonBattle, true);
    assert.equal(battle.currentEnemy.id, 'world_eater');
    assert.equal(battle.currentEnemy.health, 777);
    assert.equal(battle.currentEnemy.intent, 'cataclysm');
    assert.equal(battle.currentEnemy.phase, 3);
    assert.deepEqual(battle.currentEnemy.effects, { burnTurns: 2, weakenTurns: 1 });
    assert.equal(battle.turn, 'enemy');

    const restored = Storage.load().player.dungeonProgress.dragon_lair.activeEncounter;
    assert.equal(restored.enemy.intent, 'cataclysm');
    assert.equal(restored.enemy.phase, 3);
    assert.equal(restored.enemy.health, 777);
    assert.equal(restored.relicEffects.phoenixRebirthUsed, true);
});



test('all four regional signature bosses restore identity, phase, telegraph and effects after reload', (t) => {
    const { player, battle } = setup(t);
    const previousDocument = globalThis.document;
    const previousUnlocks = LOCATIONS.map(entry => entry.unlocked);
    const ui = { innerHTML: '' };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? ui : null; },
        querySelectorAll() { return []; }
    };
    window.animateBattle = () => {};
    window.updateBattleUI = () => {};
    window.showBattleMessage = () => {};
    t.after(() => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        LOCATIONS.forEach((entry, index) => { entry.unlocked = previousUnlocks[index]; });
    });

    const signatures = {
        forest: { id: 'forest_guardian', intent: 'thorn_burst' },
        mountains: { id: 'mountain_dragon', intent: 'flame_breath' },
        ruins: { id: 'lich_king', intent: 'siphon' },
        dragon_lair: { id: 'world_eater', intent: 'cataclysm' }
    };

    player.level = 100;
    player.unlockedLocations = Object.keys(signatures);
    for (const [regionId, expected] of Object.entries(signatures)) {
        const location = getLocation(regionId);
        location.unlocked = true;
        const finalStageIndex = location.stages.length - 1;
        const stage = location.stages[finalStageIndex];
        const baseBoss = stage.boss;
        assert.equal(baseBoss.id, expected.id);

        startLocation(regionId);
        const run = getLocationState();
        run.currentStage = finalStageIndex;
        run.enemiesDefeated = stage.enemiesCount;
        const enemy = {
            ...structuredClone(baseBoss),
            health: 713,
            maxHealth: baseBoss.health,
            behavior: 'boss',
            intent: expected.intent,
            phase: 2,
            effects: { burnTurns: 2, weakenTurns: 1 }
        };
        player.dungeonProgress[regionId] = {
            campaignCycle: player.campaignCycle,
            stage: finalStageIndex,
            enemiesDefeated: stage.enemiesCount,
            activeEncounter: {
                enemy,
                isBossBattle: true,
                turn: 'enemy',
                guardReduction: 0.25,
                relicEffects: { phoenixRebirthUsed: true }
            }
        };
        assert.equal(gameState.save(), true, regionId + ' snapshot must save');

        resetLocationState();
        battle.isActive = false;
        battle.currentEnemy = null;
        gameState.data = { player: null, screen: 'main-menu' };
        assert.equal(gameState.load(), true, regionId + ' profile must reload');
        const persisted = Storage.load().player.dungeonProgress[regionId];
        assert.ok(persisted, regionId + ' progress must remain in the save');
        assert.ok(persisted.activeEncounter, regionId + ' active encounter must survive normalization');
        assert.equal(persisted.activeEncounter.enemy.id, expected.id);
        startLocation(regionId);
        startStageBattle();

        assert.equal(battle.isActive, true, regionId + ' encounter must resume');
        assert.equal(battle.isBossBattle, true, regionId + ' must retain boss rules');
        assert.equal(battle.currentEnemy.id, expected.id);
        assert.equal(battle.currentEnemy.health, 713);
        assert.equal(battle.currentEnemy.intent, expected.intent);
        assert.equal(battle.currentEnemy.phase, 2);
        assert.deepEqual(battle.currentEnemy.effects, { burnTurns: 2, weakenTurns: 1 });
        assert.equal(battle.turn, 'enemy');
        const restored = Storage.load().player.dungeonProgress[regionId].activeEncounter;
        assert.equal(restored.guardReduction, 0.25);
        assert.equal(restored.relicEffects.phoenixRebirthUsed, true);
    }
});

test('phoenix revival health and one-use flag remain spent after a full save reload', (t) => {
    const { player, battle } = setup(t);
    const previousDocument = globalThis.document;
    const ui = { innerHTML: '' };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? ui : null; },
        querySelectorAll() { return []; }
    };
    window.getLocationState = getLocationState;
    window.animateBattle = () => {};
    window.updateBattleUI = () => {};
    window.showBattleMessage = () => {};
    t.after(() => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    player.relics = ['phoenix_crown'];
    player.activeRelics = ['phoenix_crown'];
    player.health = Math.ceil(player.maxHealth * 0.2);
    const revivedHealth = player.health;
    player.dungeonProgress = {
        forest: {
            campaignCycle: player.campaignCycle,
            stage: 29,
            enemiesDefeated: getLocation('forest').stages[29].enemiesCount,
            activeEncounter: {
                enemy: {
                    id: 'forest_guardian',
                    name: 'Древний хранитель леса',
                    health: 211,
                    maxHealth: 500,
                    attack: 40,
                    defense: 20,
                    behavior: 'boss',
                    intent: null,
                    phase: 2,
                    effects: { burnTurns: 1 }
                },
                isBossBattle: true,
                turn: 'player',
                guardReduction: 0,
                relicEffects: { phoenixRebirthUsed: true }
            }
        }
    };
    assert.equal(gameState.save(), true);

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    startStageBattle();

    assert.equal(gameState.player.health, revivedHealth);
    assert.equal(battle.isActive, true);
    assert.equal(battle.isBossBattle, true);
    assert.equal(battle.relicEffects.phoenixRebirthUsed, true);
    assert.equal(battle.currentEnemy.health, 211);
    assert.equal(battle.turn, 'player');
    assert.equal(Storage.load().player.dungeonProgress.forest.activeEncounter.relicEffects.phoenixRebirthUsed, true);
});


test('a duplicate boss victory callback cannot award rewards or advance the following stage twice', async (t) => {
    const { player } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 4;
    run.enemiesDefeated = getLocation('forest').stages[4].enemiesCount;
    run.claimedDeepChestStages = new Set();
    run.claimedUnbrokenBonusStages = new Set();
    const { handleBossVictory } = await import('../js/systems/dungeon.js');

    assert.equal(handleBossVictory(), true);
    assert.equal(run.currentStage, 5);
    assert.equal(run.enemiesDefeated, 0);
    const afterFirstCommit = {
        experience: player.experience,
        gold: player.gold,
        bossesKilled: player.stats.bossesKilled,
        progress: structuredClone(player.dungeonProgress.forest)
    };

    assert.equal(handleBossVictory(), false);
    assert.equal(run.currentStage, 5);
    assert.equal(run.enemiesDefeated, 0);
    assert.equal(player.experience, afterFirstCommit.experience);
    assert.equal(player.gold, afterFirstCommit.gold);
    assert.equal(player.stats.bossesKilled, afterFirstCommit.bossesKilled);
    assert.deepEqual(player.dungeonProgress.forest, afterFirstCommit.progress);
});


test('final boss victory unlocks NG+ and the new campaign cycle survives reload', async (t) => {
    const { player } = setup(t);
    const location = getLocation('dragon_lair');
    const previousUnlocks = LOCATIONS.map(entry => entry.unlocked);
    location.unlocked = true;
    player.level = 100;
    player.unlockedLocations = ['forest', 'mountains', 'ruins', 'dragon_lair'];
    t.after(() => {
        LOCATIONS.forEach((entry, index) => { entry.unlocked = previousUnlocks[index]; });
    });

    startLocation('dragon_lair');
    const run = getLocationState();
    const finalStageIndex = location.stages.length - 1;
    run.currentStage = finalStageIndex;
    run.enemiesDefeated = location.stages[finalStageIndex].enemiesCount;
    run.claimedDeepChestStages = new Set();
    run.claimedUnbrokenBonusStages = new Set();

    const { handleBossVictory } = await import('../js/systems/dungeon.js');
    assert.equal(handleBossVictory(), true);
    assert.equal(run.inLocation, false);
    assert.equal(player.campaignCompleted, true);
    assert.equal(player.newGamePlusUnlocked, true);
    assert.equal(player.lastCompletedCampaignCycle, 1);
    assert.equal(player.completedCampaignCycles, 1);
    assert.equal(player.dungeonProgress.dragon_lair, undefined);

    const completedSave = Storage.load().player;
    assert.equal(completedSave.campaignCompleted, true);
    assert.equal(completedSave.newGamePlusUnlocked, true);
    assert.equal(completedSave.lastCompletedCampaignCycle, 1);

    assert.equal(startNewGamePlus(gameState), true);
    assert.equal(gameState.player.campaignCycle, 2);
    assert.equal(gameState.player.campaignCompleted, false);
    assert.equal(gameState.player.newGamePlusUnlocked, true);
    assert.deepEqual(gameState.player.dungeonProgress, {});
    assert.deepEqual(gameState.player.unlockedLocations, ['forest']);

    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.campaignCycle, 2);
    assert.equal(gameState.player.completedCampaignCycles, 1);
    assert.equal(gameState.player.campaignCompleted, false);
    assert.equal(gameState.player.newGamePlusUnlocked, true);
    assert.deepEqual(gameState.player.dungeonProgress, {});
});


test('boss victory is rejected before the regular encounters on its stage are cleared', async (t) => {
    const { player } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 9;
    run.enemiesDefeated = getLocation('forest').stages[9].enemiesCount - 1;
    const beforePlayer = structuredClone(player);
    const beforeProgress = structuredClone(player.dungeonProgress);
    const { handleBossVictory } = await import('../js/systems/dungeon.js');

    assert.ok(getLocation('forest').stages[9].boss);
    assert.equal(handleBossVictory(), false);
    assert.equal(run.currentStage, 9);
    assert.equal(run.enemiesDefeated, getLocation('forest').stages[9].enemiesCount - 1);
    assert.deepEqual(player, beforePlayer);
    assert.deepEqual(player.dungeonProgress, beforeProgress);
});


test('rescued traveler reward and both delayed expedition effects survive a real reload', (t) => {
    const { player, battle } = setup(t);
    const previousRandom = Math.random;
    const previousDocument = globalThis.document;
    const ui = { innerHTML: '' };
    globalThis.document = { getElementById(id) { return id === 'battle-ui' ? ui : null; } };
    Math.random = () => 0.1;
    player.gold = 0;
    t.after(() => {
        Math.random = previousRandom;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });
    player.mana = 40;

    startLocation('forest');
    let run = getLocationState();
    run.currentStage = 4;
    run.pendingEvent = { id: 'wounded_traveler', stage: 4, runId: run.runId };

    assert.equal(chooseAdventureEvent('risk'), true);
    assert.equal(player.gold, 70);
    assert.equal(run.travelerFavorFights, 3);
    assert.equal(run.travelerReturnPending, true);

    let saved = Storage.load().player.dungeonProgress.forest;
    assert.equal(saved.travelerFavorFights, 3);
    assert.equal(saved.travelerReturnPending, true);
    assert.equal(saved.pendingAdventureEventId, null);
    assert.deepEqual(saved.visitedEventStages, [4]);

    battle.isActive = false;
    battle.currentEnemy = null;
    resetLocationState();
    assert.equal(gameState.load(), true);
    startLocation('forest');
    run = getLocationState();
    assert.equal(run.travelerFavorFights, 3);
    assert.equal(run.travelerReturnPending, true);
    assert.equal(run.visitedEventStages.has(4), true);

    run.currentStage = 5;
    run.pendingEvent = { id: 'blood_contract', stage: 5, runId: run.runId };
    assert.equal(chooseAdventureEvent('risk'), true);
    assert.match(battle.currentEnemy?.name || '', /Преследователь/);
    assert.equal(run.bloodPursuerPending, false);
    saved = Storage.load().player.dungeonProgress.forest;
    assert.equal(saved.bloodPursuerPending, false);
    assert.match(saved.activeEncounter?.enemy?.name || '', /Преследователь/);
    assert.equal(saved.travelerReturnPending, true);

    battle.isActive = false;
    battle.currentEnemy = null;
    resetLocationState();
    assert.equal(gameState.load(), true);
    startLocation('forest');
    startStageBattle();
    run = getLocationState();
    assert.equal(run.bloodPursuerPending, false);
    assert.equal(run.travelerReturnPending, true);
    assert.equal(run.travelerFavorFights, 2); // One protection charge is consumed by the pursuer encounter.
    assert.equal(run.visitedEventStages.has(4), true);
    assert.equal(run.visitedEventStages.has(5), true);
    assert.match(battle.currentEnemy?.name || '', /Преследователь/);
});

test('a resolved secret-room reward is saved once and its discovery marker survives reload', (t) => {
    const { player, battle } = setup(t);
    const previousRandom = Math.random;
    Math.random = () => 0.1;
    t.after(() => { Math.random = previousRandom; });

    startLocation('forest');
    let run = getLocationState();
    run.currentStage = 6;
    run.checkedSecretStages.add(6);
    run.pendingSecretRoom = { id: 'armory', stage: 6, runId: run.runId };

    assert.equal(chooseSecretRoom('explore'), true);
    const awarded = player.inventory.find(item => item.id === 'big_health_potion');
    assert.equal(awarded?.quantity, 1);
    let saved = Storage.load().player.dungeonProgress.forest;
    assert.equal(saved.pendingSecretRoomId, null);
    assert.deepEqual(saved.checkedSecretStages, [6]);

    battle.isActive = false;
    battle.currentEnemy = null;
    resetLocationState();
    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.inventory.find(item => item.id === 'big_health_potion')?.quantity, 1);
    startLocation('forest');
    run = getLocationState();
    assert.equal(run.checkedSecretStages.has(6), true);
    assert.equal(run.pendingSecretRoom, null);
    saved = Storage.load().player.dungeonProgress.forest;
    assert.equal(saved.pendingSecretRoomId, null);
    assert.deepEqual(saved.checkedSecretStages, [6]);
});


test('successful defeat commits the penalty and clears only the failed expedition across reload', (t) => {
    const { player, battle } = setup(t);
    startLocation('forest');
    const run = getLocationState();
    run.currentStage = 7;
    run.enemiesDefeated = 2;
    player.gold = 240;
    player.stats.losses = 3;
    player.dungeonCheckpoints = {
        forest: { stage: 5, health: 80, mana: 25 }
    };
    player.dungeonProgress = {
        forest: {
            campaignCycle: player.campaignCycle,
            stage: 7,
            enemiesDefeated: 2,
            visitedEventStages: [4],
            visitedRouteStages: [6],
            routeChoices: { 6: 'danger' },
            activeEncounter: {
                enemy: {
                    id: 'wolf', name: 'Волк', health: 12, maxHealth: 80,
                    attack: 10, defense: 2, effects: {}
                },
                isBossBattle: false,
                turn: 'enemy',
                guardReduction: 0,
                relicEffects: {}
            }
        }
    };
    const beforePenalty = structuredClone(player);
    player.health = 1;
    player.gold -= 10;
    player.stats.losses += 1;

    assert.equal(handleDefeat(beforePenalty), true);
    assert.equal(player.gold, 230);
    assert.equal(player.stats.losses, 4);
    assert.equal(player.dungeonProgress.forest, undefined);
    assert.equal(player.dungeonCheckpoints.forest, undefined);
    assert.equal(run.inLocation, false);
    assert.equal(run.currentLocation, null);

    const saved = Storage.load().player;
    assert.equal(saved.gold, 230);
    assert.equal(saved.stats.losses, 4);
    assert.equal(saved.dungeonProgress.forest, undefined);
    assert.equal(saved.dungeonCheckpoints.forest, undefined);

    battle.isActive = false;
    battle.currentEnemy = null;
    resetLocationState();
    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.gold, 230);
    assert.equal(gameState.player.stats.losses, 4);
    assert.equal(gameState.player.dungeonProgress.forest, undefined);
    assert.equal(gameState.player.dungeonCheckpoints.forest, undefined);
    startLocation('forest');
    assert.equal(getLocationState().currentStage, 0);
    assert.equal(getLocationState().enemiesDefeated, 0);
});
