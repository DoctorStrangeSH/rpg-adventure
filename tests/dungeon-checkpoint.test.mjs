import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { getLocation } from '../js/data/locations.js';
import { getBattleState } from '../js/ui/battle.js';
import {
    chooseDungeonCheckpoint, getLocationState, resetLocationState
} from '../js/systems/dungeon.js';

function setup(t, saveResult) {
    const previousWindow = globalThis.window;
    const previousSave = gameState.save;
    const screens = [];
    const notifications = [];
    globalThis.window = {
        exitBattle() {},
        showScreen(screen) { screens.push(screen); },
        showNotification(message, type) { notifications.push({ message, type }); }
    };

    const player = gameState.createPlayer('warrior');
    player.dungeonCheckpoints = { forest: 2 };
    gameState.save = () => saveResult;

    const run = getLocationState();
    run.currentLocation = getLocation('forest');
    run.currentStage = 4;
    run.inLocation = true;
    run.runId = 12;
    run.pendingCheckpoint = { stage: 4, runId: 12 };
    run.visitedCheckpointStages = new Set();
    const battle = getBattleState();
    battle.isActive = false;
    battle.currentEnemy = null;

    t.after(() => {
        gameState.save = previousSave;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        resetLocationState();
        const state = getBattleState();
        state.isActive = false;
        state.currentEnemy = null;
    });

    return { player, run, screens, notifications };
}

test('failed checkpoint save preserves the active expedition and previous saved checkpoint', (t) => {
    const { player, run, screens, notifications } = setup(t, false);

    assert.equal(chooseDungeonCheckpoint('retreat'), false);
    assert.equal(player.dungeonCheckpoints.forest, 2);
    assert.equal(run.inLocation, true);
    assert.equal(run.currentLocation.id, 'forest');
    assert.equal(run.currentStage, 4);
    assert.equal(run.enemiesDefeated, 0);
    assert.equal(run.resumedFromCheckpoint, false);
    assert.deepEqual(run.pendingCheckpoint, { stage: 4, runId: 12 });
    assert.equal(run.visitedCheckpointStages.has(4), false);
    assert.deepEqual(screens, []);
    assert.equal(notifications.at(-1).type, 'error');
});

test('successful checkpoint save exits the expedition only after persistence succeeds', (t) => {
    const { player, run, screens, notifications } = setup(t, true);

    assert.equal(chooseDungeonCheckpoint('retreat'), true);
    assert.equal(player.dungeonCheckpoints.forest, 4);
    assert.equal(run.inLocation, false);
    assert.equal(run.currentLocation, null);
    assert.equal(run.pendingCheckpoint, null);
    assert.equal(run.visitedCheckpointStages.has(4), true);
    assert.deepEqual(screens, ['map-screen']);
    assert.equal(notifications.at(-1).type, 'success');
});

test('stale checkpoint callbacks cannot change the saved expedition state', (t) => {
    const { player, run, screens } = setup(t, true);
    run.runId = 13;

    assert.equal(chooseDungeonCheckpoint('retreat'), false);
    assert.equal(player.dungeonCheckpoints.forest, 2);
    assert.equal(run.inLocation, true);
    assert.deepEqual(screens, []);
});
